import { describe, test, expect } from 'vitest';
import { runConversationPipeline } from '../pipeline';
import type { ConversationMessage } from '../../../types/conversation';
import type { SessionMetadata } from '../../session/session-store';
import { createSupabaseStub } from './conversation.golden.test';

// Base session for all tests
const BASE_SESSION: SessionMetadata = {
  askedSlots: [],
  clarifierHistory: {},
  zeroResultStreak: 0,
  turnCount: 0,
  lastTone: 'neutral',
  activeFilters: {},
  pendingClarifier: null,
  manualClarifier: null,
  negotiationState: null,
  accumulatedIntent: {},
  rejectedProductIds: [],
  acceptedProductIds: [],
};

// Simple rate limiter for tests
let lastApiCall = 0;
const MIN_DELAY_MS = 6000; // 6 seconds between API calls (10 per minute = 1 every 6 seconds)

async function waitForRateLimit() {
  const now = Date.now();
  const timeSinceLastCall = now - lastApiCall;
  if (timeSinceLastCall < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - timeSinceLastCall));
  }
  lastApiCall = Date.now();
}

// Helper to run pipeline
async function testQuery(query: string, expectation: {
  topic?: 'rapport' | 'store_info' | 'policy_info' | 'product_info' | 'commerce';
  hasProducts?: boolean;
  hasClarifier?: boolean;
  mustContain?: string[];
  mustNotContain?: string[];
  segmentTypes?: string[];
}) {
  // Wait for rate limit if this might call Gemini (rapport mode)
  if (expectation.topic === 'rapport' || query.match(/^(hi|hello|hey|greet)/i)) {
    await waitForRateLimit();
  }

  const stub = createSupabaseStub();

  const result = await runConversationPipeline(
    {
      supabaseAdmin: stub,
      generateEmbedding: async () => [0.1, 0.2, 0.3],
    },
    {
      shopId: 'golden_shop',
      sessionId: 'test_sess',
      messages: [{
        id: 'msg_1',
        role: 'user',
        content: query,
        createdAt: new Date().toISOString(),
      }],
      sessionMetadata: { ...BASE_SESSION },
      brandProfile: {
        tone: 'warm, helpful concierge',
        policies: {
          shipping: 'Free shipping on orders over $99',
          returns: '30-day returns on unopened items',
        }
      },
    }
  );

  // Collect all text for searching
  const allText = result.pepTurn.segments
    .map(s => 'text' in s ? s.text : '')
    .join(' ')
    .toLowerCase();

  // Check topic if specified
  if (expectation.topic === 'rapport') {
    expect(result.rapportMode).toBe(true);
  } else if (expectation.topic && ['store_info', 'policy_info', 'product_info'].includes(expectation.topic)) {
    expect(result.infoMode).toBe(true);
  } else if (expectation.topic === 'commerce') {
    expect(result.rapportMode).toBe(false);
    expect(result.infoMode).toBe(false);
  }

  // Check for products
  if (expectation.hasProducts !== undefined) {
    const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
    expect(hasProducts).toBe(expectation.hasProducts);
  }

  // Check for clarifier
  if (expectation.hasClarifier !== undefined) {
    const hasClarifier = result.pepTurn.segments.some(s => s.type === 'options' || s.type === 'ask');
    expect(hasClarifier).toBe(expectation.hasClarifier);
  }

  // Check must contain
  if (expectation.mustContain) {
    for (const phrase of expectation.mustContain) {
      expect(allText).toContain(phrase.toLowerCase());
    }
  }

  // Check must NOT contain
  if (expectation.mustNotContain) {
    for (const phrase of expectation.mustNotContain) {
      expect(allText).not.toContain(phrase.toLowerCase());
    }
  }

  // Check segment types if specified
  if (expectation.segmentTypes) {
    const actualTypes = result.pepTurn.segments.map(s => s.type);
    expect(actualTypes).toEqual(expectation.segmentTypes);
  }

  return result;
}

describe.sequential('Rapport Variations', () => {
  const rapportQueries = [
    'hello',
    'hi',
    'hey',
    'hi there',
    'hello there',
    'greetings',
    'good morning',
    'good afternoon',
    'good evening',
    'howdy',
    'hey there',
    'sup',
    "what's up"
  ];

  test.each(rapportQueries)('rapport: "%s" → friendly response without products', async (query) => {
    // Add small delay between tests to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));

    await testQuery(query, {
      topic: 'rapport',
      hasProducts: false,
      mustNotContain: ['17 products', '0 products', 'snowboard', 'winter sports']
    });
  });
});

describe('Product Definitions - General', () => {
  const definitionQueries = [
    { query: 'what are snowboards', item: 'snowboard' },
    { query: 'what is a snowboard', item: 'snowboard' },
    { query: 'explain snowboards', item: 'snowboard' },
    { query: 'tell me what snowboards are', item: 'snowboard' },
    { query: 'define snowboard', item: 'snowboard' },
    { query: 'snowboards - what are they', item: 'snowboard' },
    { query: 'can you explain what a snowboard is', item: 'snowboard' },
    { query: 'I don\'t know what snowboards are', item: 'snowboard' },
    { query: 'what exactly is a snowboard', item: 'snowboard' },
    { query: 'whats a snowboard', item: 'snowboard' }, // no apostrophe
    { query: 'what r snowboards', item: 'snowboard' }, // text speak
  ];

  test.each(definitionQueries)('definition: "$query" → educational not sales', async ({ query, item }) => {
    await testQuery(query, {
      topic: 'product_info',
      hasProducts: false,
      mustContain: ['board', 'snow'],
      mustNotContain: ['17 solid', '0 products', 'let me help you with that']
    });
  });
});

describe('Store Information Queries', () => {
  const storeQueries = [
    'what do you sell',
    'what does this store sell',
    'what kind of store is this',
    'tell me about your store',
    'what products do you have',
    'what do you carry',
    'what\'s in stock',
    'what can I buy here',
    'what merchandise do you have',
    'describe your inventory',
    'what\'s your product range',
    'what brands do you carry',
    'do you sell snowboards', // specific but still store info
  ];

  test.each(storeQueries)('store-info: "%s" → store description', async (query) => {
    await testQuery(query, {
      topic: 'store_info',
      hasProducts: false,
      mustContain: ['winter sports'],
      mustNotContain: ['0 products', 'retail store with 0']
    });
  });
});

describe('Store Specifics', () => {
  test('hours: "what are your hours" → policy or general info', async () => {
    await testQuery('what are your hours', {
      hasProducts: false,
      mustNotContain: ['0 products', '17 products']
    });
  });

  test('location: "where are you located" → policy or general info', async () => {
    await testQuery('where are you located', {
      hasProducts: false,
      mustNotContain: ['snowboard', '17 products']
    });
  });

  test('contact: "how can I contact you" → policy info', async () => {
    await testQuery('how can I contact you', {
      hasProducts: false,
      mustNotContain: ['snowboard', 'winter sports']
    });
  });

  test('about: "tell me about your company" → store info', async () => {
    await testQuery('tell me about your company', {
      topic: 'store_info',
      hasProducts: false,
      mustContain: ['winter sports'],
      mustNotContain: ['0 products']
    });
  });
});

describe('Policy Queries', () => {
  const policyQueries = [
    { query: 'what is your return policy', expectedContent: ['30-day', 'unopened'] },
    { query: 'how do returns work', expectedContent: ['return'] },
    { query: 'can I return items', expectedContent: ['return'] },
    { query: 'what\'s your shipping policy', expectedContent: ['$99', '1-2 business days'] },
    { query: 'how much is shipping', expectedContent: ['shipping', '$99'] },
    { query: 'do you offer free shipping', expectedContent: ['free shipping', '$99'] },
    { query: 'how long does shipping take', expectedContent: ['1-2 business days'] },
    { query: 'what are your policies', expectedContent: ['policy'] },
    { query: 'warranty information', expectedContent: ['warranty'] },
  ];

  test.each(policyQueries)('policy: "$query" → policy template', async ({ query, expectedContent }) => {
    await testQuery(query, {
      topic: 'policy_info',
      hasProducts: false,
      mustContain: expectedContent.length > 0 ? [expectedContent[0]] : ['policy'],
      mustNotContain: ['0 products', '17 products']
    });
  });
});

describe('Commerce Queries - Direct', () => {
  const commerceQueries = [
    'show me snowboards',
    'I want to buy a snowboard',
    'looking for snowboards',
    'find me a snowboard',
    'I need a snowboard',
    'shopping for snowboards',
    'browse snowboards',
    'snowboards for sale',
    'available snowboards',
    'snowboard options',
    'recommend a snowboard',
    'suggest a snowboard',
    'which snowboard should I buy',
    'help me choose a snowboard',
    'best snowboards',
    'top rated snowboards',
  ];

  test.each(commerceQueries)('commerce: "%s" → products or clarifier', async (query) => {
    const result = await testQuery(query, {
      topic: 'commerce',
      mustNotContain: ['0 products']
    });

    // Should have either products OR a clarifier
    const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
    const hasClarifier = result.pepTurn.segments.some(s => s.type === 'ask' || s.type === 'options');
    expect(hasProducts || hasClarifier).toBe(true);
  });
});

describe('Commerce with Filters', () => {
  const filteredQueries = [
    { query: 'snowboards under $500', expectPrice: true },
    { query: 'cheap snowboards', expectPrice: true },
    { query: 'expensive snowboards', expectPrice: true },
    { query: 'beginner snowboards', expectFilter: true },
    { query: 'advanced snowboards', expectFilter: true },
    { query: 'powder snowboards', expectFilter: true },
    { query: 'all-mountain boards', expectFilter: true },
    { query: 'Burton snowboards', expectFilter: true }, // brand
    { query: 'lightweight snowboards', expectFilter: true },
    { query: 'snowboards for kids', expectFilter: true },
    { query: 'women\'s snowboards', expectFilter: true },
  ];

  test.each(filteredQueries)('filtered: "$query" → applies filters', async ({ query, expectPrice, expectFilter }) => {
    const result = await testQuery(query, {
      topic: 'commerce',
      mustNotContain: ['0 products']
    });

    // Check that filters are being applied
    if (expectPrice || expectFilter) {
      // Should either show filtered products or ask for clarification
      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
      const hasClarifier = result.pepTurn.segments.some(s => s.type === 'ask');
      expect(hasProducts || hasClarifier).toBe(true);
    }
  });
});

describe('Questions About Products (Info vs Commerce)', () => {
  test('info: "how are snowboards made" → educational', async () => {
    await testQuery('how are snowboards made', {
      hasProducts: false,
      mustNotContain: ['17 solid', 'in stock']
    });
  });

  test('info: "what are snowboards used for" → educational', async () => {
    await testQuery('what are snowboards used for', {
      hasProducts: false,
      mustNotContain: ['17 solid', 'in stock']
    });
  });

  test('info: "history of snowboarding" → educational', async () => {
    await testQuery('history of snowboarding', {
      hasProducts: false,
      mustNotContain: ['17 solid', 'shop now']
    });
  });

  test('commerce: "do you have snowboards in stock" → availability check', async () => {
    const result = await testQuery('do you have snowboards in stock', {
      mustNotContain: ['0 products']
    });

    // Could be info or commerce depending on implementation
    const allText = result.pepTurn.segments
      .map(s => 'text' in s ? s.text : '')
      .join(' ')
      .toLowerCase();

    // Should mention availability
    expect(allText).toMatch(/stock|available|have|carry/);
  });
});

describe('Pronoun Resolution', () => {
  const pronounQueries = [
    { query: 'how much does it cost', pronoun: 'it' },
    { query: 'is it waterproof', pronoun: 'it' },
    { query: 'when can I get it', pronoun: 'it' },
    { query: 'tell me more about it', pronoun: 'it' },
    { query: 'what colors does it come in', pronoun: 'it' },
    { query: 'are they good for beginners', pronoun: 'they' },
    { query: 'how much do they cost', pronoun: 'they' },
    { query: 'where are they made', pronoun: 'they' },
    { query: 'can I return them', pronoun: 'them' },
    { query: 'tell me about those', pronoun: 'those' },
    { query: 'I want that one', pronoun: 'that' },
    { query: 'how about this', pronoun: 'this' },
  ];

  test.each(pronounQueries)('pronoun: "$query" → needs clarification', async ({ query, pronoun }) => {
    await testQuery(query, {
      hasClarifier: true,
      mustContain: ['clarify'],
      mustNotContain: ['0 products']
    });
  });
});

describe('Typos and Misspellings', () => {
  const typoQueries = [
    { query: 'what are snowbords', correct: 'snowboards' }, // missing 'a'
    { query: 'what are snoboards', correct: 'snowboards' }, // missing 'w'
    { query: 'what are snowbaords', correct: 'snowboards' }, // transposed
    { query: 'waht are snowboards', correct: 'snowboards' }, // transposed 'what'
    { query: 'whta are snowboards', correct: 'snowboards' }, // transposed 'what'
    { query: 'wat r snowboards', correct: 'snowboards' }, // text speak
    { query: 'wut are snowboards', correct: 'snowboards' }, // phonetic
  ];

  test.each(typoQueries)('typo: "$query" → handles gracefully', async ({ query, correct }) => {
    const result = await testQuery(query, {
      mustNotContain: ['0 products', "couldn't find", "don't understand"]
    });

    // Should either correct the typo and respond appropriately
    // or ask for clarification politely
    const allText = result.pepTurn.segments
      .map(s => 'text' in s ? s.text : '')
      .join(' ')
      .toLowerCase();

    // Should handle it somehow - either definition or clarification
    const handledWell = allText.includes('board') || allText.includes('clarify') || allText.includes('help');
    expect(handledWell).toBe(true);
  });
});

describe('Edge Cases', () => {
  test('empty query: "" → handles gracefully', async () => {
    await testQuery('', {
      mustNotContain: ['0 products', 'error', 'undefined']
    });
  });

  test('numbers only: "123" → handles gracefully', async () => {
    await testQuery('123', {
      mustNotContain: ['0 products', 'error']
    });
  });

  test('special characters: "!!!" → handles gracefully', async () => {
    await testQuery('!!!', {
      mustNotContain: ['0 products', 'error']
    });
  });

  test('very long query → handles gracefully', async () => {
    const longQuery = 'I am looking for a snowboard that is good for beginners but also ' +
      'can handle advanced terrain when I improve and it should be under 500 dollars ' +
      'and preferably from a well known brand and it should be good for powder snow ' +
      'but also work on groomed runs and I want it to be durable and look cool';

    await testQuery(longQuery, {
      topic: 'commerce',
      mustNotContain: ['0 products', 'error']
    });
  });

  test('mixed languages: "snowboards por favor" → handles gracefully', async () => {
    await testQuery('snowboards por favor', {
      mustNotContain: ['0 products', 'error']
    });
  });

  test('all caps: "WHAT ARE SNOWBOARDS" → handles same as lowercase', async () => {
    await testQuery('WHAT ARE SNOWBOARDS', {
      topic: 'product_info',
      hasProducts: false,
      mustContain: ['board', 'snow'],
      mustNotContain: ['0 products']
    });
  });
});

describe('Negative Cases - Should NOT Trigger Commerce', () => {
  const nonCommerceQueries = [
    'how do snowboards work',
    'physics of snowboarding',
    'snowboarding techniques',
    'famous snowboarders',
    'snowboarding injuries',
    'is snowboarding dangerous',
    'snowboarding vs skiing',
    'can you snowboard in summer',
    'where was snowboarding invented',
    'who invented the snowboard'
  ];

  test.each(nonCommerceQueries)('non-commerce: "%s" → no products shown', async (query) => {
    await testQuery(query, {
      hasProducts: false,
      mustNotContain: ['17 solid', 'in stock', 'add to cart']
    });
  });
});

describe('Critical Regression Tests', () => {
  test('NEVER shows "We\'re a retail store with 0 products"', async () => {
    const allQueries = [
      'what do you sell',
      'tell me about your store',
      'what kind of store is this',
      'what products do you have',
      'what\'s your inventory'
    ];

    for (const query of allQueries) {
      await testQuery(query, {
        mustNotContain: ['retail store with 0 products', "We're a retail store."]
      });
    }
  });

  test('NEVER shows count without plural (17 solid snowboard)', async () => {
    const queries = ['what are snowboards', 'tell me about snowboards', 'snowboards'];

    for (const query of queries) {
      const result = await testQuery(query, {
        mustNotContain: ['17 solid snowboard', '14 solid snowboard']
      });

      // Check for malformed counts
      const allText = result.pepTurn.segments
        .map(s => 'text' in s ? s.text : '')
        .join(' ');

      // Should not have number + "solid" + singular noun
      expect(allText).not.toMatch(/\d+\s+solid\s+snowboard(?!s)/);
    }
  });

  test('NEVER returns generic "Let me help you with that" for specific queries', async () => {
    const specificQueries = [
      'what are snowboards',
      'what do you sell',
      'shipping policy',
      'return policy'
    ];

    for (const query of specificQueries) {
      await testQuery(query, {
        mustNotContain: ['let me help you with that']
      });
    }
  });
});
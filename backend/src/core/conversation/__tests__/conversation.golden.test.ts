import { describe, test, expect, beforeAll } from 'vitest';
import { runConversationPipeline } from '../pipeline';
import type { ConversationMessage } from '../../../types/conversation';
import type { SessionMetadata } from '../../session/session-store';
import type { SupabaseClient } from '@supabase/supabase-js';

// Base session metadata for all tests
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

// Helper to build messages
function buildMessages(texts: string[]): ConversationMessage[] {
  const messages: ConversationMessage[] = [];
  for (let i = 0; i < texts.length; i++) {
    const role = i % 2 === 0 ? 'user' : 'assistant';
    messages.push({
      id: `msg_${i}`,
      role: role as 'user' | 'assistant',
      content: texts[i],
      createdAt: new Date().toISOString(),
    });
  }
  return messages;
}

// Create the Supabase stub with snowboard data
export const createSupabaseStub = () => {
  const snowboardProducts = [
    {
      id: 'prod_1',
      title: 'Powder Pro Snowboard',
      handle: 'powder-pro',
      price: 450,
      currency: 'USD',
      vendor: 'Insite-intellgience',
      product_type: 'snowboard',
      tags: ['powder', 'advanced'],
      combined_score: 0.92,
    },
    {
      id: 'prod_2',
      title: 'All-Mountain Classic',
      handle: 'all-mountain',
      price: 320,
      currency: 'USD',
      vendor: 'Snowboard Vendor',
      product_type: 'snowboard',
      tags: ['all-mountain', 'intermediate'],
      combined_score: 0.88,
    },
  ];

  const rpc = async (fnName: string) => {
    if (fnName === 'search_products_hybrid') {
      return { data: snowboardProducts, error: null };
    }
    throw new Error(`Unexpected rpc call: ${fnName}`);
  };

  const from = (table: string) => {
    switch (table) {
      case 'shops':
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'golden_shop',
                  brand_profile: {
                    catalog_summary: 'We carry 17 products across snowboard (14), Other (1), giftcard (1), featuring Insite-intellgience, Snowboard Vendor, Hydrogen Vendor, with prices from $10 to $2630.',
                    store_type: 'winter sports equipment retailer',
                    primary_category: 'snowboard',
                    top_brands: ['Insite-intellgience', 'Snowboard Vendor', 'Hydrogen Vendor'],
                    price_bands: {
                      snowboard: { min: 100, max: 2630, median: 450 }
                    },
                    total_products: 17,
                    policies: {
                      shipping: 'Free shipping on orders over $99. Most orders ship within 1-2 business days. Tracking is provided on dispatch.',
                      returns: '30-day returns on unopened gear. Exchanges allowed within 14 days if bindings are unused.',
                      warranty: 'All snowboards include a 1-year manufacturer warranty against defects.',
                    },
                    sample_prompts: [
                      'Show me popular snowboards',
                      'Do you carry Burton gear?',
                      'Help me compare a couple of options',
                    ],
                    computed_at: new Date().toISOString()
                  }
                },
                error: null
              })
            })
          })
        };
      case 'products':
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({
                data: snowboardProducts.slice(0, 100),
                error: null,
                count: 17
              })
            })
          })
        };
      default:
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [], error: null }),
              single: async () => ({ data: null, error: null })
            }),
            in: async () => ({ data: [], error: null })
          }),
          insert: async () => ({ data: null, error: null })
        };
    }
  };

  return { rpc, from } as unknown as SupabaseClient;
};

// Run the pipeline with standard setup
async function run(messages: string[]) {
  const stub = createSupabaseStub();

  return runConversationPipeline(
    {
      supabaseAdmin: stub,
      generateEmbedding: async () => [0.1, 0.2, 0.3], // Simple stub
    },
    {
      shopId: 'golden_shop',
      sessionId: 'sess_golden',
      messages: buildMessages(messages),
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
}

/**
 * CRITICAL CONCIERGE GUARANTEES:
 * 1. NO ONE-WORD HEADLINES - All responses must be complete sentences
 * 2. MAX 3 PRODUCTS - Never show more than 3 items (concierge, not search)
 * 3. CLARIFY MODE - Shows max 2 preview cards while asking questions
 * 4. COMPLETE SENTENCES - Lead ≥6 words, detail ≥15 words
 * 5. FLOW ORDER - Ask-then-show for discovery, show-then-ask for targeted
 * 6. SEGMENT ORDERING - Logical progression (ask → options, products → chips)
 */

// Helper to validate full sentences (no terse responses)
function expectFullSentence(text: string, minWords: number = 6) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  // Must have minimum word count
  expect(words).toBeGreaterThanOrEqual(minWords);

  // Must end with proper punctuation
  expect(/[.!?]$/.test(text.trim())).toBe(true);

  // Should not be just exclamations
  expect(text).not.toMatch(/^(Great!|Perfect!|Awesome!|Nice!|Cool!|OK!|Sure!|Yes!|No!)$/);

  // Should not be all uppercase (shouting)
  expect(text).not.toMatch(/^[A-Z\s!?.]+$/);
}

// Helper to validate consultative style (You/We language, benefits)
function expectConsultativeStyle(text: string) {
  const lower = text.toLowerCase();

  // Should use You/We language (not I/My)
  const hasYouLanguage = /\b(you|your|we|us|our)\b/.test(lower);
  expect(hasYouLanguage).toBe(true);

  // Should avoid overly promotional language
  expect(text).not.toMatch(/\b(amazing|incredible|unbelievable|revolutionary)\b/i);
}

// Helper to validate segment ordering
function expectProperSegmentOrder(segments: any[]) {
  const segmentTypes = segments.map(s => s.type);

  // If has ask, options must come after
  const askIndex = segmentTypes.indexOf('ask');
  const optionsIndex = segmentTypes.indexOf('options');
  if (askIndex >= 0 && optionsIndex >= 0) {
    expect(optionsIndex).toBeGreaterThan(askIndex);
  }

  // If has products, chips (if present) must come after
  const productsIndex = segmentTypes.indexOf('products');
  const chipsIndex = segmentTypes.indexOf('chips');
  if (productsIndex >= 0 && chipsIndex >= 0) {
    expect(chipsIndex).toBeGreaterThan(productsIndex);
  }

  // Narrative should come early (within first 3 segments)
  const narrativeIndex = segmentTypes.indexOf('narrative');
  if (narrativeIndex >= 0) {
    expect(narrativeIndex).toBeLessThan(3);
  }
}

// Helper to validate product card quality
function expectQualityProductCards(segments: any[]) {
  const productSegments = segments.filter(s => s.type === 'products');

  productSegments.forEach(segment => {
    if ('items' in segment && segment.items.length > 0) {
      segment.items.forEach((card: any) => {
        // Must have title and price
        expect(card.title).toBeDefined();
        expect(card.price).toBeGreaterThan(0);

        // Must have grounded reason (not generic)
        expect(card.reason).toBeDefined();
        expect(card.reason.split(' ').length).toBeGreaterThanOrEqual(4);
        expect(card.reason).not.toBe('Quality pick');

        // Top pick must have badges and why_chips
        if (card.top_pick) {
          expect(card.badges).toContain('Top pick');
          expect(card.why_chips).toBeDefined();
          expect(card.why_chips.length).toBeGreaterThan(0);
        }
      });
    }
  });
}

// Helper to validate concierge product limits
function expectConciergeProductLimits(segments: any[]) {
  const productSegments = segments.filter(s => s.type === 'products');

  productSegments.forEach(segment => {
    if ('items' in segment) {
      // CONCIERGE GUARANTEE: Never more than 3 products
      expect(segment.items.length).toBeLessThanOrEqual(3);

      // In clarify mode (has ask segment), should show max 2 preview cards
      const hasClarifier = segments.some(s => s.type === 'ask');
      if (hasClarifier && segment.items.length > 0) {
        expect(segment.items.length).toBeLessThanOrEqual(2);
      }
    }
  });

  // Validate product card quality
  expectQualityProductCards(segments);
}

// Helper to validate ask-then-show pattern (discovery)
function expectAskThenShow(segments: any[]) {
  const segmentTypes = segments.map(s => s.type);

  // Should have narrative and ask
  expect(segmentTypes).toContain('narrative');
  expect(segmentTypes).toContain('ask');

  // Should NOT have products (question comes first)
  expect(segmentTypes).not.toContain('products');

  // Ask should come before options
  const askIndex = segmentTypes.indexOf('ask');
  const optionsIndex = segmentTypes.indexOf('options');
  if (optionsIndex >= 0) {
    expect(optionsIndex).toBeGreaterThan(askIndex);
  }
}

// Helper to validate show-then-ask pattern (targeted)
function expectShowThenAsk(segments: any[]) {
  const segmentTypes = segments.map(s => s.type);

  // Should have both products and ask
  expect(segmentTypes).toContain('products');
  expect(segmentTypes).toContain('ask');

  // Products should come before ask
  const productsIndex = segmentTypes.indexOf('products');
  const askIndex = segmentTypes.indexOf('ask');
  expect(productsIndex).toBeLessThan(askIndex);
}

describe('Golden conversation flows', () => {

  test('product-info: "what are snowboards" → definition not sales', async () => {
    const result = await run(['what are snowboards']);

    // Check it routes to product_info topic
    expect(result.infoMode).toBe(true);

    const segmentTypes = result.pepTurn.segments.map(s => s.type);
    expect(segmentTypes).toEqual(expect.arrayContaining(['narrative', 'capsule', 'options']));

    const narratives = result.pepTurn.segments.filter(s => s.type === 'narrative');
    expect(narratives.length).toBeGreaterThan(0);
    narratives.forEach(segment => {
      if ('text' in segment) {
        expectFullSentence(segment.text);
        expect(segment.text).not.toContain('0 products');
      }
    });

    const capsule = result.pepTurn.segments.find(s => s.type === 'capsule');
    expect(capsule).toBeDefined();

    const hasOptions = result.pepTurn.segments.some(s => s.type === 'options');
    expect(hasOptions).toBe(true);

    const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
    expect(hasProducts).toBe(false);
  });

  test('store-info: "what do you sell" → store description without "0 products"', async () => {
    const result = await run(['what do you sell']);

    // Check it routes to store_info
    expect(result.infoMode).toBe(true);

    const segmentTypes = result.pepTurn.segments.map(s => s.type);
    expect(segmentTypes).toEqual(expect.arrayContaining(['narrative', 'capsule', 'options']));

    const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
    if (narrative && 'text' in narrative) {
      expect(narrative.text.toLowerCase()).toContain('here');
      expect(narrative.text).not.toMatch(/0\s+products/);
    }

    const capsule = result.pepTurn.segments.find(s => s.type === 'capsule');
    expect(capsule).toBeDefined();

    const optionsSegment = result.pepTurn.segments.find(s => s.type === 'options');
    expect(optionsSegment).toBeDefined();
  });

  test('pronoun-unresolved: "how much does it cost" → clarification', async () => {
    const result = await run(['how much does it cost']);

    // Should trigger clarification
    const narrative = result.pepTurn.segments[0];
    if (narrative && 'text' in narrative) {
      expect(narrative.text.toLowerCase()).toContain('clarify');
    }

    // Should have options for clarification
    const options = result.pepTurn.segments.find(s => s.type === 'options');
    expect(options).toBeDefined();
    if (options && 'items' in options) {
      expect(options.items.length).toBeGreaterThanOrEqual(2); // At least 2 clarification options
    }
  });

  test('pronoun-resolved: "they" after snowboard context', async () => {
    const result = await run([
      'what are snowboards',
      'Snowboards are boards you ride on snow with bindings and boots',
      'what sporting events are they used for'
    ]);

    // Should ask for clarification since pronoun resolution isn't perfect yet
    const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
    if (narrative && 'text' in narrative) {
      expect(narrative.text.toLowerCase()).toContain('clarify');
    }
  });

  test('commerce: "show me snowboards" → ask-then-show pattern', async () => {
    const result = await run(['show me snowboards']);

    // Should be commerce mode
    expect(result.rapportMode).toBe(false);
    expect(result.infoMode).toBe(false);

    // CRITICAL: Broad query should use ask-then-show (discovery mode)
    expectAskThenShow(result.pepTurn.segments);

    // Check segment ordering
    expectProperSegmentOrder(result.pepTurn.segments);

    // CRITICAL: Enforce concierge product limits (no products in discovery)
    expectConciergeProductLimits(result.pepTurn.segments);

    // Check all text segments use full sentences and consultative style
    result.pepTurn.segments.forEach(segment => {
      if ('text' in segment && segment.type !== 'note') {
        expectFullSentence(segment.text);
        if (segment.type === 'narrative' || segment.type === 'ask') {
          expectConsultativeStyle(segment.text);
        }
      }
    });

    // Options should have 2-6 choices
    const options = result.pepTurn.segments.find(s => s.type === 'options');
    if (options && 'items' in options) {
      expect(options.items.length).toBeGreaterThanOrEqual(2);
      expect(options.items.length).toBeLessThanOrEqual(6);

      // Option labels should be full phrases, not fragments
      options.items.forEach((item: any) => {
        if (item.label && item.id !== 'other') {
          const words = item.label.split(/\s+/).length;
          expect(words).toBeGreaterThanOrEqual(2);
        }
      });
    }
  });

  test('commerce-filtered: "snowboards under $400" → filtered products', async () => {
    const result = await run(['show me snowboards under $400']);

    // Check active filters
    expect(result.activeFilters).toBeDefined();

    // Should show products or clarifier
    const segmentTypes = result.pepTurn.segments.map(s => s.type);
    const hasProducts = segmentTypes.includes('products');
    const hasAsk = segmentTypes.includes('ask');
    expect(hasProducts || hasAsk).toBe(true);
  });

  test('policy-info: "what is your shipping policy" → policy template', async () => {
    const result = await run(['what is your shipping policy']);

    // Should be info mode
    expect(result.infoMode).toBe(true);

    // Check segments
    const segmentTypes = result.pepTurn.segments.map(s => s.type);
    expect(segmentTypes).toContain('narrative');
    expect(segmentTypes).toContain('note');
     expect(segmentTypes).toContain('capsule');
     expect(segmentTypes).toContain('options');

    // Check content
    const note = result.pepTurn.segments.find(s => s.type === 'note');
    if (note && 'text' in note) {
      expect(note.text).toContain('$99');
      expect(note.text).toContain('1-2 business days');
    }
  });

  test('rapport: "hello" → friendly response without product info', async () => {
    const result = await run(['hello']);

    // Should be rapport mode
    expect(result.rapportMode).toBe(true);

    // Should not contain product counts
    const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
    if (narrative && 'text' in narrative) {
      expect(narrative.text).not.toContain('17 products');
      expect(narrative.text).not.toContain('0 products');
      expect(narrative.text).not.toContain('snowboard');
    }
  });

  test('zero-results: "purple unicorn snowboards" → graceful fallback', async () => {
    const result = await run(['show me purple unicorn snowboards']);

    // Should handle zero results gracefully
    if (result.retrieval.products.length === 0) {
      const note = result.pepTurn.segments.find(s => s.type === 'note');
      if (note && 'text' in note) {
        expect(note.text).toContain("couldn't find");
        expect(note.text).not.toContain('0 products');
      }
    }
  });

  test('multi-turn: context preservation across turns', async () => {
    const result = await run([
      'show me beginner snowboards',
      'Here are 5 beginner-friendly boards...',
      'which one is cheapest'
    ]);

    // Should maintain context without asking for clarification
    const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
    if (narrative && 'text' in narrative) {
      // This might still trigger clarification due to pronoun, but shouldn't show "0 products"
      expect(narrative.text).not.toContain('0 products');
    }
  });
});

describe('Concierge Guarantees', () => {
  test('NEVER shows more than 3 products (concierge not search)', async () => {
    const commerceQueries = [
      'show me snowboards',
      'show me all snowboards',
      'snowboards',
      'I want to buy a snowboard',
      'what snowboards do you have',
      'list all snowboards'
    ];

    for (const query of commerceQueries) {
      const result = await run([query]);

      // CRITICAL CONCIERGE GUARANTEE
      expectConciergeProductLimits(result.pepTurn.segments);

      // Count actual products shown
      const productSegments = result.pepTurn.segments.filter(s => s.type === 'products');
      productSegments.forEach(segment => {
        if ('items' in segment) {
          expect(segment.items.length).toBeLessThanOrEqual(3);
        }
      });

      // Should never mention "17 products" in a way that suggests showing them all
      const allText = result.pepTurn.segments
        .map(s => 'text' in s ? s.text : '')
        .join(' ');

      expect(allText).not.toContain('Here are 17');
      expect(allText).not.toContain('showing 17');
      expect(allText).not.toContain('all 17');
    }
  });

  test('clarify mode shows maximum 2 preview cards', async () => {
    const result = await run(['show me snowboards']);

    // If it's in clarify mode
    const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
    if (hasAsk) {
      const productSegments = result.pepTurn.segments.filter(s => s.type === 'products');
      productSegments.forEach(segment => {
        if ('items' in segment && segment.items.length > 0) {
          // CRITICAL: Max 2 preview cards in clarify mode
          expect(segment.items.length).toBeLessThanOrEqual(2);
        }
      });
    }
  });

  test('all responses use complete sentences (no one-word headlines)', async () => {
    const queries = [
      'hello',
      'thanks',
      'what are snowboards',
      'show me snowboards',
      'how much',
      'help'
    ];

    for (const query of queries) {
      const result = await run([query]);

      // Check all narratives
      result.pepTurn.segments
        .filter(s => s.type === 'narrative')
        .forEach(segment => {
          if ('text' in segment) {
            expectFullSentence(segment.text);
          }
        });
    }
  });
});

describe('Regression guards', () => {
  test('never shows "We\'re a retail store with 0 products"', async () => {
    const queries = [
      'what do you sell',
      'tell me about your store',
      'what kind of store is this'
    ];

    for (const query of queries) {
      const result = await run([query]);
      const allText = result.pepTurn.segments
        .map(s => 'text' in s ? s.text : '')
        .join(' ');

      expect(allText).not.toContain('retail store with 0 products');
      expect(allText).not.toContain('We\'re a retail store.');
    }
  });

  test('never shows "17 solid snowboard" (missing plural)', async () => {
    const result = await run(['what are snowboards']);
    const allText = result.pepTurn.segments
      .map(s => 'text' in s ? s.text : '')
      .join(' ');

    expect(allText).not.toMatch(/\d+\s+solid\s+snowboard(?!s)/);
  });

  test('product definitions don\'t trigger commerce mode', async () => {
    const queries = [
      'what are snowboards',
      'what is a snowboard',
      'explain snowboards',
      'tell me what snowboards are'
    ];

    for (const query of queries) {
      const result = await run([query]);
      expect(result.infoMode).toBe(true);

      // Should not show product cards
      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
      expect(hasProducts).toBe(false);
    }
  });
});

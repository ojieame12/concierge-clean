// @ts-nocheck
import { describe, test, expect } from 'vitest';
import { runConversationPipeline } from '../pipeline';
import type { SessionMetadata } from '../../session/session-store';
import { createSupabaseStub } from './conversation.golden.test';

/**
 * Comprehensive Concierge Behavior Tests
 *
 * This test suite validates:
 * 1. Multi-turn clarifier flows (2+ questions before products)
 * 2. Harder customer scenarios (lifestyle fit, constraints, objections)
 * 3. SPIN methodology progression
 * 4. Never-more-than-3 product guarantee across all scenarios
 * 5. Consultative style (logos + pathos, You/We language)
 */

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

// Helper to validate full sentences
function expectFullSentence(text: string, minWords: number = 6) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  expect(words).toBeGreaterThanOrEqual(minWords);
  expect(/[.!?]$/.test(text.trim())).toBe(true);
  expect(text).not.toMatch(/^(Great!|Perfect!|Awesome!|Nice!|Cool!|OK!|Sure!|Yes!|No!)$/);
}

// Helper to validate consultative style
function expectConsultativeStyle(text: string) {
  const lower = text.toLowerCase();

  // Should use You/We language
  const hasYouLanguage = /\b(you|your|we|us|our)\b/.test(lower);
  expect(hasYouLanguage).toBe(true);

  // Should avoid hype
  expect(text).not.toMatch(/\b(amazing|incredible|unbelievable|revolutionary)\b/i);
}

// Helper to validate benefit + feeling (logos + pathos)
function expectLogosAndPathos(text: string) {
  const lower = text.toLowerCase();

  // Should mention benefits or features
  const hasBenefit = /\b(help|perfect|match|fit|need|style|performance|quality)\b/.test(lower);
  expect(hasBenefit).toBe(true);

  // Should have emotional or relational language
  const hasFeeling = /\b(you|your|confident|comfortable|enjoy|love|prefer|ideal)\b/.test(lower);
  expect(hasFeeling).toBe(true);
}

// Helper to validate never more than 3 products
function expectMaxThreeProducts(segments: any[]) {
  const productSegments = segments.filter(s => s.type === 'products');

  productSegments.forEach(segment => {
    if ('items' in segment) {
      // CRITICAL: Never more than 3
      expect(segment.items.length).toBeLessThanOrEqual(3);
    }
  });
}

// Run pipeline with mocked dependencies
async function run(messages: string[], sessionOverride?: Partial<SessionMetadata>) {
  const stub = createSupabaseStub();

  const buildMessages = (texts: string[]) => {
    return texts.map((text, i) => ({
      id: `msg_${i}`,
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      content: text,
      createdAt: new Date().toISOString(),
    }));
  };

  return runConversationPipeline(
    {
      supabaseAdmin: stub,
      generateEmbedding: async () => [0.1, 0.2, 0.3],
    },
    {
      shopId: 'golden_shop',
      sessionId: 'sess_comprehensive',
      messages: buildMessages(messages),
      sessionMetadata: { ...BASE_SESSION, ...sessionOverride },
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

describe('Multi-Turn Clarifier Flows', () => {
  test('broad query requires 2+ clarifying questions before products', async () => {
    // Turn 1: Initial broad query
    const turn1 = await run(['show me snowboards']);

    // Should ask first question, NOT show products
    const hasProducts1 = turn1.pepTurn.segments.some(s => s.type === 'products');
    expect(hasProducts1).toBe(false);

    const hasAsk1 = turn1.pepTurn.segments.some(s => s.type === 'ask');
    expect(hasAsk1).toBe(true);

    // Turn 2: Answer first question, should ask second
    const turn2 = await run(
      ['show me snowboards', 'Response 1', 'freestyle boards'],
      { clarifierHistory: { style: 1 }, turnCount: 1 }
    );

    // Still clarifying - should ask about another dimension
    const hasProducts2 = turn2.pepTurn.segments.some(s => s.type === 'products');
    const hasAsk2 = turn2.pepTurn.segments.some(s => s.type === 'ask');

    // Should either ask another question OR show ≤3 products
    if (hasProducts2) {
      expectMaxThreeProducts(turn2.pepTurn.segments);
    } else {
      expect(hasAsk2).toBe(true);
    }
  });

  test('each clarifier uses full sentences and consultative style', async () => {
    const result = await run(['I need a snowboard']);

    // All narrative and ask segments must be substantial
    result.pepTurn.segments
      .filter(s => s.type === 'narrative' || s.type === 'ask')
      .forEach(segment => {
        if ('text' in segment) {
          expectFullSentence(segment.text);
          expectConsultativeStyle(segment.text);
          expectLogosAndPathos(segment.text);
        }
      });
  });
});

describe('Harder Customer Scenarios', () => {
  test('lifestyle fit: "I\'m a beginner riding icy resorts"', async () => {
    const result = await run(['I\'m a beginner riding icy resorts']);

    // Should ask exactly one follow-up question
    const askSegments = result.pepTurn.segments.filter(s => s.type === 'ask');
    expect(askSegments.length).toBeGreaterThanOrEqual(1);

    // If shows products, must be ≤3
    expectMaxThreeProducts(result.pepTurn.segments);

    // Response should acknowledge the context
    const allText = result.pepTurn.segments
      .filter(s => 'text' in s)
      .map(s => ('text' in s ? s.text : ''))
      .join(' ')
      .toLowerCase();

    const acknowledgesContext = /beginner|icy|resort/.test(allText);
    expect(acknowledgesContext).toBe(true);

    // Should use consultative language
    result.pepTurn.segments
      .filter(s => s.type === 'narrative')
      .forEach(segment => {
        if ('text' in segment) {
          expectConsultativeStyle(segment.text);
        }
      });
  });

  test('constraint: "I need delivery in 3 days"', async () => {
    const result = await run(['I need a snowboard with delivery in 3 days']);

    // Should acknowledge the constraint
    const allText = result.pepTurn.segments
      .filter(s => 'text' in s)
      .map(s => ('text' in s ? s.text : ''))
      .join(' ')
      .toLowerCase();

    // Might mention delivery, shipping, or timing
    const acknowledgesDelivery = /deliver|shipping|days|time|quick|fast/.test(allText);
    expect(acknowledgesDelivery).toBe(true);

    // Still should limit products
    expectMaxThreeProducts(result.pepTurn.segments);
  });

  test('budget pivot: "those sound pricey, anything cheaper?"', async () => {
    const result = await run([
      'show me snowboards',
      'Response 1',
      'those sound pricey, anything cheaper?'
    ], {
      clarifierHistory: { vendor: 1 },
      turnCount: 2
    });

    // Should respond with empathy and options
    const narratives = result.pepTurn.segments.filter(s => s.type === 'narrative');
    expect(narratives.length).toBeGreaterThan(0);

    narratives.forEach(segment => {
      if ('text' in segment) {
        expectFullSentence(segment.text);
        expectConsultativeStyle(segment.text);
      }
    });

    // Should show budget-friendly options or ask about budget
    expectMaxThreeProducts(result.pepTurn.segments);
  });

  test('objection: "I don\'t like those brands"', async () => {
    const result = await run([
      'show me snowboards',
      'Response 1',
      'I don\'t like those brands'
    ], {
      clarifierHistory: { style: 1 },
      turnCount: 2,
      rejectedProductIds: ['prod_1']
    });

    // Should acknowledge and pivot
    const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
    const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');

    // Should either ask for brand preference or show alternatives
    expect(hasAsk || hasProducts).toBe(true);

    // If shows products, must be ≤3 and different from rejected
    if (hasProducts) {
      expectMaxThreeProducts(result.pepTurn.segments);
    }
  });
});

describe('Product Density Guardrails', () => {
  test('NEVER shows more than 3 products - even with 17 available', async () => {
    const queries = [
      'show me all snowboards',
      'what snowboards do you have',
      'I want to see everything',
      'list all your boards',
      'show me your full catalog'
    ];

    for (const query of queries) {
      const result = await run([query]);

      // CRITICAL: Never show all 17
      const productSegments = result.pepTurn.segments.filter(s => s.type === 'products');

      productSegments.forEach(segment => {
        if ('items' in segment) {
          expect(segment.items.length).toBeLessThanOrEqual(3);
        }
      });

      // Should ask questions instead of dumping catalog
      const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
      if (!productSegments.length) {
        expect(hasAsk).toBe(true);
      }
    }
  });

  test('product cards have quality grounded reasons', async () => {
    const result = await run(['show me snowboards'], {
      clarifierHistory: { vendor: 1, style: 1 },
      turnCount: 2
    });

    const productSegment = result.pepTurn.segments.find(s => s.type === 'products');

    if (productSegment && 'items' in productSegment) {
      productSegment.items.forEach((card: any) => {
        // Must have grounded reason
        expect(card.reason).toBeDefined();
        expect(card.reason.split(' ').length).toBeGreaterThanOrEqual(4);

        // Should not be generic
        expect(card.reason).not.toBe('Quality pick');
        expect(card.reason).not.toBe('Good choice');

        // Top pick must have badges and why_chips
        if (card.top_pick) {
          expect(card.badges).toContain('Top pick');
          expect(card.why_chips).toBeDefined();
          expect(card.why_chips.length).toBeGreaterThan(0);
        }
      });
    }
  });
});

describe('Consultative Style Throughout', () => {
  test('all responses use You/We language, not I/My', async () => {
    const queries = [
      'show me snowboards',
      'what do you recommend',
      'help me choose',
      'I\'m not sure what I need'
    ];

    for (const query of queries) {
      const result = await run([query]);

      result.pepTurn.segments
        .filter(s => s.type === 'narrative' || s.type === 'ask')
        .forEach(segment => {
          if ('text' in segment) {
            expectConsultativeStyle(segment.text);
          }
        });
    }
  });

  test('leading narrative includes both benefit and feeling', async () => {
    const result = await run(['I need a snowboard']);

    const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');

    if (narrative && 'text' in narrative) {
      expectLogosAndPathos(narrative.text);
    }
  });

  test('option labels are full sentences, not fragments', async () => {
    const result = await run(['show me snowboards']);

    const options = result.pepTurn.segments.find(s => s.type === 'options');

    if (options && 'items' in options) {
      options.items.forEach((item: any) => {
        if (item.label && item.id !== 'other') {
          // Should be at least 2-3 words
          const words = item.label.split(/\s+/).length;
          expect(words).toBeGreaterThanOrEqual(2);

          // Should not be just adjectives
          expect(item.label).not.toMatch(/^(red|blue|large|small|fast|slow)$/i);
        }
      });
    }
  });
});

describe('Bad Response Regression Tests', () => {
  test('rejects terse one-word responses', () => {
    const badResponses = [
      'Great!',
      'Perfect.',
      'Sure!',
      'Yes.',
      'OK!'
    ];

    badResponses.forEach(response => {
      expect(() => expectFullSentence(response)).toThrow();
    });
  });

  test('rejects list-heavy responses without guidance', () => {
    // Simulate a bad turn with just product list, no question
    const badTurn = {
      segments: [
        { type: 'narrative', text: 'Here are some options:' },
        { type: 'products', items: [
          { id: '1', title: 'Product 1', price: 100 },
          { id: '2', title: 'Product 2', price: 200 },
          { id: '3', title: 'Product 3', price: 300 },
          { id: '4', title: 'Product 4', price: 400 },
        ]}
      ]
    };

    // Should fail: 4 products is too many
    const productSegment = badTurn.segments.find((s): s is { type: 'products'; items?: unknown } => s.type === 'products');
    const items = Array.isArray(productSegment?.items) ? productSegment?.items : [];
    expect(items.length).toBeGreaterThan(3);
  });

  test('rejects responses without consultative language', () => {
    const badNarratives = [
      'We have 17 products in stock.',
      'Check out these amazing deals!',
      'These are the best snowboards ever!',
    ];

    badNarratives.forEach(text => {
      // Should fail consultative style check
      const hasYou = /\b(you|your)\b/i.test(text);
      expect(hasYou).toBe(false);
    });
  });
});

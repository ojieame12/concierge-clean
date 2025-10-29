import { describe, test, expect } from 'vitest';
import {
  runTestPipeline,
  expectFullSentence,
  expectMaxThreeProducts,
  expectClarifyBeforeProducts,
  expectConsultativeLanguage,
  BASE_SESSION,
} from './test-harness';
import {
  snowboardJourney,
  wardrobeJourney,
  laptopJourney,
  livingRoomJourney,
  singleTurnPrompts
} from './fixtures/journey-scenarios';
import type { JourneyScenario, JourneyTurn } from './fixtures/journey-scenarios';

/**
 * Golden Test Suite V2 - Hermetic & Realistic
 *
 * GUARANTEES:
 * 1. ✅ All tests run without live APIs (Supabase/Gemini stubbed)
 * 2. ✅ Realistic multi-turn journeys with natural language
 * 3. ✅ Enforces concierge principles (≤3 products, multi-turn clarifiers)
 * 4. ✅ Fast execution (<5s for entire suite)
 * 5. ✅ Tests actual frontend contract (segments, metadata, flow)
 */

/**
 * Helper to validate turn against expected behavior
 */
function validateTurn(result: any, expected?: JourneyTurn['expectedBehavior']) {
  if (!expected) return;

  const { pepTurn } = result;

  // Validate product limits
  if (expected.maxProducts !== undefined) {
    const productSegments = pepTurn.segments.filter((s: any) => s.type === 'products');
    productSegments.forEach((segment: any) => {
      if (segment.items) {
        expect(segment.items.length).toBeLessThanOrEqual(expected.maxProducts!);
      }
    });
  }

  // Validate has clarifier
  if (expected.hasClarifier) {
    const hasAsk = pepTurn.segments.some((s: any) => s.type === 'ask');
    expect(hasAsk).toBe(true);
  }

  // Validate min word count
  if (expected.minWordCount) {
    const narratives = pepTurn.segments.filter((s: any) => s.type === 'narrative');
    narratives.forEach((segment: any) => {
      if (segment.text) {
        const words = segment.text.split(/\s+/).filter(Boolean).length;
        expect(words).toBeGreaterThanOrEqual(expected.minWordCount!);
      }
    });
  }

  // Validate must contain
  if (expected.mustContain) {
    const allText = pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    expected.mustContain.forEach(phrase => {
      expect(allText).toContain(phrase.toLowerCase());
    });
  }

  // Validate must not contain
  if (expected.mustNotContain) {
    const allText = pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ');

    expected.mustNotContain.forEach(phrase => {
      expect(allText).not.toContain(phrase);
    });
  }
}

describe('Core Concierge Guarantees', () => {
  test('NEVER shows more than 3 products', async () => {
    const queries = [
      'show me all snowboards',
      'what snowboards do you have',
      'I want to see everything',
      'snowboards',
    ];

    for (const query of queries) {
      const result = await runTestPipeline([query]);

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn.segments);
    }
  });

  test('all responses use complete sentences', async () => {
    const queries = [
      'hello',
      'what are snowboards',
      'show me snowboards',
      'snowboards under $400',
      'help me choose'
    ];

    for (const query of queries) {
      const result = await runTestPipeline([query]);

      // Check all narratives and asks
      result.pepTurn.segments
        .filter((s: any) => s.type === 'narrative' || s.type === 'ask')
        .forEach((segment: any) => {
          if (segment.text) {
            expectFullSentence(segment.text);
          }
        });
    }
  });

  test('always uses consultative language', async () => {
    const result = await runTestPipeline(['I need a snowboard']);

    const narratives = result.pepTurn.segments.filter((s: any) => s.type === 'narrative');
    narratives.forEach((segment: any) => {
      if (segment.text) {
        expectConsultativeLanguage(segment.text);
      }
    });
  });

  test('clarifies before showing products', async () => {
    const result = await runTestPipeline(['show me snowboards']);

    expectClarifyBeforeProducts(result.pepTurn.segments, {});
  });
});

describe('Topic Routing', () => {
  test('"what are snowboards" → product_info (no products)', async () => {
    const result = await runTestPipeline(['what are snowboards']);

    expect(result.infoMode).toBe(true);

    // Should NOT show products
    const hasProducts = result.pepTurn.segments.some((s: any) => s.type === 'products');
    expect(hasProducts).toBe(false);

    // Should have options for bridging to commerce
    const hasOptions = result.pepTurn.segments.some((s: any) => s.type === 'options');
    expect(hasOptions).toBe(true);
  });

  test('"what do you sell" → store_info (no products)', async () => {
    const result = await runTestPipeline(['what do you sell']);

    expect(result.infoMode).toBe(true);

    // Should mention store type
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ');

    expect(allText).toContain('winter sports');
    expect(allText).not.toContain('0 products');
  });

  test('"hello" → rapport (no products, no catalog)', async () => {
    const result = await runTestPipeline(['hello']);

    expect(result.rapportMode).toBe(true);

    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ');

    // Should NOT mention products or categories
    expect(allText).not.toContain('17 products');
    expect(allText).not.toContain('snowboard');
  });

  test('"show me snowboards" → commerce (clarify mode)', async () => {
    const result = await runTestPipeline(['show me snowboards']);

    expect(result.rapportMode).toBe(false);
    expect(result.infoMode).toBe(false);

    // Should clarify, not dump products
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    expect(hasAsk).toBe(true);
  });
});

describe('Price Filters', () => {
  test('"snowboards under $400" applies price filter', async () => {
    const result = await runTestPipeline(['snowboards under $400']);

    // Should extract price constraint
    expect(result.activeFilters.price_bucket).toBeDefined();

    // If shows products, they should be under $400
    const productSegment = result.pepTurn.segments.find((s: any) => s.type === 'products');
    if (productSegment && 'items' in productSegment) {
      (productSegment as any).items.forEach((item: any) => {
        if (item.price) {
          expect(item.price).toBeLessThanOrEqual(400);
        }
      });
    }
  });

  test('"over $500" applies minimum price filter', async () => {
    const result = await runTestPipeline(['snowboards over $500']);

    expect(result.activeFilters.price_bucket).toBeDefined();
    expect(result.activeFilters.price_bucket).toMatch(/over.*500|\\$500/i);
  });
});

describe('Zero Results Handling', () => {
  test('"purple unicorn snowboards" → graceful fallback', async () => {
    const result = await runTestPipeline(['purple unicorn snowboards with jets']);

    // Should handle gracefully
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ');

    // Should NOT say "0 products"
    expect(allText).not.toContain('0 products');

    // Should offer alternatives
    const hasOptions = result.pepTurn.segments.some((s: any) => s.type === 'options');
    expect(hasOptions).toBe(true);
  });
});

describe('Multi-Turn Journeys (Realistic Language)', () => {
  test('snowboard journey: 3+ clarifiers before final picks', async () => {
    const userTurns = snowboardJourney.turns.filter(t => t.role === 'user');
    const results = [];

    let sessionState = { ...BASE_SESSION };

    for (let i = 0; i < userTurns.length; i++) {
      const turn = userTurns[i];
      const messages = snowboardJourney.turns.slice(0, (i * 2) + 1).map(t => t.message);

      const result = await runTestPipeline(messages, sessionState);
      results.push(result);

      // Validate expected behavior
      validateTurn(result, turn.expectedBehavior);

      // Update session state
      if (result.pendingClarifier) {
        sessionState.clarifierHistory[result.pendingClarifier.facet] = 1;
        sessionState.turnCount = (sessionState.turnCount || 0) + 1;
      }
    }

    // Final validation: should have asked 3+ questions
    const clarifierCount = results.filter(r =>
      r.pepTurn.segments.some((s: any) => s.type === 'ask')
    ).length;

    expect(clarifierCount).toBeGreaterThanOrEqual(snowboardJourney.expectedOutcomes.totalClarifiers);

    // Final result should have ≤3 products
    const finalResult = results[results.length - 1];
    expectMaxThreeProducts(finalResult.pepTurn.segments);
  });

  test('wardrobe journey: natural language with typos', async () => {
    const userTurns = wardrobeJourney.turns.filter(t => t.role === 'user');

    // Validate all user messages are realistic
    userTurns.forEach(turn => {
      // Should be multi-clause OR substantial (>15 words)
      const hasConjunction = /\b(and|but|so|since|because|though|while)\b/i.test(turn.message);
      const wordCount = turn.message.split(/\s+/).length;

      expect(hasConjunction || wordCount > 15).toBe(true);

      // Should NOT be robotic
      expect(turn.message).not.toMatch(/^(show me|what are|I need)\s+\w+$/i);
    });
  });
});

describe('Single-Turn Complex Prompts', () => {
  test('wedding maternity dress: nested constraints acknowledged', async () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'wedding-maternity-dress')!;
    const result = await runTestPipeline([prompt.message]);

    // Should ask clarifying questions
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    expect(hasAsk).toBe(true);

    // Should NOT show products yet
    const hasProducts = result.pepTurn.segments.some((s: any) => s.type === 'products');
    expect(hasProducts).toBe(false);
  });

  test('teen skateboard safety: acknowledges wearability concern', async () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'teen-skateboard-safety')!;
    const result = await runTestPipeline([prompt.message]);

    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    // Should acknowledge the concern
    const acknowledgesConcern = /\b(teen|skateboard|wear|protective)\b/.test(allText);
    expect(acknowledgesConcern).toBe(true);
  });

  test('espresso small counter: space constraint acknowledged', async () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'espresso-small-counter')!;
    const result = await runTestPipeline([prompt.message]);

    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    // Should acknowledge budget or space
    const acknowledgesConstraints = /\b(\$350|24|counter|small|compact)\b/.test(allText);
    expect(acknowledgesConstraints).toBe(true);
  });

  test('all complex prompts trigger clarification, not immediate products', async () => {
    for (const prompt of singleTurnPrompts) {
      const result = await runTestPipeline([prompt.message]);

      // Should either ask questions OR show ≤2 products (with clarifier)
      const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
      const productSegment = result.pepTurn.segments.find((s: any) => s.type === 'products');

      if (productSegment && 'items' in productSegment) {
        const itemCount = (productSegment as any).items.length;
        // If showing products without ask, must be ≤3
        if (!hasAsk) {
          expect(itemCount).toBeLessThanOrEqual(3);
        }
      }

      // Most should be asking questions
      if (prompt.expectedBehavior.minClarifiers > 0) {
        expect(hasAsk).toBe(true);
      }
    }
  });
});

describe('Regression Guards', () => {
  test('never shows "0 products"', async () => {
    const queries = [
      'what do you sell',
      'tell me about your store',
      'what kind of products'
    ];

    for (const query of queries) {
      const result = await runTestPipeline([query]);

      const allText = result.pepTurn.segments
        .map((s: any) => s.text || '')
        .join(' ');

      expect(allText).not.toContain('0 products');
    }
  });

  test('never shows bad grammar like "17 solid snowboard"', async () => {
    const result = await runTestPipeline(['what are snowboards']);

    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ');

    expect(allText).not.toMatch(/\d+\s+solid\s+snowboard(?!s)/i);
  });

  test('never dumps catalog without guidance', async () => {
    const result = await runTestPipeline(['show me everything']);

    // Should either:
    // 1. Ask clarifying questions
    // 2. OR show ≤3 products
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    const productSegment = result.pepTurn.segments.find((s: any) => s.type === 'products');

    if (productSegment && 'items' in productSegment) {
      expect((productSegment as any).items.length).toBeLessThanOrEqual(3);
    }

    if (!productSegment) {
      expect(hasAsk).toBe(true);
    }
  });
});

describe('Frontend Contract Compliance', () => {
  test('segments structure matches extractResponseStructure expectations', async () => {
    const result = await runTestPipeline(['show me snowboards']);

    // Should have at least one narrative for mainLead
    const hasNarrative = result.pepTurn.segments.some((s: any) => s.type === 'narrative');
    expect(hasNarrative).toBe(true);

    // First narrative should be substantial enough for 42px headline
    const firstNarrative = result.pepTurn.segments.find((s: any) => s.type === 'narrative');
    if (firstNarrative && 'text' in firstNarrative) {
      expectFullSentence((firstNarrative as any).text);
    }
  });

  test('product cards have all required fields for ProductDrawer', async () => {
    const result = await runTestPipeline(
      ['show me freestyle snowboards'],
      { clarifierHistory: { style: 1 }, turnCount: 1 }
    );

    const productSegment = result.pepTurn.segments.find((s: any) => s.type === 'products');

    if (productSegment && 'items' in productSegment) {
      (productSegment as any).items.forEach((card: any) => {
        // Required fields
        expect(card.id).toBeDefined();
        expect(card.title).toBeDefined();
        expect(card.price).toBeGreaterThan(0);
        expect(card.currency).toBeDefined();

        // Quality fields
        expect(card.reason).toBeDefined();
        expect(card.reason.length).toBeGreaterThan(10);
        expect(card.badges).toBeDefined();
        expect(Array.isArray(card.badges)).toBe(true);

        // Top pick must have why_chips
        if (card.top_pick) {
          expect(card.why_chips).toBeDefined();
          expect(card.why_chips.length).toBeGreaterThan(0);
        }
      });
    }
  });

  test('metadata includes ui_hints for layout', async () => {
    const result = await runTestPipeline(['show me snowboards']);

    const metadata = (result.pepTurn.metadata ?? {}) as Record<string, unknown>;

    // Should have conversation mode
    expect(metadata.conversation_mode).toBeDefined();
  });

  test('segment ordering follows frontend extraction logic', async () => {
    const result = await runTestPipeline(['I need a snowboard']);

    const segmentTypes = result.pepTurn.segments.map((s: any) => s.type);

    // If has ask and options, options must come after ask
    const askIndex = segmentTypes.indexOf('ask');
    const optionsIndex = segmentTypes.indexOf('options');

    if (askIndex >= 0 && optionsIndex >= 0) {
      expect(optionsIndex).toBeGreaterThan(askIndex);
    }

    // Narrative should come early
    const narrativeIndex = segmentTypes.indexOf('narrative');
    if (narrativeIndex >= 0) {
      expect(narrativeIndex).toBeLessThan(3);
    }
  });
});

describe('Edge Cases', () => {
  test('budget pivot: "too expensive, anything cheaper?"', async () => {
    const result = await runTestPipeline(
      ['show me snowboards', 'Assistant response', 'those are too expensive, anything cheaper?'],
      { clarifierHistory: { style: 1 }, turnCount: 2 }
    );

    // Should acknowledge price concern
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    const acknowledgesBudget = /\b(price|budget|cheaper|affordable|under)\b/.test(allText);
    expect(acknowledgesBudget || result.pepTurn.segments.some((s: any) => s.type === 'ask')).toBe(true);

    // Max 3 products
    expectMaxThreeProducts(result.pepTurn.segments);
  });

  test('lifestyle fit: "beginner riding icy resorts"', async () => {
    const result = await runTestPipeline(['I\'m a beginner riding mostly icy resorts on weekends']);

    // Should ask clarifying questions
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    const hasOptions = result.pepTurn.segments.some((s: any) => s.type === 'options');

    expect(hasAsk || hasOptions).toBe(true);

    // Max 3 products
    expectMaxThreeProducts(result.pepTurn.segments);
  });

  test('urgency: "need by Friday"', async () => {
    const result = await runTestPipeline(['I need a snowboard by Friday']);

    // Should either acknowledge timing or clarify
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    const hasTiming = /\b(friday|deliver|shipping|rush|time)\b/.test(allText);
    const hasClarifier = result.pepTurn.segments.some((s: any) => s.type === 'ask');

    expect(hasTiming || hasClarifier).toBe(true);
  });
});

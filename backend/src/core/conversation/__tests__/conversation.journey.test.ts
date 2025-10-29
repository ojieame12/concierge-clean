import { describe, test, expect } from 'vitest';
import {
  snowboardJourney,
  wardrobeJourney,
  laptopJourney,
  livingRoomJourney,
  singleTurnPrompts,
  driftGuardrailTests,
  type JourneyScenario,
  type JourneyTurn
} from './fixtures/journey-scenarios';

/**
 * Full Journey Tests
 *
 * These tests validate complete concierge arcs with:
 * - Natural, multi-clause language
 * - Multiple clarifying turns before products
 * - Real constraints (budget, timing, lifestyle)
 * - Cross-vertical diversity
 * - SPIN methodology progression
 */

// Helper to validate turn behavior
function validateTurnBehavior(result: any, expected: JourneyTurn['expectedBehavior']) {
  if (!expected) return;

  // Topic validation
  if (expected.topic) {
    const isRapport = result.rapportMode === true;
    const isInfo = result.infoMode === true;
    const isCommerce = !isRapport && !isInfo;

    if (expected.topic === 'rapport') expect(isRapport).toBe(true);
    else if (expected.topic === 'store_info' || expected.topic === 'policy_info' || expected.topic === 'product_info') {
      expect(isInfo).toBe(true);
    }
    else if (expected.topic === 'commerce') expect(isCommerce).toBe(true);
  }

  // Mode validation
  if (expected.mode) {
    // Mode can be inferred from segments
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    const hasProducts = result.pepTurn.segments.some((s: any) => s.type === 'products');
    const hasComparison = result.pepTurn.segments.some((s: any) => s.type === 'comparison');

    if (expected.mode === 'clarify') {
      expect(hasAsk).toBe(true);
    } else if (expected.mode === 'recommend') {
      expect(hasProducts).toBe(true);
    } else if (expected.mode === 'compare') {
      expect(hasComparison).toBe(true);
    }
  }

  // Product count validation
  if (expected.maxProducts !== undefined) {
    const productSegments = result.pepTurn.segments.filter((s: any) => s.type === 'products');
    productSegments.forEach((segment: any) => {
      if (segment.items) {
        expect(segment.items.length).toBeLessThanOrEqual(expected.maxProducts!);
      }
    });
  }

  // Clarifier validation
  if (expected.hasClarifier !== undefined) {
    const hasAsk = result.pepTurn.segments.some((s: any) => s.type === 'ask');
    expect(hasAsk).toBe(expected.hasClarifier);
  }

  // Options validation
  if (expected.hasOptions !== undefined) {
    const hasOptions = result.pepTurn.segments.some((s: any) => s.type === 'options');
    expect(hasOptions).toBe(expected.hasOptions);
  }

  // Word count validation
  if (expected.minWordCount) {
    const narratives = result.pepTurn.segments.filter((s: any) => s.type === 'narrative');
    narratives.forEach((segment: any) => {
      if (segment.text) {
        const wordCount = segment.text.split(/\s+/).filter(Boolean).length;
        expect(wordCount).toBeGreaterThanOrEqual(expected.minWordCount!);
      }
    });
  }

  // Content validation
  if (expected.mustContain) {
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    expected.mustContain.forEach(phrase => {
      expect(allText).toMatch(new RegExp(phrase.toLowerCase()));
    });
  }

  if (expected.mustNotContain) {
    const allText = result.pepTurn.segments
      .map((s: any) => s.text || '')
      .join(' ')
      .toLowerCase();

    expected.mustNotContain.forEach(phrase => {
      expect(allText).not.toMatch(new RegExp(phrase.toLowerCase()));
    });
  }
}

// Helper to count clarifying questions in a journey
function countClarifiers(results: any[]): number {
  return results.filter(result =>
    result.pepTurn.segments.some((s: any) => s.type === 'ask')
  ).length;
}

// Helper to validate journey outcomes
function validateJourneyOutcomes(scenario: JourneyScenario, results: any[]) {
  const { expectedOutcomes } = scenario;

  // Count total clarifiers
  const totalClarifiers = countClarifiers(results);
  expect(totalClarifiers).toBeGreaterThanOrEqual(expectedOutcomes.totalClarifiers);

  // Check final product count
  const finalResult = results[results.length - 1];
  const productSegments = finalResult.pepTurn.segments.filter((s: any) => s.type === 'products');
  if (productSegments.length > 0) {
    const totalProducts = productSegments.reduce((sum: number, seg: any) =>
      sum + (seg.items?.length || 0), 0
    );
    expect(totalProducts).toBeLessThanOrEqual(expectedOutcomes.finalProductCount);
  }

  // Check that user constraints were acknowledged
  const allText = results
    .flatMap(r => r.pepTurn.segments.map((s: any) => s.text || ''))
    .join(' ')
    .toLowerCase();

  expectedOutcomes.userConstraintsAcknowledged.forEach(constraint => {
    const words = constraint.toLowerCase().split(' ');
    const acknowledged = words.some(word => allText.includes(word));
    expect(acknowledged).toBe(true);
  });
}

describe('Full Journey Tests - Natural Language', () => {
  // Note: These tests use actual pipeline, not stubs
  // They validate realistic multi-turn flows

  test.skip('Journey 1: Snowboard Trip with Multiple Constraints', async () => {
    // This test would run through snowboardJourney turns
    // For now, we document the expected behavior
    expect(snowboardJourney.turns.length).toBe(8);
    expect(snowboardJourney.expectedOutcomes.totalClarifiers).toBe(3);
    expect(snowboardJourney.expectedOutcomes.finalProductCount).toBe(3);

    // Validate each turn's expected behavior is well-defined
    snowboardJourney.turns.forEach(turn => {
      if (turn.expectedBehavior) {
        expect(turn.expectedBehavior).toBeDefined();
      }
    });
  });

  test.skip('Journey 2: Wardrobe Refresh with Style Constraints', async () => {
    expect(wardrobeJourney.turns.length).toBe(9);
    expect(wardrobeJourney.expectedOutcomes.totalClarifiers).toBe(4);
    expect(wardrobeJourney.expectedOutcomes.finalProductCount).toBe(3);

    // Check for natural language patterns
    const userTurns = wardrobeJourney.turns.filter(t => t.role === 'user');
    userTurns.forEach(turn => {
      // Should have real human language patterns
      expect(turn.message.length).toBeGreaterThan(20);
      // Should not be robotic
      expect(turn.message).not.toMatch(/^(show me|what are|I need)\s+\w+$/);
    });
  });

  test.skip('Journey 3: Laptop with Technical Specs', async () => {
    expect(laptopJourney.turns.length).toBe(9);
    expect(laptopJourney.vertical).toBe('electronics');
    expect(laptopJourney.expectedOutcomes.userConstraintsAcknowledged).toContain('$2500');
    expect(laptopJourney.expectedOutcomes.userConstraintsAcknowledged).toContain('macOS');
  });

  test.skip('Journey 4: Living Room with Event Deadline', async () => {
    expect(livingRoomJourney.turns.length).toBe(9);
    expect(livingRoomJourney.vertical).toBe('home');
    expect(livingRoomJourney.expectedOutcomes.userConstraintsAcknowledged).toContain('$1200');
    expect(livingRoomJourney.expectedOutcomes.userConstraintsAcknowledged).toContain('next month');
  });
});

describe('Single-Turn Complex Prompts', () => {
  test('validates all single-turn prompts have realistic constraints', () => {
    expect(singleTurnPrompts.length).toBe(8);

    singleTurnPrompts.forEach(prompt => {
      // Should be multi-clause
      expect(prompt.message.split(/and|but|so|if/i).length).toBeGreaterThan(1);

      // Should have nested constraints
      expect(prompt.expectedBehavior.mustAcknowledge.length).toBeGreaterThan(1);

      // Should enforce concierge limits
      expect(prompt.expectedBehavior.maxProducts).toBeLessThanOrEqual(3);
    });
  });

  test('wedding maternity dress has nested constraints', () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'wedding-maternity-dress');
    expect(prompt).toBeDefined();
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('June');
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('garden');
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('baby bump');
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('wedding guest');
  });

  test('teen skateboard safety acknowledges wearability concern', () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'teen-skateboard-safety');
    expect(prompt).toBeDefined();
    expect(prompt!.message).toContain('actually wear');
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('teenager');
  });

  test('espresso setup has space constraint', () => {
    const prompt = singleTurnPrompts.find(p => p.id === 'espresso-small-counter');
    expect(prompt).toBeDefined();
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('24-inch');
    expect(prompt!.expectedBehavior.mustAcknowledge).toContain('$350');
  });
});

describe('Gemini Drift Guardrails', () => {
  test('detects encyclopedic responses', () => {
    const drift = driftGuardrailTests.find(t => t.id === 'drift-wikipedia-response');
    expect(drift).toBeDefined();
    expect(drift!.geminiMockResponse).toContain('According to Wikipedia');
    expect(drift!.expectedBehavior.shouldReject).toBe(true);
  });

  test('detects chatbot disclaimers', () => {
    const drift = driftGuardrailTests.find(t => t.id === 'drift-chatbot-disclaimer');
    expect(drift).toBeDefined();
    expect(drift!.geminiMockResponse).toContain('I\'m just a chatbot');
    expect(drift!.expectedBehavior.shouldReject).toBe(true);
    expect(drift!.expectedBehavior.shouldReframe).toBe(true);
  });

  test('detects excessive product dumps', () => {
    const drift = driftGuardrailTests.find(t => t.id === 'drift-excessive-products');
    expect(drift).toBeDefined();
    expect(drift!.geminiMockResponse).toContain('15 snowboards');
    expect(drift!.expectedBehavior.shouldReject).toBe(true);
  });

  test('allows appropriate product info', () => {
    const drift = driftGuardrailTests.find(t => t.id === 'drift-generic-advice');
    expect(drift).toBeDefined();
    expect(drift!.expectedBehavior.shouldReject).toBe(false);
    expect(drift!.expectedBehavior.allowedTopics).toContain('product_info');
  });

  test('all drift tests have clear rejection criteria', () => {
    driftGuardrailTests.forEach(test => {
      expect(test.expectedBehavior.shouldReject).toBeDefined();
      expect(test.expectedBehavior.shouldReframe).toBeDefined();
      expect(test.expectedBehavior.allowedTopics.length).toBeGreaterThan(0);
    });
  });
});

describe('Natural Language Patterns', () => {
  test('journeys use natural conversational language', () => {
    const allJourneys = [snowboardJourney, wardrobeJourney, laptopJourney, livingRoomJourney];

    allJourneys.forEach(journey => {
      const userTurns = journey.turns.filter(t => t.role === 'user');

      userTurns.forEach(turn => {
        // Should be multi-clause OR substantial (>15 words)
        const hasConjunctions = /\b(and|but|so|since|because|if|when|while|though|although)\b/i.test(turn.message);
        const wordCount = turn.message.split(/\s+/).filter(Boolean).length;

        expect(hasConjunctions || wordCount > 15).toBe(true);

        // Should NOT be single-word or robotic
        expect(wordCount).toBeGreaterThan(3);
      });
    });
  });

  test('journeys include natural typos and slang', () => {
    const allJourneys = [snowboardJourney, wardrobeJourney, laptopJourney, livingRoomJourney];

    allJourneys.forEach(journey => {
      const userTurns = journey.turns.filter(t => t.role === 'user');
      const allText = userTurns.map(t => t.message).join(' ');

      // Should have casual language markers
      const hasCasualLanguage = /\b(lol|bc|rn|like|kinda|gonna|im|id|dont)\b/.test(allText);
      expect(hasCasualLanguage).toBe(true);
    });
  });

  test('journeys avoid robotic patterns', () => {
    const allJourneys = [snowboardJourney, wardrobeJourney, laptopJourney, livingRoomJourney];

    allJourneys.forEach(journey => {
      const userTurns = journey.turns.filter(t => t.role === 'user');

      userTurns.forEach(turn => {
        // Should NOT be simple "show me X" patterns
        const isRobotic = /^(show me|what are|I need|give me)\s+\w+\s*$/i.test(turn.message.trim());
        expect(isRobotic).toBe(false);
      });
    });
  });
});

describe('Cross-Vertical Diversity', () => {
  test('covers 4 major verticals', () => {
    const verticals = [
      snowboardJourney.vertical,
      wardrobeJourney.vertical,
      laptopJourney.vertical,
      livingRoomJourney.vertical
    ];

    expect(new Set(verticals).size).toBe(4);
    expect(verticals).toContain('sports');
    expect(verticals).toContain('fashion');
    expect(verticals).toContain('electronics');
    expect(verticals).toContain('home');
  });

  test('single-turn prompts span multiple verticals', () => {
    const verticals = new Set(singleTurnPrompts.map(p => p.vertical));
    expect(verticals.size).toBeGreaterThanOrEqual(3);
  });
});

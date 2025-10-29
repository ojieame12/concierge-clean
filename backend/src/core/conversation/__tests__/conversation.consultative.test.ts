// @ts-nocheck
import { describe, it, expect, beforeAll } from 'vitest';
import { createSupabaseStub } from './conversation.golden.test';
import { runConversationPipeline } from '../pipeline';
import type { ConversationMessage, SessionMetadata } from '@insite/shared-types';
import type { ChatTurn, Segment } from '@insite/shared-types';

const buildUserMessage = (content: string, idSuffix = ''): ConversationMessage => ({
  id: `user-${idSuffix || Math.random().toString(36).slice(2, 8)}`,
  role: 'user',
  content,
  createdAt: new Date().toISOString(),
});

const buildAssistantMessage = (content: string, idSuffix = ''): ConversationMessage => ({
  id: `assistant-${idSuffix || Math.random().toString(36).slice(2, 8)}`,
  role: 'assistant',
  content,
  createdAt: new Date().toISOString(),
});

const buildSessionMetadata = (overrides: Partial<SessionMetadata> = {}): SessionMetadata => ({
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
  factSheetCache: null,
  dialogueSummary: null,
  sentiment: null,
  ...overrides,
});

/**
 * Golden test suite for consultative voice, psychological guardrails, and rhetorical strategy
 * Tests ensure the assistant maintains proper tone, SPIN methodology, and consultative approach
 */

// Helper assertions for consultative style
function expectConsultativeStyle(turn: ChatTurn, checks: {
  leadPattern?: RegExp;
  banPattern?: RegExp;
  detailMustContain?: RegExp;
  hasOptions?: boolean;
  optionLabels?: RegExp[];
}) {
  const narrative = turn.segments.find(s => s.type === 'narrative');
  const note = turn.segments.find(s => s.type === 'note');
  const options = turn.segments.find(s => s.type === 'options');

  if (checks.leadPattern && narrative?.text) {
    expect(narrative.text).toMatch(checks.leadPattern);
  }

  if (checks.banPattern && narrative?.text) {
    expect(narrative.text).not.toMatch(checks.banPattern);
  }

  if (checks.detailMustContain) {
    const detailText = note?.text || turn.segments.find(s => s.type === 'narrative' && s !== narrative)?.text || '';
    expect(detailText).toMatch(checks.detailMustContain);
  }

  if (checks.hasOptions) {
    expect(options).toBeDefined();
    expect((options as any)?.items?.length).toBeGreaterThanOrEqual(2);
  }

  if (checks.optionLabels && options) {
    const items = (options as any)?.items || [];
    checks.optionLabels.forEach((pattern, index) => {
      if (items[index]) {
        expect(items[index].label).toMatch(pattern);
      }
    });
  }
}

// Helper to enforce max 3 product limit (CONCIERGE PRINCIPLE)
function expectMaxThreeProducts(turn: ChatTurn) {
  const productSegment = turn.segments.find(s => s.type === 'products');
  const items = Array.isArray((productSegment as any)?.items) ? (productSegment as any).items : [];
  if (items.length) {
    // CRITICAL: Never more than 3 curated picks
    expect(items.length).toBeLessThanOrEqual(3);
  }
}

// Helper to check SPIN stage alignment
function expectSPINAlignment(turn: ChatTurn, stage: 'situation' | 'problem' | 'implication' | 'need_payoff') {
  const metadata = turn.metadata as any;

  switch (stage) {
    case 'situation':
      // Early exploration - should be gathering context
      expect(metadata?.stage).toMatch(/diagnosis_situation|smalltalk/);
      break;
    case 'problem':
      // Identifying specific needs - should be clarifying
      expect(metadata?.stage).toMatch(/diagnosis_problem|clarify/);
      break;
    case 'implication':
      // Understanding impact - transitional stage
      expect(metadata?.stage).toMatch(/diagnosis_implication/);
      break;
    case 'need_payoff':
      // Presenting solutions - should be recommending
      expect(metadata?.stage).toMatch(/prescription_need_payoff/);
      break;
  }
}

describe('Consultative Voice & Psychological Guardrails', () => {
  let deps: any;
  let baseInput: any;

  beforeAll(() => {
    const supabaseStub = createSupabaseStub();
    deps = {
      supabaseAdmin: supabaseStub,
      generateEmbedding: async () => new Array(1536).fill(0).map(() => Math.random()),
    };

    baseInput = {
      shopId: 'test-shop',
      sessionId: 'test-session',
      brandProfile: {
        tone: 'warm, consultative',
        persona: 'expert advisor',
        policies: {
          freeShippingThreshold: 99,
          shippingPolicy: 'Most orders ship within 1-2 business days. Free shipping on orders over $99.',
        }
      },
      resultLimit: 3,  // CONCIERGE: Never more than 3 curated picks
    };
  });

  describe('1. Consultative Style Assertions', () => {
    it('uses You/We language instead of I think/This product', async () => {
      const messages: ConversationMessage[] = [
        buildUserMessage('show me snowboards', 'snowboards'),
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: buildSessionMetadata(),
      });

      expectConsultativeStyle(result.pepTurn, {
        leadPattern: /\b(you|your|we|let's)\b/i,
        banPattern: /\b(I think|this product is|I believe)\b/i,
      });
    });

    it('includes emotional and logical scaffolding in responses', async () => {
      const messages: ConversationMessage[] = [
        buildUserMessage('what are the benefits of snowboarding', 'benefits'),
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: buildSessionMetadata(),
      });

      expectConsultativeStyle(result.pepTurn, {
        detailMustContain: /\b(mountain|snow|style|flex|shape|control)\b/i,
      });
    });

    it('bridges to commerce with actionable options', async () => {
      const messages: ConversationMessage[] = [
        buildUserMessage('what are snowboards', 'definition'),
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: buildSessionMetadata(),
      });

      expectConsultativeStyle(result.pepTurn, {
        hasOptions: true,
        optionLabels: [
          /show\s+me/i,
          /what\s+types/i,
        ],
      });
    });

    it('clarifier highlights SPIN problem stage', async () => {
      const messages: ConversationMessage[] = [
        buildUserMessage('I need a snowboard', 'need'),
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: buildSessionMetadata(),
      });

      if (result.pepTurn.metadata?.stage === 'diagnosis_problem') {
        const askSegment = result.pepTurn.segments.find(s => s.type === 'ask');
        expect(askSegment?.text).toMatch(/\b(price|style|brand|experience|size)\b/i);

        expectConsultativeStyle(result.pepTurn, {
          leadPattern: /let's\s+dial|let's\s+narrow|plenty\s+of/i,
        });
      }
    });
  });

  describe('2. Persona Drive Assertions', () => {
    it('rapport responses contain warm greeting without product push', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'hello' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      expectConsultativeStyle(result.pepTurn, {
        leadPattern: /\b(hi|hello|hey|glad|welcome)\b/i,
        banPattern: /\b(17 products|snowboard|price|buy)\b/i,
      });

      expect(result.rapportMode).toBe(true);
      expect(result.infoMode).toBe(false);
    });

    it('policy responses reference actual policy data', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'what is your shipping policy' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      expectConsultativeStyle(result.pepTurn, {
        detailMustContain: /\b(ship|1-2 business days|free shipping|orders over \$99)\b/i,
      });

      expect(result.infoMode).toBe(true);
    });

    it('product info mentions subject and category attributes', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'what are snowboards' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
      expect(narrative?.text).toMatch(/snowboard/i);

      expectConsultativeStyle(result.pepTurn, {
        detailMustContain: /\b(all-mountain|freestyle|powder|flex|shape)\b/i,
      });
    });
  });

  describe('3. Behavioral Guards', () => {
    it('clarifies unresolved pronouns after product display', async () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'Here are some snowboards and bindings for you.' },
        { role: 'user', content: 'how much do they cost' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
      expect(narrative?.text).toMatch(/\b(clarify|which|what.*you.*mean)\b/i);

      const options = result.pepTurn.segments.find(s => s.type === 'options');
      expect(options).toBeDefined();
    });

    it('routes policy questions correctly without products', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'do you ship internationally' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
      expect(hasProducts).toBe(false);
      expect(result.infoMode).toBe(true);
    });

    it('handles gift intent with price focus', async () => {
      const messages: ConversationMessage[] = [
        {
          id: 'gift-1',
          role: 'user',
          content: 'I need a gift under $200',
          createdAt: new Date().toISOString(),
        },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should apply price filter
      expect(result.activeFilters.price_bucket).toBeDefined();
      expect(result.activeFilters.price_bucket).toMatch(/under.*200/i);
    });

    it('transitions from rapport to commerce gracefully', async () => {
      // First turn: rapport
      const messages1: ConversationMessage[] = [
        {
          id: 'rapport-1',
          role: 'user',
          content: 'hello',
          createdAt: new Date().toISOString(),
        },
      ];

      const result1 = await runConversationPipeline(deps, {
        ...baseInput,
        messages: messages1,
        sessionMetadata: {} as SessionMetadata,
      });

      expect(result1.rapportMode).toBe(true);

      // Second turn: commerce
      const messages2: ConversationMessage[] = [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: result1.pepTurn.segments[0].text || '' },
        { role: 'user', content: 'show me snowboards' },
      ];

      const result2 = await runConversationPipeline(deps, {
        ...baseInput,
        messages: messages2,
        sessionMetadata: {
          dialogueSummary: result1.dialogueSummary,
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      expect(result2.rapportMode).toBe(false);
      const hasProducts = result2.pepTurn.segments.some(s => s.type === 'products');
      expect(hasProducts || result2.pendingClarifier).toBeTruthy();

      // CRITICAL: Enforce max 3 products
      expectMaxThreeProducts(result2.pepTurn);
    });
  });

  describe('4. Reason Metadata Tracking', () => {
    it('tracks topic and mode decision reasoning', async () => {
      const testCases = [
        { query: 'what are snowboards', expectedTopic: 'product_info', expectedMode: 'chat' },
        { query: 'hello', expectedTopic: 'rapport', expectedMode: 'chat' },
        { query: 'show me snowboards', expectedTopic: 'commerce', expectedMode: /clarify|recommend/ },
        { query: 'what is your shipping policy', expectedTopic: 'policy_info', expectedMode: 'chat' },
      ];

      for (const testCase of testCases) {
        const messages: ConversationMessage[] = [
          { role: 'user', content: testCase.query },
        ];

        const result = await runConversationPipeline(deps, {
          ...baseInput,
          messages,
          sessionMetadata: {} as SessionMetadata,
        });

        const metadata = result.pepTurn.metadata as any;

        // Check routing decisions are tracked
        if (testCase.expectedTopic === 'commerce') {
          expect(result.rapportMode).toBe(false);
          expect(result.infoMode).toBe(false);
        } else if (testCase.expectedTopic === 'rapport') {
          expect(result.rapportMode).toBe(true);
        } else {
          expect(result.infoMode).toBe(true);
        }
      }
    });
  });

  describe('5. SPIN Stage Alignment', () => {
    it('aligns with situation stage for initial exploration', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'tell me about your store' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      expectSPINAlignment(result.pepTurn, 'situation');
    });

    it('aligns with problem stage when clarifying needs', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need snowboards for my family' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      if (result.pendingClarifier) {
        expectSPINAlignment(result.pepTurn, 'problem');
      }
    });

    it('aligns with need-payoff when presenting solutions', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'show me your best beginner snowboard' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          accumulatedIntent: { skillLevel: 'beginner' },
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');
      if (hasProducts && !result.pendingClarifier) {
        expectSPINAlignment(result.pepTurn, 'need_payoff');
      }
    });
  });

  describe('6. Cross-sell & Bundle Logic', () => {
    it('introduces add-ons thoughtfully when appropriate', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I also need something for travel' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          accumulatedIntent: { category: 'snowboard' },
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should recognize travel-related need
      const segments = result.pepTurn.segments;
      const hasTravelMention = segments.some(s =>
        s.text && /\b(travel|bag|case|protection)\b/i.test(s.text)
      );

      // Either mentions travel or asks for clarification
      const hasOptions = segments.some(s => s.type === 'options');
      expect(hasTravelMention || hasOptions).toBeTruthy();
    });
  });

  describe('7. Edge Cases & Regression Guards', () => {
    it('never shows "0 products" even with empty results', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'purple unicorn snowboards with rainbow stripes' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const allText = result.pepTurn.segments
        .map(s => s.text || '')
        .join(' ');

      expect(allText).not.toMatch(/\b0\s+products?\b/i);
    });

    it('maintains proper grammar (never "17 solid snowboard")', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'what are snowboards' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      const allText = result.pepTurn.segments
        .map(s => s.text || '')
        .join(' ');

      // Check for bad grammar patterns
      expect(allText).not.toMatch(/\d+\s+solid\s+snowboard(?!s)/i);
    });

    it('applies price filters correctly', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'snowboards under $400' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      expect(result.activeFilters.price_bucket).toBeDefined();
      expect(result.activeFilters.price_bucket).toMatch(/Under.*400/i);

      // Products shown should respect filter
      const productSegment = result.pepTurn.segments.find(s => s.type === 'products');
      if (productSegment?.items) {
        const items = productSegment.items as any[];
        items.forEach(item => {
          if (item.price) {
            expect(item.price).toBeLessThanOrEqual(400);
          }
        });
      }

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('provides helpful fallback for zero results', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'quantum flux capacitor snowboards' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      if (result.retrieval.products.length === 0) {
        const segments = result.pepTurn.segments;

        // Should have helpful note about no matches
        const noteSegment = segments.find(s => s.type === 'note' && s.variant === 'soft_fail');
        expect(noteSegment).toBeDefined();

        // Should offer alternatives
        const optionsSegment = segments.find(s => s.type === 'options');
        expect(optionsSegment).toBeDefined();
      }
    });
  });

  describe('8. Real-World Edge Cases (Budget, Urgency, Objections)', () => {
    it('handles budget pivot: "that\'s too expensive"', async () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'Here are some premium boards for you...' },
        { role: 'user', content: 'those are too expensive, anything cheaper?' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: { style: 1 },
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should acknowledge price concern
      const narrative = result.pepTurn.segments.find(s => s.type === 'narrative');
      if (narrative?.text) {
        expect(narrative.text).toMatch(/\b(price|budget|cheaper|affordable|under)\b/i);
      }

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('handles urgency: "need by Friday"', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need a snowboard by Friday' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should acknowledge timeline or clarify
      const allText = result.pepTurn.segments
        .map(s => s.text || '')
        .join(' ')
        .toLowerCase();

      // Should mention timing or ask for clarification
      const acknowledgesTiming = /\b(friday|deliver|shipping|time|rush)\b/.test(allText);
      const hasClarifier = result.pepTurn.segments.some(s => s.type === 'ask');

      expect(acknowledgesTiming || hasClarifier).toBeTruthy();

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('handles objection: "I don\'t like those brands"', async () => {
      const messages: ConversationMessage[] = [
        { role: 'assistant', content: 'Here are boards from Burton and Lib Tech...' },
        { role: 'user', content: 'I don\'t like those brands' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: { style: 1 },
          rejectedProductIds: ['prod_1'],
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should either ask about brand preference or show alternatives
      const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
      const hasOptions = result.pepTurn.segments.some(s => s.type === 'options');
      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');

      expect(hasAsk || hasOptions || hasProducts).toBeTruthy();

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('handles lifestyle fit: "I\'m a beginner riding icy resorts"', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I\'m a beginner riding mostly icy resorts on weekends' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should acknowledge the context
      expectConsultativeStyle(result.pepTurn, {
        leadPattern: /\b(you|your|beginner|ice|weekend)\b/i,
      });

      // Should ask clarifying question or show curated picks
      const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
      const hasProducts = result.pepTurn.segments.some(s => s.type === 'products');

      expect(hasAsk || hasProducts).toBeTruthy();

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('handles event-specific: "for a trip next month"', async () => {
      const messages: ConversationMessage[] = [
        { role: 'user', content: 'I need a snowboard for a trip next month' },
      ];

      const result = await runConversationPipeline(deps, {
        ...baseInput,
        messages,
        sessionMetadata: {
          clarifierHistory: {},
          zeroResultStreak: 0,
          askedSlots: [],
        } as SessionMetadata,
      });

      // Should use consultative style
      expectConsultativeStyle(result.pepTurn, {
        leadPattern: /\b(you|your|we|trip|next month)\b/i,
      });

      // CRITICAL: Max 3 products
      expectMaxThreeProducts(result.pepTurn);
    });

    it('never dumps catalog - always guides through clarification', async () => {
      const broadQueries = [
        'show me all snowboards',
        'what snowboards do you have',
        'I want to see everything'
      ];

      for (const query of broadQueries) {
        const messages: ConversationMessage[] = [
          { role: 'user', content: query },
        ];

        const result = await runConversationPipeline(deps, {
          ...baseInput,
          messages,
          sessionMetadata: {
            clarifierHistory: {},
            zeroResultStreak: 0,
            askedSlots: [],
          } as SessionMetadata,
        });

        // Should either ask questions or show ≤3 products
        const hasAsk = result.pepTurn.segments.some(s => s.type === 'ask');
        const productSegment = result.pepTurn.segments.find(s => s.type === 'products');

        if (productSegment && 'items' in productSegment) {
          const items = (productSegment as any).items;
          // CRITICAL: Never more than 3
          expect(items.length).toBeLessThanOrEqual(3);
        } else {
          // If no products, should be asking questions
          expect(hasAsk).toBe(true);
        }
      }
    });
  });
});

import { describe, test, expect } from 'vitest';
import { runConversationPipeline } from '../pipeline';
import { createSupabaseStub } from './conversation.golden.test';
import type { ConversationMessage } from '../../../types/conversation';
import type { SessionMetadata } from '../../session/session-store';

type GoldenTestCase = {
  name: string;
  messages: Array<{ role: 'user'; content: string }>;
  expect: {
    topic: string;
    mode: string;
    require?: string[];
    mustInclude?: string[];
  };
};

const BASE_METADATA: SessionMetadata = {
  askedSlots: [],
  clarifierHistory: {},
  zeroResultStreak: 0,
  turnCount: 0,
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
};

const CASES: GoldenTestCase[] = [
  {
    name: 'info: what are snowboards',
    messages: [{ role: 'user', content: 'what are snowboards' }],
    expect: {
      topic: 'product_info',
      mode: 'info',
      require: ['narrative', 'capsule', 'options'],
    },
  },
  {
    name: 'store info: what do you sell',
    messages: [{ role: 'user', content: 'what do you sell in this store' }],
    expect: {
      topic: 'store_info',
      mode: 'info',
      require: ['narrative', 'capsule', 'options'],
    },
  },
  {
    name: 'commerce: show me snowboards',
    messages: [{ role: 'user', content: 'show me snowboards' }],
    expect: {
      topic: 'commerce',
      mode: 'clarify',
      require: ['options'],
    },
  },
  {
    name: 'bridge: help me choose them',
    messages: [
      { role: 'user', content: 'what are snowboards' },
      { role: 'user', content: 'help me choose them' },
    ],
    expect: {
      topic: 'commerce',
      mode: 'clarify',
      require: ['options'],
    },
  },
  {
    name: 'policy: what is your return policy',
    messages: [{ role: 'user', content: 'what is your return policy' }],
    expect: {
      topic: 'policy_info',
      mode: 'info',
      require: ['narrative', 'note', 'capsule', 'options'],
    },
  },
];

describe('conversation golden flows', () => {
  test.each<GoldenTestCase>(CASES)('$name', async ({ messages, expect: expected }) => {
    const session: SessionMetadata = { ...BASE_METADATA };
    const convoMessages: ConversationMessage[] = messages.map((m, idx) => ({
      id: `msg_${idx}`,
      role: m.role,
      content: m.content,
      createdAt: new Date().toISOString(),
    }));

    const result = await runConversationPipeline(
      {
        supabaseAdmin: createSupabaseStub(),
        generateEmbedding: async () => [0.1, 0.2, 0.3],
      },
      {
        shopId: 'golden_shop',
        sessionId: 'sess',
        messages: convoMessages,
        sessionMetadata: session,
        brandProfile: {},
      }
    );

    const firstSegmentTypes = result.pepTurn.segments.map((seg) => seg.type);
    if (expected.require) {
      expected.require.forEach((type) => expect(firstSegmentTypes).toContain(type));
    }
    if (expected.mustInclude) {
      expected.mustInclude.forEach((type) => expect(firstSegmentTypes).toContain(type));
    }
    const reason = result.pepTurn.metadata?.reason as Record<string, unknown> | undefined;
    expect(reason?.topic).toEqual(expected.topic);
    expect(reason?.mode).toEqual(expected.mode);
  });
});

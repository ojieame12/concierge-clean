import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SessionMetadata } from '../../session/session-store';
import type { ConversationMessage } from '../../../types/conversation';

vi.mock('../template-copy', () => ({
  generateSmartTemplateCopy: vi.fn(),
}));

const categoryRows = [
  {
    category_key: 'snowboards',
    facet_priority: [],
    canonical_clarifiers: {
      style: [
        { label: 'Freeride', value: 'freeride' },
        { label: 'All-mountain', value: 'all_mountain' },
      ],
    },
  },
];

const retrievalPayload = [
  {
    product_id: 'prod_1',
    id: 'prod_1',
    title: 'Featherlight Freeride Snowboard',
    handle: 'featherlight-freeride',
    description: 'A super light freeride deck built for daily commuting and fun laps.',
    price: 180,
    currency: 'USD',
    vendor: 'Apex',
    product_type: 'Snowboard',
    tags: ['lightweight', 'beginner'],
    combined_score: 0.92,
    summary: {
      productId: 'prod_1',
      category: 'Snowboards',
      keyFeatures: ['Featherweight core keeps control effortless'],
      bestFor: ['City commuting'],
      useCases: ['Freeride'],
      crossSell: [],
      upsell: [],
    },
  },
];

const createSupabaseStub = () => {
  const rpc = vi.fn(async (fnName: string) => {
    if (fnName === 'search_products_hybrid') {
      return { data: retrievalPayload, error: null };
    }
    throw new Error(`Unexpected rpc call: ${fnName}`);
  });

  const categoryIn = vi.fn(async () => ({ data: categoryRows, error: null }));
  const categoryEq = vi.fn(() => ({ in: categoryIn }));
  const categorySelect = vi.fn(() => ({ eq: categoryEq }));

  const variantsIn = vi.fn(async () => ({ data: [], error: null }));
  const variantsSelect = vi.fn(() => ({ in: variantsIn }));

  const defaultSelect = vi.fn(() => ({
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  }));

  const insert = vi.fn().mockResolvedValue({ data: null, error: null });

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'category_taxonomy':
        return { select: categorySelect };
      case 'product_variants':
        return { select: variantsSelect };
      case 'shops':
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'shop_123',
                  brand_profile: {
                    catalog_summary: 'We carry winter sports gear featuring Apex.',
                    store_type: 'winter sports equipment retailer',
                    primary_category: 'snowboard',
                    top_brands: ['Apex'],
                    total_products: 17,
                    price_bands: {},
                    policies: {
                      shipping: 'Orders over $99 ship free and leave within 1-2 business days.',
                      returns: '30-day returns on unused gear, exchanges in 14 days.',
                    },
                    sample_prompts: [
                      'Show me popular snowboards',
                      'Do you carry Apex boards?',
                      'Help me compare a couple of options',
                    ],
                    computed_at: new Date().toISOString(),
                  },
                },
                error: null,
              }),
            }),
          }),
        };
      case 'products':
        return {
          select: () => ({
            eq: () => ({
              limit: async () => ({ data: retrievalPayload, error: null, count: 17 }),
            }),
          }),
        };
      default:
        return { select: defaultSelect, insert };
    }
  });

  return { rpc, from } as unknown as SupabaseClient;
};

const createSupabaseStubWithOntology = () => {
  const rpc = vi.fn(async (fnName: string) => {
    if (fnName === 'search_products_hybrid') {
      return { data: retrievalPayload, error: null };
    }
    throw new Error(`Unexpected rpc call: ${fnName}`);
  });

  const calculatorRows = [
    {
      calculator_id: 'cv_from_flow',
      config: {
        label: 'Valve flow coefficient',
        description: 'Computes Cv given flow, SG, and ΔP.',
      },
      ontology_version: 'v-test',
    },
  ];

  const canonRows = [
    {
      topic: 'Snowboard sizing overview',
      tags: ['snowboard', 'sizing'],
      assertions: ['Size between nose and chin, adjust for weight.'],
      caveats: [],
      citation: 'Snowboard Sizing Cheat Sheet',
      embedding: [0.1, 0.2, 0.3],
    },
  ];

  const from = (table: string) => {
    switch (table) {
      case 'category_taxonomy':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ in: vi.fn(async () => ({ data: categoryRows, error: null })) })),
          })),
        };
      case 'product_variants':
        return {
          select: vi.fn(() => ({ in: vi.fn(async () => ({ data: [], error: null })) })),
        };
      case 'shop_active_ontology':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({ data: { version: 'v-test' }, error: null })),
            })),
          })),
        };
      case 'shop_ontologies':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(async () => ({ data: { ontology: { attributes: [] } }, error: null })),
              })),
            })),
          })),
        };
      case 'shop_unit_rules':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(async () => ({ data: [], error: null })),
            })),
          })),
        };
      case 'product_knowledge_packs':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(async () => ({ data: [], error: null })),
              })),
            })),
          })),
        };
      case 'shop_canon_shards':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                limit: vi.fn(async () => ({ data: canonRows, error: null })),
              })),
            })),
          })),
        };
      case 'shop_calculator_registry':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(async () => ({ data: calculatorRows, error: null })),
          })),
        };
      case 'shops':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(async () => ({
                data: {
                  id: 'shop_123',
                  brand_profile: {
                    catalog_summary: 'Apex winter gear',
                    store_type: 'winter sports equipment retailer',
                    primary_category: 'snowboard',
                    top_brands: ['Apex'],
                    total_products: 17,
                    price_bands: {},
                    policies: {
                      shipping: 'Free shipping on orders over $99. Most orders ship within 1-2 business days.',
                      returns: '30-day returns on unused items.',
                    },
                    sample_prompts: [
                      'Show me popular snowboards',
                      'Do you carry Apex boards?',
                      'Help me compare a couple of options',
                    ],
                  },
                },
                error: null,
              })),
            })),
          })),
        };
      case 'products':
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              limit: vi.fn(async () => ({ data: retrievalPayload, error: null, count: 17 })),
            })),
          })),
        };
      default:
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(async () => ({ data: [], error: null })),
              single: vi.fn(async () => ({ data: null, error: null })),
            })),
            in: vi.fn(async () => ({ data: [], error: null })),
          })),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
    }
  };

  return { rpc, from } as unknown as SupabaseClient;
};

describe('runConversationPipeline integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('produces a cohesive concierge turn with offers and threshold prompts', async () => {
    const supabaseAdmin = createSupabaseStub();

    const embeddingMock = vi.fn().mockResolvedValue([0.25, 0.1, 0.05]);

    const { generateSmartTemplateCopy } = await import('../template-copy');
    const templateCopyMock = vi.mocked(generateSmartTemplateCopy);
    templateCopyMock.mockResolvedValue({
      lead: 'Here are the boards that match your request.',
      detail: 'Tap a card to dig into specs or let me know what to tweak.',
      templateId: 'test_template',
      usedFallback: false,
    });

    const { runConversationPipeline } = await import('../pipeline');

    const messages: ConversationMessage[] = [
      {
        id: 'msg_1',
        createdAt: new Date().toISOString(),
        role: 'user',
        content: 'Looking for a lightweight freeride board under $200',
      },
    ];

    const sessionMetadata: SessionMetadata = {
      askedSlots: [],
      clarifierHistory: {},
      zeroResultStreak: 0,
      turnCount: 0,
      lastTone: 'neutral',
      activeFilters: {
        style: 'freeride',
        price_bucket: 'Under $200',
      },
      pendingClarifier: null,
      manualClarifier: null,
      negotiationState: null,
      accumulatedIntent: { priceBucket: 'Under $200' },
      rejectedProductIds: [],
      acceptedProductIds: [],
    };

    const result = await runConversationPipeline(
      {
        supabaseAdmin,
        generateEmbedding: embeddingMock,
      },
      {
        shopId: 'shop_123',
        sessionId: 'sess_abc',
        messages,
        sessionMetadata,
        brandProfile: {
          tone: 'warm',
          policies: {
            freeShippingThreshold: 200,
            paymentOptions: ['Shop Pay', 'Afterpay'],
            guarantees: 'Lifetime edge tuning included.',
            returns: 'Free 30-day returns.',
          },
        },
      }
    );

    expect(templateCopyMock).toHaveBeenCalled();
    expect(supabaseAdmin.rpc).toHaveBeenCalledWith('search_products_hybrid', expect.objectContaining({
      p_shop: 'shop_123',
    }));

    const segmentTypes = result.pepTurn.segments.map((segment) => segment.type);
    const firstNarrativeIndex = segmentTypes.findIndex((type) => type === 'narrative');
    expect(firstNarrativeIndex).toBeGreaterThan(-1);
    const hasProducts = segmentTypes.includes('products');
    const hasAsk = segmentTypes.includes('ask');
    expect(hasProducts || hasAsk).toBe(true);
    expect(segmentTypes).toContain('note');
    expect(segmentTypes.filter((type) => type === 'offer')).toHaveLength(3);

    const productSegment = result.pepTurn.segments.find((segment) => segment.type === 'products');
    if (productSegment && productSegment.type === 'products') {
      expect(productSegment.items[0]?.id).toBe('prod_1');
    }

    expect(result.offersPresented).toEqual(expect.arrayContaining([
      'threshold_nudge',
      'offer_sweetener',
      'offer_anchor',
      'offer_risk',
    ]));

    expect(result.relaxationSteps).toHaveLength(0);
    expect(result.negotiationState).toBeNull();
    expect(result.metrics.turnCount).toBe(1);
    expect(result.pendingClarifier).toBeNull();
    expect(result.manualClarifier).toBeNull();
    expect(result.dialogueSummary).toBeTruthy();
  });

  it('injects calculator results and passes them to Gemini', async () => {
    const supabaseAdmin = createSupabaseStubWithOntology();

    const { config } = await import('../../../config');
    config.featureFlags.verticalPacks = true;

    const embeddingMock = vi.fn().mockResolvedValue([0.12, 0.18, 0.05]);

    const { generateSmartTemplateCopy } = await import('../template-copy');
    const templateCopyMock = vi.mocked(generateSmartTemplateCopy);
    templateCopyMock.mockResolvedValue({
      lead: 'Here is what I found.',
      detail: 'Numbers check out—pick the one that fits best.',
      templateId: 'test_template',
      usedFallback: false,
    });

    const { runConversationPipeline } = await import('../pipeline');

    const messages: ConversationMessage[] = [
      {
        id: 'msg_calc',
        createdAt: new Date().toISOString(),
        role: 'user',
        content: 'I need Cv for 12 gpm at 8 psi with SG 1.1. Show valves under $300.',
      },
    ];

    const sessionMetadata: SessionMetadata = {
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

    const result = await runConversationPipeline(
      {
        supabaseAdmin,
        generateEmbedding: embeddingMock,
      },
      {
        shopId: 'shop_calc',
        sessionId: 'sess_calc',
        messages,
        sessionMetadata,
        brandProfile: {},
      }
    );

    expect(templateCopyMock).toHaveBeenCalled();
    const metadataResults = result.pepTurn.metadata?.calculator_results as Array<{ outputs: Record<string, unknown> }> | undefined;
    expect(metadataResults).toBeTruthy();
    expect(metadataResults?.[0]?.outputs?.cv_required).toBeDefined();

    const firstSegment = result.pepTurn.segments[0];
    expect(firstSegment.type).toBe('narrative');
    const noteSegment = result.pepTurn.segments.find((segment) => segment.type === 'note');
    expect(noteSegment?.type).toBe('note');
    if (noteSegment && noteSegment.type === 'note') {
      // The pipeline now relaxes invalid price buckets by messaging the adjustment
      expect(noteSegment.text).toContain('Under $300');
      expect(noteSegment.text).toMatch(/cleared|relaxed/i);
    }
    expect(result.dialogueSummary).toBeTruthy();
  });
});

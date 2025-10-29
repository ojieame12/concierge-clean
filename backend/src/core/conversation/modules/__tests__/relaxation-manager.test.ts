import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RetrievalSet } from '../../conversation-policy';
import { applyRelaxation } from '../relaxation-manager';

const makeRetrieval = (products: Array<{ id: string; title?: string; handle?: string; combined_score?: number }>): RetrievalSet => ({
  products: products.map((product) => ({
    title: 'product',
    handle: 'handle',
    ...product,
  })),
  facets: new Map(),
});

const createSupabaseStub = () => {
  const variantsIn = vi.fn().mockResolvedValue({ data: [], error: null });
  const select = vi.fn().mockReturnValue({ in: variantsIn });
  const from = vi.fn().mockReturnValue({ select });
  const rpc = vi.fn().mockResolvedValue({ data: [], error: null });

  return {
    deps: {
      supabaseAdmin: {
        rpc,
        from,
      },
    },
    rpc,
  } as const;
};

describe('applyRelaxation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns original retrieval when results already exist', async () => {
    const initialRetrieval = makeRetrieval([{ id: '1', combined_score: 0.8 }]);
    const { deps, rpc } = createSupabaseStub();

    const outcome = await applyRelaxation({
      retrieval: initialRetrieval,
      filters: { price_bucket: 'Under $50' },
      deps,
      shopId: 'shop_1',
      lexicalQuery: 'query',
      embedding: [0.1],
      limit: 5,
    });

    expect(rpc).not.toHaveBeenCalled();
    expect(outcome.retrieval).toBe(initialRetrieval);
    expect(outcome.steps).toHaveLength(0);
    expect(outcome.undoOptions).toHaveLength(0);
    expect(outcome.filters).toEqual({ price_bucket: 'Under $50' });
  });

  it('drops restrictive filters until results appear', async () => {
    const initialRetrieval = makeRetrieval([]);
    const relaxedRetrievalPayload = [{
      product_id: 'p1',
      title: 'Relaxed Product',
      handle: 'relaxed-product',
      description: null,
      price: 55,
      currency: 'USD',
      vendor: 'Vendor',
      product_type: 'Board',
      tags: ['premium', 'city'],
      combined_score: 0.42,
      summary: null,
    }];

    const { deps, rpc } = createSupabaseStub();
    rpc.mockResolvedValueOnce({ data: relaxedRetrievalPayload, error: null });

    const outcome = await applyRelaxation({
      retrieval: initialRetrieval,
      filters: { price_bucket: 'Under $50', style: 'city' },
      deps,
      shopId: 'shop_1',
      lexicalQuery: 'query',
      embedding: [0.3],
      limit: 6,
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const rpcArgs = rpc.mock.calls[0];
    expect(rpcArgs[0]).toBe('search_products_hybrid');
    expect(rpcArgs[1]).toMatchObject({ p_shop: 'shop_1', p_limit: 6 });

    expect(outcome.retrieval.products).toHaveLength(1);
    expect(outcome.filters).toEqual({ style: 'city' });
    expect(outcome.steps).toHaveLength(1);
    expect(outcome.steps[0]).toMatchObject({ facet: 'price_bucket', previousValue: 'Under $50' });
    expect(outcome.undoOptions).toHaveLength(1);
    const firstNote = outcome.notes[0];
    if (firstNote?.type !== 'note') {
      throw new Error('Expected relaxation note');
    }
    expect(firstNote.text).toContain('widened the price range');
  });

  it('continues relaxing multiple facets when results stay empty', async () => {
    const initialRetrieval = makeRetrieval([]);
    const relaxedRetrievalPayload = [{
      product_id: 'p-final',
      title: 'Final Product',
      handle: 'final-product',
      price: 120,
      currency: 'USD',
      vendor: 'Brand',
      product_type: 'Board',
      tags: ['fresh'],
      combined_score: 0.31,
      summary: null,
    }];

    const { deps, rpc } = createSupabaseStub();
    rpc.mockResolvedValueOnce({ data: [], error: null });
    rpc.mockResolvedValueOnce({ data: relaxedRetrievalPayload, error: null });

    const outcome = await applyRelaxation({
      retrieval: initialRetrieval,
      filters: { price_bucket: 'Under $50', style: 'city' },
      deps,
      shopId: 'shop_1',
      lexicalQuery: 'query',
      embedding: [0.9],
      limit: 4,
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(outcome.retrieval.products).toHaveLength(1);
    expect(outcome.filters).toEqual({});
    expect(outcome.steps).toHaveLength(2);
    expect(outcome.steps.map((step) => step.facet)).toEqual(['price_bucket', 'style']);
    expect(outcome.undoOptions).toHaveLength(2);
    expect(outcome.notes).toHaveLength(2);
  });
});

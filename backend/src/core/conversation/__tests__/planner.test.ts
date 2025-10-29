import { describe, expect, it } from 'vitest';

import { planToolsForTurn } from '../planner';

describe('planToolsForTurn', () => {
  it('skips fact tool when no products', () => {
    const plan = planToolsForTurn({
      intent: 'find_product',
      products: [],
      message: 'hello',
      candidateFactIds: [],
      hasCachedFacts: false,
    });
    expect(plan).toEqual({ callFactTool: false });
  });

  it('calls fact tool when products are present', () => {
    const plan = planToolsForTurn({
      intent: 'find_product',
      products: [{
        id: 'prod_1',
        title: 'Any product',
        handle: 'any-product',
        summary: null,
        description: null,
        price: null,
        currency: null,
        image_url: null,
        product_type: null,
        vendor: null,
        tags: [],
        combined_score: null,
        variants: [],
      }],
      message: 'find me something',
      candidateFactIds: ['prod_1'],
      hasCachedFacts: false,
    });

    expect(plan).toEqual({ callFactTool: true });
  });

  it('skips fact tool when cached facts are fresh and match candidates', () => {
    const fetchedAt = new Date(Date.now() - 60_000).toISOString();
    const plan = planToolsForTurn({
      intent: 'find_product',
      products: [{
        id: 'prod_1',
        title: 'Cached product',
        handle: 'cached-product',
        summary: null,
        description: null,
        price: null,
        currency: null,
        image_url: null,
        product_type: null,
        vendor: null,
        tags: [],
        combined_score: null,
        variants: [],
      }],
      message: 'show me again',
      candidateFactIds: ['prod_1'],
      hasCachedFacts: true,
      recentFactCache: {
        productIds: ['prod_1'],
        fetchedAt,
      },
    });

    expect(plan).toEqual({ callFactTool: false });
  });

  it('calls fact tool when cache is stale', () => {
    const fetchedAt = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    const plan = planToolsForTurn({
      intent: 'find_product',
      products: [{
        id: 'prod_1',
        title: 'Old product',
        handle: 'old-product',
        summary: null,
        description: null,
        price: null,
        currency: null,
        image_url: null,
        product_type: null,
        vendor: null,
        tags: [],
        combined_score: null,
        variants: [],
      }],
      message: 'anything new?',
      candidateFactIds: ['prod_1'],
      hasCachedFacts: true,
      recentFactCache: {
        productIds: ['prod_1'],
        fetchedAt,
      },
    });

    expect(plan).toEqual({ callFactTool: true });
  });
});

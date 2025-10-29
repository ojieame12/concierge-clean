import { describe, expect, it } from 'vitest';

import { sanitizeFilters } from '../filter-sanitizer';
import type { RetrievalSet } from '../conversation-policy';

const retrieval: RetrievalSet = {
  products: [
    {
      id: 'prod_1',
      title: 'Sample Product',
      handle: 'sample',
      vendor: 'Skyline',
      product_type: 'Rental',
      tags: ['Loft'],
      price: 2900,
      currency: 'USD',
      image_url: null,
      combined_score: 0.9,
    },
  ],
  facets: new Map([
    ['vendor', new Set(['Skyline'])],
    ['product_type', new Set(['Rental'])],
  ]),
};

const defaultChoices = {
  price_bucket: [{ label: 'Under $50', value: 'Under $50' }],
} as any;

const canonicalClarifiers: Record<string, Array<{ label: string; value: string }>> = {
  vendor: [{ label: 'Skyline', value: 'Skyline' }],
};

describe('sanitizeFilters', () => {
  it('removes values not present in allowed sets', () => {
    const result = sanitizeFilters({
      activeFilters: { vendor: 'Unknown', price_bucket: 'Under $50' },
      canonicalClarifiers,
      retrieval,
      defaultChoices,
    });

    expect(result.filters).toEqual({ price_bucket: 'Under $50' });
    expect(result.removed).toEqual([{ facet: 'vendor', value: 'Unknown' }]);
  });

  it('keeps values when allowed set empty', () => {
    const result = sanitizeFilters({
      activeFilters: { custom_facet: 'Any' },
      canonicalClarifiers: {},
      retrieval,
      defaultChoices: {},
    });

    expect(result.filters.custom_facet).toBe('Any');
    expect(result.removed).toHaveLength(0);
  });
});

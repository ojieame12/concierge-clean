import { describe, expect, it } from 'vitest';

import { buildNarrativeSegments } from '../narrative-builder';
import type { Product } from '../types';
import type { ToneConfig } from '../tone-manager';

const config: ToneConfig = {
  allowUpsell: true,
  maxPreviewWords: 20,
  maxEvidenceBullets: 3,
  escalationThreshold: 4,
  phraseStyle: 'friendly',
};

const sampleProduct: Product = {
  id: 'prod_1',
  title: 'Sample Loft',
  handle: 'sample-loft',
  price: 2900,
  currency: 'USD',
  description: 'Spacious loft.',
  product_type: 'Rental',
  vendor: 'Skyline',
  tags: ['Loft'],
  combined_score: 0.9,
  variants: [],
  image_url: null,
  summary: null,
};

describe('buildNarrativeSegments', () => {
  it('includes evidence when fact sheets provided', async () => {
    const segments = await buildNarrativeSegments({
      tone: 'warm',
      userMessage: 'Looking for a loft',
      products: [sampleProduct],
      config,
      sessionId: 'sess',
      factSheets: [
        {
          id: 'prod_1',
          title: 'Sample Loft',
          price: 2900,
          currency: 'USD',
          summary: null,
          specs: { bedrooms: '2' },
          derived: {},
          evidence: [{ key: 'bedrooms', snippet: '2 bedrooms' }],
        },
      ],
    });

    expect(segments.some((segment) => segment.text.includes('2 bedrooms'))).toBe(true);
  });
});

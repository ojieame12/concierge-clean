import { describe, expect, it } from 'vitest';

import { buildGeminiPEPTurn } from '../gemini-renderer';
import type { Product } from '../types';

const product: Product = {
  id: 'prod_1',
  title: 'Sample Product',
  handle: 'sample-product',
  price: 120,
  currency: 'USD',
  description: 'Great for everyday use.',
  summary: null,
  product_type: 'Accessory',
  vendor: 'Insite',
  tags: ['Durable'],
  combined_score: 0.9,
  image_url: null,
  variants: [],
};

describe('buildGeminiPEPTurn', () => {
  it('uses fact sheet evidence for card reason', () => {
    const turn = buildGeminiPEPTurn({
      parsedTurn: {
        rawText: 'Final picks',
        stage: 'final',
        narrative: 'Here is what matches.',
        recommendations: [
          {
            productId: 'prod_1',
            rationale: ['Durable build'],
          },
        ],
        clarifier: undefined,
        suggestedFilters: [],
      },
      candidates: [product],
      metrics: { turnCount: 1, zeroResultCount: 0, repeatedClarifiers: 0 },
      factSheets: [
        {
          id: 'prod_1',
          title: 'Sample Product',
          price: 120,
          currency: 'USD',
          summary: null,
          specs: {},
          derived: {},
          evidence: [{ key: 'durability', snippet: 'Built with reinforced stitching' }],
        },
      ],
    });

    const productSegment = turn.segments.find((segment) => segment.type === 'products');
    expect(productSegment?.items?.[0]?.reason).toContain('reinforced stitching');
  });
});

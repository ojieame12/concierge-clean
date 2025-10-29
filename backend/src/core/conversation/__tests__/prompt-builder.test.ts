import { describe, expect, it } from 'vitest';

import { buildPromptSections } from '../prompt-builder';

describe('buildPromptSections', () => {
  it('builds prompt with facts and brand docs', () => {
    const result = buildPromptSections({
      system: 'You are the concierge.',
      brandDocs: { returns: '30-day returns' },
      factSheets: [
        {
          id: 'prod_1',
          title: 'Loft Apartment',
          price: 2900,
          currency: 'USD',
          summary: 'Downtown loft',
          specs: { bedrooms: '2', bathrooms: '2', square_feet: '1200' },
          derived: { spec_fill_rate: 0.67 },
          evidence: [{ key: 'bedrooms', snippet: '2 bedrooms' }],
        },
      ],
    });

    expect(result).toContain('PRODUCT_FACTS');
    expect(result).toContain('Loft Apartment');
    expect(result).toContain('square_feet=1200');
    expect(result).toContain('BRAND_DOCS');
    expect(result).toContain('returns: 30-day returns');
  });
});

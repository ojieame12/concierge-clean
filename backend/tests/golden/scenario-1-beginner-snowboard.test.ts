/**
 * Golden Test: Scenario 1 - Beginner Snowboard
 * 
 * User: "I need a beginner snowboard under $400"
 * Expected: Show 2-3 beginner boards, prioritize all-mountain, explain why
 */

import { describe, it, expect } from '@jest/globals';
import { mockProducts } from '../fixtures/products.fixture';
import { mockStoreCard } from '../fixtures/store-card.fixture';
import { rerank } from '../../src/core/ranking/reranker';
import { repairAndValidateChatTurn } from '../../src/core/conversation/schemas/response-schemas';

describe('Golden Test: Beginner Snowboard Under $400', () => {
  it('should return beginner boards under $400, ranked by fit', () => {
    // Arrange
    const query = 'beginner snowboard under $400';
    const priceRange = { max: 400 };
    const constraints = {
      skill_level: 'beginner',
    };

    // Act: Rerank products
    const ranked = rerank(mockProducts, {
      query,
      priceRange,
      constraints,
      priorityBrands: mockStoreCard.merchandising.priority_brands,
    });

    // Assert: Check ranking
    expect(ranked.length).toBeGreaterThan(0);
    expect(ranked.length).toBeLessThanOrEqual(5);

    // First result should be beginner board under $400
    const topResult = ranked[0];
    expect(topResult.attributes?.skill_level).toBe('beginner');
    expect(topResult.price).toBeLessThanOrEqual(400);

    // Should prioritize Burton (priority brand)
    const burtonBoards = ranked.filter(p => p.vendor === 'Burton');
    expect(burtonBoards.length).toBeGreaterThan(0);

    // Should not include advanced/expert boards
    const advancedBoards = ranked.filter(p => 
      p.attributes?.skill_level === 'advanced' || 
      p.attributes?.skill_level === 'expert'
    );
    expect(advancedBoards.length).toBe(0);

    // Should not include boards over $400
    const expensiveBoards = ranked.filter(p => p.price > 400);
    expect(expensiveBoards.length).toBe(0);
  });

  it('should validate response structure', () => {
    // Arrange: Mock LLM response
    const mockResponse = {
      segments: [
        {
          type: 'narrative',
          text: 'I found some great beginner snowboards under $400 for you!',
        },
        {
          type: 'products',
          items: [
            {
              id: 'prod-1',
              title: 'Beginner Snowboard - All Mountain',
              price: 299.99,
              currency: 'USD',
              image: 'https://example.com/image.jpg',
              vendor: 'Burton',
              reason: 'Perfect for beginners, forgiving flex, great reviews',
              why_chips: ['Beginner-friendly', 'Versatile', 'Great value'],
            },
          ],
        },
        {
          type: 'ask',
          text: 'What size board do you need?',
        },
        {
          type: 'options',
          items: [
            { id: 'opt-1', label: '150cm (for riders 5\'2"-5\'6")' },
            { id: 'opt-2', label: '155cm (for riders 5\'6"-5\'10")' },
            { id: 'opt-3', label: '160cm (for riders 5\'10"+)' },
          ],
        },
      ],
    };

    // Act: Validate
    const validated = repairAndValidateChatTurn(mockResponse);

    // Assert: Structure is valid
    expect(validated.segments).toHaveLength(4);
    expect(validated.segments[0].type).toBe('narrative');
    expect(validated.segments[1].type).toBe('products');
    expect(validated.segments[2].type).toBe('ask');
    expect(validated.segments[3].type).toBe('options');

    // Assert: Product has required fields
    const productSegment = validated.segments[1];
    if (productSegment.type === 'products') {
      expect(productSegment.items[0].id).toBeDefined();
      expect(productSegment.items[0].title).toBeDefined();
      expect(productSegment.items[0].price).toBeDefined();
      expect(typeof productSegment.items[0].price).toBe('number');
    }
  });

  it('should handle missing price with fallback', () => {
    // Arrange: Product without price but with variants
    const mockResponse = {
      segments: [
        {
          type: 'products',
          items: [
            {
              id: 'prod-missing',
              title: 'Product Without Price',
              // price: missing
              variants: [
                { id: 'var-1', title: 'Variant 1', price: 99.99 },
              ],
            },
          ],
        },
      ],
    };

    // Act: Repair and validate
    const validated = repairAndValidateChatTurn(mockResponse);

    // Assert: Price was filled from variant
    const productSegment = validated.segments[0];
    if (productSegment.type === 'products') {
      expect(productSegment.items[0].price).toBe(99.99);
    }
  });

  it('should filter out products without price or variants', () => {
    // Arrange: Product without price or variants
    const mockResponse = {
      segments: [
        {
          type: 'products',
          items: [
            {
              id: 'prod-valid',
              title: 'Valid Product',
              price: 99.99,
            },
            {
              id: 'prod-invalid',
              title: 'Invalid Product',
              // no price, no variants
            },
          ],
        },
      ],
    };

    // Act: Repair and validate
    const validated = repairAndValidateChatTurn(mockResponse);

    // Assert: Invalid product was filtered out
    const productSegment = validated.segments[0];
    if (productSegment.type === 'products') {
      expect(productSegment.items).toHaveLength(1);
      expect(productSegment.items[0].id).toBe('prod-valid');
    }
  });
});

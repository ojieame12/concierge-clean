/**
 * Golden Test: Scenario 3 - Store Intelligence
 * 
 * User: "What's your return policy?"
 * Expected: Accurate policy info from Store Card
 */

import { describe, it, expect } from '@jest/globals';
import { mockStoreCard } from '../fixtures/store-card.fixture';
import { formatStoreCardForPrompt } from '../../src/core/store-intelligence/prompt-formatter';

describe('Golden Test: Store Intelligence', () => {
  it('should format Store Card for Gemini prompt', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: Contains key information
    expect(formatted).toContain(mockStoreCard.store_name);
    expect(formatted).toContain(mockStoreCard.mission);
    expect(formatted).toContain('30 days'); // Return window
    expect(formatted).toContain('$75'); // Free shipping threshold
    expect(formatted).toContain('Patagonia'); // Priority brand

    // Assert: Contains brand voice
    expect(formatted).toContain('Friendly, knowledgeable, adventurous');
    expect(formatted).toContain('casual');
  });

  it('should include return policy details', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: Return policy is complete
    expect(formatted).toContain('Returns');
    expect(formatted).toContain('30 days');
    expect(formatted).toContain('Unused items in original packaging');
    expect(formatted).toContain('Safety equipment'); // Exception
  });

  it('should include shipping policy details', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: Shipping policy is complete
    expect(formatted).toContain('Shipping');
    expect(formatted).toContain('$75'); // Free threshold
    expect(formatted).toContain('$8.99'); // Standard cost
    expect(formatted).toContain('5-7'); // Standard days
    expect(formatted).toContain('$19.99'); // Expedited cost
    expect(formatted).toContain('2-3'); // Expedited days
  });

  it('should include warranty details', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: Warranty is complete
    expect(formatted).toContain('Warranty');
    expect(formatted).toContain('12 months'); // Standard
    expect(formatted).toContain('Backpacks'); // Lifetime category
    expect(formatted).toContain('Tents'); // Lifetime category
  });

  it('should include merchandising priorities', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: Merchandising info is included
    expect(formatted).toContain('Priority Brands');
    expect(formatted).toContain('Patagonia');
    expect(formatted).toContain('The North Face');
    expect(formatted).toContain('Arc\'teryx');
    expect(formatted).toContain('premium'); // Price positioning
  });

  it('should include FAQs', () => {
    // Act
    const formatted = formatStoreCardForPrompt(mockStoreCard, 'full');

    // Assert: FAQs are included
    expect(formatted).toContain('FAQs');
    expect(formatted).toContain('What is your return policy?');
    expect(formatted).toContain('Do you offer free shipping?');
    expect(formatted).toContain('What brands do you carry?');
  });

  it('should create compact format for conversation context', () => {
    // Act
    const compact = formatStoreCardForPrompt(mockStoreCard, 'compact');

    // Assert: Compact format is shorter
    expect(compact.length).toBeLessThan(formatStoreCardForPrompt(mockStoreCard, 'full').length);

    // Assert: Still contains essential info
    expect(compact).toContain(mockStoreCard.store_name);
    expect(compact).toContain('30 days'); // Return window
    expect(compact).toContain('$75'); // Free shipping
  });

  it('should validate Store Card structure', () => {
    // Assert: Required fields are present
    expect(mockStoreCard.store_name).toBeDefined();
    expect(mockStoreCard.domain).toBeDefined();
    expect(mockStoreCard.brand_voice).toBeDefined();
    expect(mockStoreCard.mission).toBeDefined();
    expect(mockStoreCard.policies).toBeDefined();
    expect(mockStoreCard.merchandising).toBeDefined();

    // Assert: Brand voice has required fields
    expect(mockStoreCard.brand_voice.personality).toBeDefined();
    expect(mockStoreCard.brand_voice.tone).toBeDefined();
    expect(mockStoreCard.brand_voice.formality).toBeDefined();

    // Assert: Policies have required fields
    expect(mockStoreCard.policies.returns).toBeDefined();
    expect(mockStoreCard.policies.shipping).toBeDefined();
    expect(mockStoreCard.policies.returns.window_days).toBeGreaterThan(0);
    expect(mockStoreCard.policies.shipping.free_threshold).toBeGreaterThan(0);
  });

  it('should handle minimal Store Card', () => {
    // Arrange
    const minimalCard = {
      store_name: 'Minimal Store',
      domain: 'minimal.com',
      brand_voice: {
        personality: 'Professional',
        tone: 'professional',
        formality: 'high',
        expertise_level: 'intermediate',
      },
      mission: 'Selling products',
      positioning: 'Mid-range',
      policies: {
        returns: {
          window_days: 30,
          conditions: 'Standard',
        },
        shipping: {
          free_threshold: 50,
          standard_cost: 5.99,
          standard_days: '3-5',
        },
      },
      merchandising: {
        priority_brands: [],
        price_positioning: 'mid-range',
        quality_focus: 'value',
      },
      categories: {
        primary: ['General'],
      },
      expertise_areas: [],
      customer_support: {
        hours: 'Mon-Fri 9-5',
        channels: ['email'],
        response_time: '24 hours',
      },
      faqs: [],
    };

    // Act
    const formatted = formatStoreCardForPrompt(minimalCard as any, 'full');

    // Assert: Should not crash, should contain basic info
    expect(formatted).toContain('Minimal Store');
    expect(formatted).toContain('30 days');
    expect(formatted).toContain('$50');
  });
});

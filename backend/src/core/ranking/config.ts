/**
 * Ranking Configuration
 * 
 * Default and category-specific ranking weights
 */

import type { RankingWeights, CategoryWeights } from './types';

/**
 * Default ranking weights
 * 
 * These weights determine how much each factor contributes to the final score:
 * - semanticSimilarity: How well the product matches the query semantically
 * - facetMatch: How many user constraints the product satisfies
 * - reviewQuality: Product rating weighted by review count
 * - priceFit: How close the price is to user's budget
 * - brandPriority: Boost for priority brands (from store merchandising)
 */
export const DEFAULT_WEIGHTS: RankingWeights = {
  semanticSimilarity: 0.30,
  facetMatch: 0.25,
  reviewQuality: 0.20,
  priceFit: 0.15,
  brandPriority: 0.10
};

/**
 * Category-specific weight overrides
 * 
 * Different product categories prioritize different factors:
 * - Shoes/apparel: Fit and reviews matter more than price
 * - Electronics: Specs (facets) and reviews are critical
 * - Snowboards: Skill level match and brand loyalty
 */
export const CATEGORY_WEIGHTS: CategoryWeights = {
  // Running shoes - fit and comfort are critical
  'running_shoes': {
    facetMatch: 0.35,        // Pronation, arch support, etc.
    reviewQuality: 0.25,     // Comfort feedback is crucial
    priceFit: 0.10,          // Less price-sensitive
    semanticSimilarity: 0.20
  },
  
  // Shoes (general)
  'shoes': {
    facetMatch: 0.35,
    reviewQuality: 0.25,
    priceFit: 0.10
  },
  
  // Electronics - specs matter
  'electronics': {
    semanticSimilarity: 0.25,
    facetMatch: 0.30,        // RAM, storage, screen size, etc.
    reviewQuality: 0.25,     // Quality and reliability
    priceFit: 0.20           // More price-sensitive
  },
  
  // Laptops
  'laptops': {
    facetMatch: 0.35,        // Specs are critical
    reviewQuality: 0.25,
    priceFit: 0.20,
    semanticSimilarity: 0.20
  },
  
  // Snowboards - skill level and style match
  'snowboards': {
    facetMatch: 0.35,        // Skill level, style (all-mountain, park, etc.)
    brandPriority: 0.15,     // Brand loyalty is strong
    priceFit: 0.15,
    reviewQuality: 0.20,
    semanticSimilarity: 0.15
  },
  
  // Apparel - fit and style
  'apparel': {
    facetMatch: 0.30,        // Size, material, style
    reviewQuality: 0.25,     // Fit feedback
    priceFit: 0.15,
    semanticSimilarity: 0.20,
    brandPriority: 0.10
  },
  
  // Furniture - quality and fit
  'furniture': {
    facetMatch: 0.30,        // Dimensions, material
    reviewQuality: 0.30,     // Quality is critical
    priceFit: 0.20,
    semanticSimilarity: 0.20
  }
};

/**
 * Get weights for a specific category
 * Falls back to default weights if no category-specific override exists
 */
export const getWeightsForCategory = (
  categoryPath: string[] | null,
  baseWeights: RankingWeights = DEFAULT_WEIGHTS
): RankingWeights => {
  if (!categoryPath || categoryPath.length === 0) {
    return baseWeights;
  }
  
  // Try exact match first
  const category = categoryPath[0].toLowerCase().replace(/\s+/g, '_');
  const categoryOverrides = CATEGORY_WEIGHTS[category];
  
  if (categoryOverrides) {
    return {
      ...baseWeights,
      ...categoryOverrides
    };
  }
  
  // Try partial matches
  for (const [key, overrides] of Object.entries(CATEGORY_WEIGHTS)) {
    if (category.includes(key) || key.includes(category)) {
      return {
        ...baseWeights,
        ...overrides
      };
    }
  }
  
  return baseWeights;
};

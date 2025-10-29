/**
 * Multi-Factor Product Re-Ranker
 * 
 * Improves search relevance by scoring products on multiple dimensions:
 * 1. Semantic similarity (from vector search)
 * 2. Facet match (constraint satisfaction)
 * 3. Review quality (rating × log(review_count))
 * 4. Price fit (distance from budget)
 * 5. Brand priority (merchandising preferences)
 */

import type { RankingContext, ScoredProduct, RankingWeights } from './types';
import { DEFAULT_WEIGHTS, getWeightsForCategory } from './config';

/**
 * Re-rank products using multi-factor scoring
 * 
 * @param products - Array of products to rank
 * @param context - Ranking context (query, constraints, weights)
 * @returns Sorted array of products (highest score first)
 */
export const rerankProducts = (
  products: any[],
  context: RankingContext
): any[] => {
  if (products.length === 0) {
    return products;
  }
  
  // Score all products
  const scored = products.map(product => scoreProduct(product, context));
  
  // Sort by score (descending)
  scored.sort((a, b) => b.score - a.score);
  
  // Return just the products
  return scored.map(s => s.product);
};

/**
 * Score a single product
 */
const scoreProduct = (product: any, context: RankingContext): ScoredProduct => {
  // Get category-specific weights
  const weights = getWeightsForCategory(product.category_path, context.weights);
  
  // Calculate individual scores
  // Use vendor or brand field (fallback for different data models)
  const vendorOrBrand = product.vendor ?? product.brand ?? null;
  
  const breakdown = {
    semantic: weights.semanticSimilarity * calculateSemanticScore(product),
    facet: weights.facetMatch * calculateFacetMatch(product, context.constraints),
    review: weights.reviewQuality * calculateReviewScore(product),
    price: weights.priceFit * calculatePriceFit(product.price, context.priceRange),
    brand: weights.brandPriority * calculateBrandScore(vendorOrBrand, context.priorityBrands)
  };
  
  // Total score
  const score = Object.values(breakdown).reduce((sum, val) => sum + val, 0);
  
  return {
    product,
    score,
    breakdown
  };
};

/**
 * Calculate semantic similarity score
 * Uses the combined_score from hybrid search (0-1)
 */
const calculateSemanticScore = (product: any): number => {
  // combined_score comes from hybrid search (vector + lexical)
  const score = product.combined_score || product.similarity || 0;
  
  // Ensure it's in 0-1 range
  return Math.max(0, Math.min(1, score));
};

/**
 * Calculate facet match score
 * Measures how many user constraints the product satisfies
 */
const calculateFacetMatch = (product: any, constraints: Record<string, any>): number => {
  if (!constraints || Object.keys(constraints).length === 0) {
    return 0.5; // Neutral score if no constraints
  }
  
  let matches = 0;
  let total = 0;
  
  for (const [key, value] of Object.entries(constraints)) {
    total++;
    
    // Handle price range
    if (key === 'price_range' || key === 'price_bucket') {
      const priceValue = value as { min?: number; max?: number };
      const productPrice = product.price || 0;
      
      const min = priceValue.min || 0;
      const max = priceValue.max || Infinity;
      
      if (productPrice >= min && productPrice <= max) {
        matches++;
      }
      continue;
    }
    
    // Handle direct attribute match
    if (product[key] === value) {
      matches++;
      continue;
    }
    
    // Handle nested attributes
    if (product.attributes && product.attributes[key] === value) {
      matches++;
      continue;
    }
    
    // Handle tags
    if (key === 'tag' && Array.isArray(product.tags)) {
      if (product.tags.includes(value)) {
        matches++;
      }
      continue;
    }
    
    // Handle category path
    if (key === 'category' && Array.isArray(product.category_path)) {
      if (product.category_path.some((cat: string) => 
        cat.toLowerCase().includes(value.toLowerCase())
      )) {
        matches++;
      }
      continue;
    }
  }
  
  // Return match rate (0-1)
  return total > 0 ? matches / total : 0.5;
};

/**
 * Calculate review quality score
 * Uses Bayesian average: rating × log(review_count + 1)
 * Normalized to 0-1 range
 */
const calculateReviewScore = (product: any): number => {
  const rating = product.rating || 0;
  const reviewCount = product.review_count || 0;
  
  if (rating === 0 && reviewCount === 0) {
    return 0.5; // Neutral for products with no reviews
  }
  
  // Bayesian average with confidence from review count
  // log(reviewCount + 1) gives more weight to products with many reviews
  const score = rating * Math.log(reviewCount + 1);
  
  // Normalize to 0-1 range
  // Assuming max is 5 stars × log(1000 reviews) ≈ 35
  const normalized = Math.min(score / 35, 1);
  
  return normalized;
};

/**
 * Calculate price fit score
 * Measures how close the price is to the user's budget
 * Higher score = closer to ideal price
 */
const calculatePriceFit = (
  price: number | null | undefined,
  priceRange?: { min?: number; max?: number }
): number => {
  if (!price || price === 0) {
    return 0.5; // Neutral for products without price
  }
  
  if (!priceRange) {
    return 0.5; // Neutral if no price preference
  }
  
  const hasMin = typeof priceRange.min === 'number';
  const hasMax = typeof priceRange.max === 'number';
  
  // Handle min-only case (e.g., "at least $100")
  if (hasMin && !hasMax) {
    const min = priceRange.min as number;
    if (price < min) {
      // Penalize items below minimum
      const penalty = (min - price) / min;
      return Math.max(0, 1 - penalty);
    }
    // Score from 0.7 at min to 1.0 at +25% over min, then taper to 0.8
    const t = Math.max(0, Math.min(1, (price - min) / (min * 0.25)));
    return 0.7 + 0.3 * t; // 0.7..1.0
  }
  
  // Handle max-only case (e.g., "under $500")
  if (!hasMin && hasMax) {
    const max = priceRange.max as number;
    if (price > max) {
      // Penalize items above maximum
      const penalty = (price - max) / max;
      return Math.max(0, 1 - penalty);
    }
    // Prefer prices a bit below max (sweet spot at 75% of max)
    const t = Math.max(0, Math.min(1, (max - price) / (max * 0.25)));
    return 0.7 + 0.3 * t; // 0.7..1.0
  }
  
  // Handle both bounds present
  const min = priceRange.min as number;
  const max = priceRange.max as number;
  
  // If out of range, penalize based on distance
  if (price < min || price > max) {
    const midpoint = (min + max) / 2;
    const distance = price < min ? min - price : price - max;
    const penalty = distance / midpoint;
    
    return Math.max(0, 1 - penalty);
  }
  
  // If in range, prefer closer to midpoint
  const midpoint = (min + max) / 2;
  const range = max - min;
  
  if (range === 0) {
    return 1; // Perfect match if min === max
  }
  
  const distanceFromMid = Math.abs(price - midpoint);
  const normalizedDistance = distanceFromMid / (range / 2);
  
  // Score decreases linearly from 1 (at midpoint) to 0.5 (at edges)
  return Math.max(0.5, 1 - (normalizedDistance * 0.5));
};

/**
 * Calculate brand priority score
 * Boosts products from priority brands (merchandising)
 */
const calculateBrandScore = (
  vendor: string | null | undefined,
  priorityBrands?: string[]
): number => {
  if (!priorityBrands || priorityBrands.length === 0) {
    return 0.5; // Neutral if no brand preferences
  }
  
  if (!vendor) {
    return 0; // Penalize products without vendor
  }
  
  // Check if vendor matches any priority brand (case-insensitive)
  const vendorLower = vendor.toLowerCase();
  const isPriority = priorityBrands.some(brand => 
    vendorLower.includes(brand.toLowerCase()) || 
    brand.toLowerCase().includes(vendorLower)
  );
  
  return isPriority ? 1 : 0;
};

/**
 * Get detailed scoring breakdown for debugging
 */
export const getScoreBreakdown = (
  product: any,
  context: RankingContext
): ScoredProduct => {
  return scoreProduct(product, context);
};

/**
 * Re-rank with custom weights (for A/B testing)
 */
export const rerankWithCustomWeights = (
  products: any[],
  context: Omit<RankingContext, 'weights'>,
  weights: RankingWeights
): any[] => {
  return rerankProducts(products, {
    ...context,
    weights
  });
};

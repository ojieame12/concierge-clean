/**
 * Ranking System Types
 * 
 * Multi-factor product ranking to improve relevance
 */

export interface RankingWeights {
  semanticSimilarity: number;
  facetMatch: number;
  reviewQuality: number;
  priceFit: number;
  brandPriority: number;
}

export interface RankingContext {
  query: string;
  constraints: Record<string, any>;
  weights: RankingWeights;
  priorityBrands?: string[];
  priceRange?: { min?: number; max?: number };
}

export interface ScoredProduct {
  product: any;
  score: number;
  breakdown: {
    semantic: number;
    facet: number;
    review: number;
    price: number;
    brand: number;
  };
}

export interface CategoryWeights {
  [category: string]: Partial<RankingWeights>;
}

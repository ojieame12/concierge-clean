import type { Product } from './types';

export interface ConversationContextSnapshot {
  intent: string;
  products: Product[];
  message: string;
  candidateFactIds: string[];
  hasCachedFacts: boolean;
  recentFactCache?: {
    productIds: string[];
    fetchedAt?: string;
  };
}

export interface ToolPlan {
  callFactTool: boolean;
}

const FACT_CACHE_TTL_MS = 5 * 60 * 1000;

const listsEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
};

const isFresh = (timestamp?: string) => {
  if (!timestamp) return false;
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= FACT_CACHE_TTL_MS;
};

export const planToolsForTurn = (snapshot: ConversationContextSnapshot): ToolPlan => {
  if (!snapshot.products.length) {
    return { callFactTool: false };
  }

  if (snapshot.hasCachedFacts) {
    const cache = snapshot.recentFactCache;
    if (cache && listsEqual(cache.productIds, snapshot.candidateFactIds) && isFresh(cache.fetchedAt)) {
      return { callFactTool: false };
    }
  }

  return { callFactTool: true };
};

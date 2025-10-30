import type { RetrievalSet } from './conversation-policy';
import type { SessionMetadata } from '../session/session-store';
import type { TurnMode, TurnTopic } from './template-copy';

// Concierge behavior: Always guide through clarifications to curate 1-3 perfect recommendations
export const SMALL_SET_CAP = 3; // Maximum products to show at once (concierge, not search)
export const ENTROPY_MIN = 0.3; // Lower threshold to encourage more clarifications
export const GROUNDABILITY_THRESHOLD = 0.35;
export const ALWAYS_CLARIFY_ABOVE = 3; // If more than 3 products match, ALWAYS clarify to narrow down

const INFO_PATTERNS = [
  /\bwhat\s+(is|are)\b/i,
  /\bdefine\b/i,
  /\bmeaning\b/i,
  /\bhow\s+does\b/i,
  /\bdifference\s+between\b/i,
  /\btypes?\s+of\b/i,
  /\btell\s+me\s+(what|about|how)/i,
  /\bused\s+for\b/i,
  /\bpurpose\s+of\b/i,
  /\bwhat\s+.*\s+for\b/i,
  /\bexplain\b/i,
  // Additional industry knowledge patterns
  /\bbenefits?\s+of\b/i,  // "benefits of snowboarding"
  /\badvantages?\s+of\b/i,  // "advantages of X"
  /\bdisadvantages?\s+of\b/i,  // "disadvantages of X"
  /\bpros?\s+(and|&)\s+cons?\b/i,  // "pros and cons"
  /\bhistory\s+of\b/i,  // "history of snowboards"
  /\borigin\s+of\b/i,  // "origin of snowboarding"
  /\binvented\b/i,  // "who invented snowboards"
  /\bchoose\s+the\s+(right|best|correct)\b/i,  // "how to choose the right X"
  /\bbeginner'?s?\s+guide/i,  // "beginner's guide"
  /\blearn(ing)?\s+(about|to)\b/i,  // "learning about/to snowboard"
  /\bmaintenance\b/i,  // "snowboard maintenance"
  /\bcare\s+(for|of)\b/i,  // "how to care for snowboards"
  /\bsafety\s+(tips?|guide|info)/i,  // "safety tips"
  /\btechniques?\b/i,  // "snowboarding techniques"
  /\bbasics?\s+of\b/i,  // "basics of snowboarding"
  /\bintroduction\s+to\b/i,  // "introduction to snowboards"
  /\bget\s+started\b/i,  // "how to get started"
  /\bfirst\s+time(r)?/i,  // "first time snowboarding"
];

const SHOPPING_PATTERNS = [
  /\bbuy\b/i,
  /\brecommend\b/i,
  /what.*recommend/i,  // "what do you recommend"
  /\bbest\b/i,
  /\btop\b/i,
  /looking for/i,
  /i need/i,
  /i want/i,
  /should.*get/i,  // "what should I get"
  /can.*get/i,  // "what can I get"
  /\bget\b.*\$?\d+/i,  // "get for $300"
  /under\s*\$?\d+/i,
  /over\s*\$?\d+/i,
  /for\s*\$\d+/i,
  /around\s*\$?\d+/i,
  /size|fit/i,
  /show.*everything/i,
  /show.*all/i,
  /\b(browse|see|view)\s+(all|everything|catalog)/i,
];

/**
 * Hard classification of user intent into topics
 * No overlap allowed - returns exactly one topic
 */
export function classifyTopic(message: string): TurnTopic {
  const normalized = message.trim().toLowerCase();

  // Rapport patterns (greetings, thanks, etc)
  const rapportPatterns = [
    /^(?:hi|hello|hey)(?:[!.,\s]|$)/,  // Allow comma after greeting
    /^good\s+(morning|afternoon|evening)/,
    /^thanks?(?:[!.\s]|$)/,
    /thank you/,
    /how are you/,
    /hows? it going/i,  // "how's it going"
    /nice to meet you/,
  ];

  if (rapportPatterns.some(pattern => pattern.test(normalized))) {
    return 'rapport';
  }

  // Policy patterns (shipping, returns, warranty)
  const policyPatterns = [
    /\b(shipping|ship|delivery)\s+(policy|cost|time|info)/,
    /\b(return|refund|exchange)\s+(policy|process|info)/,
    /\bwarranty\b/,
    /\b(how|when) do (you|i) (ship|return)/,
    /free shipping/,
  ];

  if (policyPatterns.some(pattern => pattern.test(normalized))) {
    return 'policy_info';
  }

  // Store info patterns (what do you sell, about the store)
  const storeInfoPatterns = [
    /what (do|does) (you|this store|the store) sell/,
    /what kind of (store|shop)/,
    /tell me about (this|the|your) store/,
    /what products do you/,
    /what categories/,
    /who are you/,
    /what are you as a store/,
  ];

  if (storeInfoPatterns.some(pattern => pattern.test(normalized))) {
    return 'store_info';
  }

  const looksInfo = INFO_PATTERNS.some(pattern => pattern.test(normalized));
  const hasShoppingIntent = SHOPPING_PATTERNS.some(pattern => pattern.test(normalized));

  // PRIORITY: If has price mention, it's commerce (even if looks like info)
  const hasPrice = /\$\d+|under\s+\d+|over\s+\d+|around\s+\d+|for\s+\d+/i.test(normalized);
  if (hasPrice) {
    return 'commerce';
  }

  // PRIORITY: If has shopping intent (recommend, buy, best), it's commerce
  // Even if it also looks like info (e.g., "what do you recommend")
  if (hasShoppingIntent) {
    return 'commerce';
  }

  if (looksInfo && !hasShoppingIntent) {
    return 'product_info';
  }

  // Everything else is commerce
  return 'commerce';
}

/**
 * Calculate groundability score (0-1) based on retrieval quality
 */
export function calculateGroundability(retrieval: RetrievalSet): number {
  if (!retrieval.products.length) {
    return 0;
  }

  // Factor 1: Top score quality
  const topScore = Math.max(0, Math.min(1, retrieval.products[0]?.combined_score ?? 0));

  // Factor 2: Coverage (how many good matches)
  const goodMatches = retrieval.products
    .slice(0, 6)
    .filter(p => (p.combined_score ?? 0) >= 0.35).length;
  const coverage = goodMatches / 6;

  // Factor 3: Score spread (consistency)
  const scores = retrieval.products.slice(0, 5).map(p => p.combined_score ?? 0);
  const spread = scores.length > 1
    ? Math.max(...scores) - Math.min(...scores)
    : 0;
  const consistency = spread < 0.3 ? 1 : 0.7;

  // Weighted combination
  return (topScore * 0.5) + (coverage * 0.3) + (consistency * 0.2);
}

/**
 * Calculate facet entropy to determine if it's worth asking
 */
export function calculateFacetEntropy(
  facet: string,
  values: Map<string, number>
): number {
  const total = Array.from(values.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return 0;

  let entropy = 0;
  values.forEach(count => {
    if (count > 0) {
      const probability = count / total;
      entropy -= probability * Math.log2(probability);
    }
  });

  return entropy;
}

/**
 * Find the best facet to ask about
 */
export function selectBestFacet(
  retrieval: RetrievalSet,
  askedFacets: Set<string>,
  sessionMetadata: SessionMetadata,
  userMessage?: string
): { facet: string; values: string[]; entropy: number } | null {
  const candidates: Array<{
    facet: string;
    values: string[];
    entropy: number;
  }> = [];

  retrieval.facets.forEach((values, facet) => {
    // Skip already asked facets
    if (askedFacets.has(facet)) return;

    // Skip facets with too few or too many values
    const uniqueValues = Array.from(values);
    if (uniqueValues.length < 2 || uniqueValues.length > 6) return;

    if (facet === 'vendor') {
      const vendorValues = retrieval.products.map((product) => product.vendor).filter(Boolean);
      const coverage = vendorValues.length / Math.max(retrieval.products.length, 1);
      const distinct = new Set(vendorValues).size;
      const userMentionedBrand = Boolean(sessionMetadata.accumulatedIntent?.selectedVendor)
        || Boolean(userMessage && /brand|vendor|^\s*@/.test(userMessage));
      const firstClarify = askedFacets.size === 0;
      if (coverage < 0.5 || distinct < 2 || (!userMentionedBrand && firstClarify)) {
        return;
      }
    }

    // For entropy calculation, assume uniform distribution
    // since we only have unique values, not counts
    const valueCounts = new Map<string, number>();
    uniqueValues.forEach(v => valueCounts.set(v, 1));

    // Calculate entropy
    const entropy = calculateFacetEntropy(facet, valueCounts);
    if (entropy < ENTROPY_MIN) return;

    candidates.push({
      facet,
      values: uniqueValues,
      entropy,
    });
  });

  // Return highest entropy facet
  candidates.sort((a, b) => b.entropy - a.entropy);
  return candidates[0] || null;
}

/**
 * Deterministic mode selection with hard gates
 * No fuzzy boundaries - exactly one mode per state
 */
export function pickMode(
  topic: TurnTopic,
  retrieval: RetrievalSet,
  sessionMetadata: SessionMetadata,
  userMessage?: string
): TurnMode {
  // Gate 1: Non-commerce topics always go to chat (info mode)
  // product_info allows Gemini to answer knowledge questions naturally
  if (topic === 'rapport' || topic === 'store_info' || topic === 'policy_info' || topic === 'product_info') {
    return 'chat';
  }

  // Gate 2: No products = dead end
  if (retrieval.products.length === 0) {
    return 'dead_end';
  }

  // Gate 3: Low groundability = chat (info mode)
  const groundability = calculateGroundability(retrieval);
  if (groundability < GROUNDABILITY_THRESHOLD) {
    return 'chat';
  }

  // CONCIERGE PRINCIPLE: Always clarify when we have too many options
  // This reduces decision fatigue and guides users to perfect matches
  if (retrieval.products.length > ALWAYS_CLARIFY_ABOVE) {
    // Try to find a good facet to narrow down
    const askedFacets = new Set(Object.keys(sessionMetadata.clarifierHistory || {}));
    const bestFacet = selectBestFacet(retrieval, askedFacets, sessionMetadata, userMessage);

    if (bestFacet) {
      return 'clarify';
    }
    // Even without a perfect facet, we should still clarify if we have too many options
    // Force clarification to prevent overwhelming the user
    return 'clarify';
  }

  // Gate 4: Perfect curation = recommend (1-3 items only)
  if (retrieval.products.length <= SMALL_SET_CAP && retrieval.products.length > 0) {
    return 'recommend';
  }

  // Gate 5: Check for comparison intent (only for small sets)
  const lastMessage = userMessage || '';
  const hasComparisonIntent = /\b(compare|versus|vs\.?|difference)/i.test(lastMessage);
  const isCompareAll = /compare\s+(all|them|these)/i.test(lastMessage);

  if (hasComparisonIntent && retrieval.products.length >= 2 && retrieval.products.length <= 3) {
    return 'compare';
  }

  // Gate 6: Try to find a good facet to ask for medium sets (4-5 items)
  const askedFacets = new Set(Object.keys(sessionMetadata.clarifierHistory || {}));
  const bestFacet = selectBestFacet(retrieval, askedFacets, sessionMetadata, userMessage);

  if (bestFacet && bestFacet.entropy >= ENTROPY_MIN) {
    return 'clarify';
  }

  // For 4-5 products, still clarify if possible
  if (retrieval.products.length > SMALL_SET_CAP) {
    return 'clarify';
  }

  // Default: Recommend only for truly small sets
  return 'recommend';
}

/**
 * Coherence gate - validate mode/content alignment
 * Returns corrected mode if incoherent
 */
export interface CoherenceCheck {
  mode: TurnMode;
  topic: TurnTopic;
  hasProducts: boolean;
  hasClarifier: boolean;
  hasComparison: boolean;
  productCount: number;
  clarifierOptions: number;
}

export function validateCoherence(check: CoherenceCheck): {
  valid: boolean;
  correctedMode?: TurnMode;
  reason?: string;
} {
  const { mode, topic, hasProducts, hasClarifier, hasComparison, productCount, clarifierOptions } = check;

  // Rule 1: Non-commerce topics should never have products/clarifiers
  if (topic !== 'commerce') {
    if (hasProducts || hasClarifier || hasComparison) {
      return {
        valid: false,
        correctedMode: 'chat',
        reason: 'Non-commerce topic cannot have products or clarifiers',
      };
    }
  }

  // Rule 2: Clarify mode must have valid clarifier
  if (mode === 'clarify') {
    if (!hasClarifier || clarifierOptions < 2 || clarifierOptions > 6) {
      return {
        valid: false,
        correctedMode: 'recommend',
        reason: 'Clarify mode requires 2-6 clarifier options',
      };
    }
    // Clarify should show at most 2 preview cards
    if (productCount > 2) {
      return {
        valid: false,
        correctedMode: 'recommend',
        reason: 'Clarify mode should show at most 2 preview cards',
      };
    }
  }

  // Rule 3: Recommend mode should not have clarifiers
  if (mode === 'recommend') {
    if (hasClarifier) {
      return {
        valid: false,
        correctedMode: 'clarify',
        reason: 'Recommend mode cannot have clarifiers',
      };
    }
    if (productCount === 0) {
      return {
        valid: false,
        correctedMode: 'dead_end',
        reason: 'Recommend mode requires at least 1 product',
      };
    }
    // CONCIERGE: Maximum 3 items for recommendations
    if (productCount > 3) {
      return {
        valid: false,
        correctedMode: 'clarify',
        reason: 'Concierge service: Too many products, should clarify to curate 1-3 perfect matches',
      };
    }
  }

  // Rule 4: Compare mode requires comparison segment
  if (mode === 'compare') {
    if (!hasComparison) {
      return {
        valid: false,
        correctedMode: 'recommend',
        reason: 'Compare mode requires comparison segment',
      };
    }
  }

  // Rule 5: Dead end should have no products
  if (mode === 'dead_end') {
    if (hasProducts) {
      return {
        valid: false,
        correctedMode: 'recommend',
        reason: 'Dead end cannot show products',
      };
    }
  }

  // Rule 6: Chat mode in commerce topic needs groundability check
  if (mode === 'chat' && topic === 'commerce') {
    if (productCount > 0) {
      return {
        valid: false,
        correctedMode: 'recommend',
        reason: 'Commerce chat should not show products directly',
      };
    }
  }

  return { valid: true };
}

/**
 * Router configuration for audit logging
 */
export interface RouterDecision {
  mode: TurnMode;
  topic: TurnTopic;
  reason: {
    productCount: number;
    groundability: number;
    topScore: number;
    bestFacet: string | null;
    facetEntropy: number;
    askedFacets: string[];
    comparisonIntent: boolean;
  };
  timestamp: string;
}

/**
 * Coreference resolution for pronouns and topic anchoring
 */

export type TopicAnchor = {
  kind: 'category' | 'product' | 'brand' | 'general';
  id?: string;
  text: string;
  confidence: number;
};

const PRONOUN_PATTERNS = [
  /\b(they|them|their|theirs)\b/i,
  /\b(it|its)\b/i,
  /\b(this|that|these|those)\b/i,
];

const CATEGORY_PATTERNS = [
  /\b(snowboards?|boards?)\b/i,
  /\b(bindings?)\b/i,
  /\b(boots?)\b/i,
  /\b(goggles?)\b/i,
  /\b(helmets?)\b/i,
  /\b(jackets?|coats?)\b/i,
  /\b(pants?|bibs?)\b/i,
  /\b(gloves?|mittens?)\b/i,
];

/**
 * Check if the text contains an unresolved pronoun
 */
export function hasUnresolvedPronoun(text: string): boolean {
  return PRONOUN_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Extract category from user text
 */
export function extractCategory(text: string): string | null {
  for (const pattern of CATEGORY_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      // Normalize to singular form
      let category = match[0].toLowerCase();
      if (category.endsWith('s') && !category.endsWith('ss')) {
        category = category.slice(0, -1);
      }
      return category;
    }
  }
  return null;
}

/**
 * Extract brand from user text
 */
export function extractBrand(text: string, knownBrands: string[]): string | null {
  const normalized = text.toLowerCase();

  for (const brand of knownBrands) {
    if (normalized.includes(brand.toLowerCase())) {
      return brand;
    }
  }

  // Check for @mention style
  const mentionMatch = text.match(/@(\w+)/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  return null;
}

/**
 * Update the topic anchor based on the current turn
 */
export function updateTopicAnchor(
  currentAnchor: TopicAnchor | null,
  userText: string,
  assistantResponse: string,
  retrievalCategory?: string,
  brands?: string[]
): TopicAnchor | null {
  // 1. Check if user explicitly mentioned a category
  const explicitCategory = extractCategory(userText);
  if (explicitCategory) {
    return {
      kind: 'category',
      text: explicitCategory,
      confidence: 1.0,
    };
  }

  // 2. Check if user mentioned a brand
  if (brands && brands.length > 0) {
    const brand = extractBrand(userText, brands);
    if (brand) {
      return {
        kind: 'brand',
        text: brand,
        confidence: 0.9,
      };
    }
  }

  // 3. Check if assistant's response established a topic
  const assistantCategory = extractCategory(assistantResponse);
  if (assistantCategory) {
    return {
      kind: 'category',
      text: assistantCategory,
      confidence: 0.8,
    };
  }

  // 4. Use retrieval category if available
  if (retrievalCategory) {
    return {
      kind: 'category',
      text: retrievalCategory,
      confidence: 0.7,
    };
  }

  // 5. Keep existing anchor with reduced confidence
  if (currentAnchor && currentAnchor.confidence > 0.3) {
    return {
      ...currentAnchor,
      confidence: currentAnchor.confidence * 0.8,
    };
  }

  return null;
}

/**
 * Resolve pronouns to their referents
 */
export function resolveReferent(
  userText: string,
  anchor: TopicAnchor | null
): { resolved: boolean; referent: string | null; needsClarification: boolean } {
  const hasPronouns = hasUnresolvedPronoun(userText);

  if (!hasPronouns) {
    return {
      resolved: true,
      referent: null,
      needsClarification: false,
    };
  }

  // If we have a confident anchor, use it
  if (anchor && anchor.confidence >= 0.6) {
    return {
      resolved: true,
      referent: anchor.text,
      needsClarification: false,
    };
  }

  // We have pronouns but no confident anchor - need clarification
  return {
    resolved: false,
    referent: null,
    needsClarification: true,
  };
}

/**
 * Build clarification options based on store context
 */
export function buildClarificationOptions(
  storeContext: any,
  maxOptions: number = 4
): Array<{ label: string; value: string }> {
  const options: Array<{ label: string; value: string }> = [];

  // Add primary category if available
  if (storeContext.primaryCategory && storeContext.primaryCategory !== 'products') {
    const category = storeContext.primaryCategory;
    options.push({
      label: category.charAt(0).toUpperCase() + category.slice(1),
      value: `tell me about ${category}`,
    });
  }

  // Add top categories
  if (storeContext.categories) {
    for (const cat of storeContext.categories.slice(0, 3)) {
      if (options.length >= maxOptions - 1) break;
      if (cat.name && cat.name !== storeContext.primaryCategory) {
        options.push({
          label: cat.name.charAt(0).toUpperCase() + cat.name.slice(1),
          value: `tell me about ${cat.name.toLowerCase()}`,
        });
      }
    }
  }

  // Add fallback options if we don't have enough
  if (options.length === 0) {
    options.push(
      { label: 'Our products', value: 'show me your products' },
      { label: 'Our store', value: 'tell me about your store' },
    );
  }

  // Always add "something else" option
  options.push({
    label: 'Something else…',
    value: 'something else',
  });

  return options;
}

/**
 * Create a clarification turn
 */
export function createClarificationTurn(
  storeContext: any
): any {
  const options = buildClarificationOptions(storeContext);

  return {
    turn_id: `clarify_pronoun_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments: [
      {
        type: 'narrative',
        text: 'Just to clarify—what would you like to know about?'
      },
      {
        type: 'options',
        style: 'quick_replies',
        items: options,
      },
    ],
    metadata: {
      tone: 'warm',
      stage: 'clarify',
      clarification_reason: 'unresolved_pronoun',
      reason: {
        topic: 'commerce',
        mode: 'clarify',
        decided_by: 'pronoun_clarifier',
        product_count: 0,
      },
      ui_hints: { mode: 'dialogue' },
    },
  };
}

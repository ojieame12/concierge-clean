import type { ConversationMessage } from '../../types/conversation';
import type { TopicAnchor } from './coref';

/**
 * Query Enhancement with Dialogue Context
 *
 * Enhances vague queries with context from recent conversation turns.
 * Examples:
 * - "what can I get for 300" → "snowboards for 300" (after discussing snowboards)
 * - "which one is best" → "which snowboard is best"
 * - "show me some" → "show me snowboards"
 */

const PRODUCT_TYPE_PATTERNS = [
  'snowboard',
  'boot',
  'binding',
  'jacket',
  'goggle',
  'helmet',
  'glove',
  'pant',
  'ski',
];

/**
 * Check if query is vague (lacks product type context)
 */
function isVagueQuery(query: string): boolean {
  const lower = query.toLowerCase();

  // Has vague opening words
  const hasVagueOpening = /^(what|which|show|get|find|one|some|any)\b/i.test(query);
  if (!hasVagueOpening) return false;

  // Lacks explicit product type
  const hasProductType = PRODUCT_TYPE_PATTERNS.some(type =>
    new RegExp(`\\b${type}s?\\b`, 'i').test(lower)
  );

  return !hasProductType;
}

/**
 * Extract product context from recent conversation
 */
function extractProductContext(
  messages: ConversationMessage[],
  topicAnchor: TopicAnchor | null
): string | null {
  // Try topic anchor first (most reliable)
  if (topicAnchor?.text) {
    return topicAnchor.text;
  }

  // Scan last 6 messages (3 exchanges) for product mentions
  const recentMessages = messages.slice(-6);

  for (const msg of recentMessages) {
    const lower = msg.content.toLowerCase();

    // Check each product type
    for (const productType of PRODUCT_TYPE_PATTERNS) {
      const pattern = new RegExp(`\\b${productType}s?\\b`, 'i');
      if (pattern.test(lower)) {
        return productType;
      }
    }
  }

  return null;
}

/**
 * Enhance query with context from dialogue history
 */
export function enhanceQueryWithContext(params: {
  query: string;
  messages: ConversationMessage[];
  topicAnchor: TopicAnchor | null;
  storePrimaryCategory?: string;  // Fallback to store's main category
}): string {
  const { query, messages, topicAnchor, storePrimaryCategory } = params;

  // Only enhance if query is vague
  if (!isVagueQuery(query)) {
    return query;
  }

  // Extract product context from dialogue
  let productContext = extractProductContext(messages, topicAnchor);

  // Fallback to store's primary category if no dialogue context
  // This helps queries like "I'm a beginner, what do you recommend" work in a snowboard store
  if (!productContext && storePrimaryCategory) {
    productContext = storePrimaryCategory;
  }

  // If still no context, return original query
  if (!productContext) {
    return query;
  }

  // Enhance query with product context
  // "what can I get for 300" + "snowboard" → "snowboard what can I get for 300"
  // "I'm a beginner what do you recommend" + "snowboard" → "snowboard I'm a beginner what do you recommend"
  return `${productContext} ${query}`;
}

/**
 * Check if enhancement improved the query
 */
export function wasEnhanced(original: string, enhanced: string): boolean {
  return original !== enhanced;
}

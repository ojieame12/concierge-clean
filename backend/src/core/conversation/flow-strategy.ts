import type { Product } from './types';
import type { TurnStrategy } from './conversation-policy';

export type FlowOrder = 'ask_then_show' | 'show_then_ask' | 'show_only';

interface FlowContext {
  products: Product[];
  userQuery: string;
  strategy: TurnStrategy;
  turnCount: number;
}

/**
 * Decide whether to ask questions first (discovery) or show products first (targeted)
 */
export function decideFlowOrder(context: FlowContext): FlowOrder {
  const { products, userQuery, strategy, turnCount } = context;
  const productCount = products.length;
  const firstTurn = turnCount <= 0;

  if (productCount === 0) {
    return 'ask_then_show';
  }

  if (productCount <= 4) {
    return strategy.askClarifier ? 'show_then_ask' : 'show_only';
  }

  if (isSpecificQuery(userQuery)) {
    return 'show_then_ask';
  }

  if (strategy.askClarifier && firstTurn && isOpenEndedQuery(userQuery) && productCount > 8) {
    return 'ask_then_show';
  }

  if (strategy.askClarifier && productCount > 12 && isOpenEndedQuery(userQuery)) {
    return 'ask_then_show';
  }

  return strategy.askClarifier ? 'show_then_ask' : 'show_only';
}

/**
 * Check if query is open-ended (needs clarification)
 */
function isOpenEndedQuery(query: string): boolean {
  const q = query.toLowerCase();

  // Open-ended patterns
  const openPatterns = [
    /^i need/,
    /^looking for/,
    /^want (a|some)/,
    /^show me/,
    /^help me find/,
    /^recommend/,
  ];

  // Specific constraints make it less open
  const hasConstraints = /under \$?\d+|over \$?\d+|size \w+|color \w+|\d+cm|\d+inch/i.test(q);

  return openPatterns.some(p => p.test(q)) && !hasConstraints;
}

/**
 * Check if query is very specific (product name, SKU, exact specs)
 */
function isSpecificQuery(query: string): boolean {
  const q = query.toLowerCase();

  // Specific patterns
  const specificPatterns = [
    /^the \w+/,                    // "The Complete Snowboard"
    /#\w+/,                        // "#SKU123"
    /model \w+/,                   // "model X123"
    /\d+cm/,                       // "148cm"
    /size \d+/,                    // "size 9"
  ];

  // Multiple constraints = specific
  const constraintCount = (q.match(/under|over|size|color|brand|material/g) || []).length;

  return specificPatterns.some(p => p.test(q)) || constraintCount >= 2;
}

import type { ChatTurn, ProductCard, Segment, QuickReply } from '../../types/chat-turn';
import {
  decideTurnStrategy,
  facetToOptions,
  bucketizePrice,
  type RetrievalSet,
  type ConversationStrategyState,
} from './conversation-policy';
import { selectPhrase, type ToneStyle } from './phrase-bank';
import { determineTone, toneConfig, type ConversationMetrics } from './tone-manager';
import { decideFlowOrder } from './flow-strategy';
import type { Product } from './types';
import { buildNarrativeSegments } from './narrative-builder';
import { clampWords } from './text-utils';
import type { ProductFactSheet } from './tools/product-facts';

export interface PEPContext {
  intent: string;
  retrieval: RetrievalSet;
  conversationState?: ConversationStrategyState;
  userMessage: string;
  sessionId: string;
  metrics: ConversationMetrics;
  factSheets?: ProductFactSheet[];
}

const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

const titleize = (value: string): string =>
  value
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(' ');

const FEATURE_TAG_REGEX = /waterproof|water-resistant|lightweight|breathable|organic|sustainable|insulated|stretch|moisture|quick dry|recycled|thermal|shock/i;

const extractFeatureChips = (product: Product): string[] => {
  const chips: string[] = [];
  const priceBucket = bucketizePrice(product.price ?? null);
  if (priceBucket) chips.push(priceBucket);
  if (product.product_type) chips.push(titleize(product.product_type));
  if (product.vendor) chips.push(titleize(product.vendor));

  (product.tags ?? [])
    .filter((tag) => FEATURE_TAG_REGEX.test(tag))
    .slice(0, 3)
    .forEach((tag) => chips.push(titleize(tag)));

  const unique = Array.from(new Set(chips.filter(Boolean)));
  return unique.slice(0, 3);
};

const chooseTopPickIndex = (products: Product[], sessionId: string): number => {
  if (!products.length) return 0;
  const topScore = products[0]?.combined_score ?? 0;
  if (!topScore) return 0;

  const tolerance = Math.max(0.02, topScore * 0.05);
  const candidates = products
    .map((product, index) => ({ index, score: product.combined_score ?? 0 }))
    .filter(({ score }) => Math.abs(score - topScore) <= tolerance);

  if (candidates.length <= 1) {
    return 0;
  }

  const hash = hashString(`${sessionId}-top-pick`);
  const selected = candidates[hash % candidates.length];
  return selected?.index ?? 0;
};

const formatList = (items: string[]): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} or ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, or ${items[items.length - 1]}`;
};

const formatFacetLabel = (facet: string): string => {
  switch (facet) {
    case 'price_bucket':
      return 'price';
    case 'product_type':
      return 'style';
    case 'vendor':
      return 'brand';
    case 'tag':
      return 'feature';
    default:
      return facet.replace(/_/g, ' ');
  }
};

const extractBadges = (product: Product): string[] => {
  const badges: string[] = [];
  const tags = product.tags ?? [];

  if (tags.some((t) => /beginner/i.test(t))) badges.push('Beginner friendly');
  if (tags.some((t) => /advanced/i.test(t))) badges.push('Advanced');
  if (tags.some((t) => /waterproof|water-resistant/i.test(t))) badges.push('Waterproof');
  if (tags.some((t) => /lightweight/i.test(t))) badges.push('Lightweight');
  if ((product.price ?? 0) < 100) badges.push('Budget');
  if ((product.price ?? 0) > 300) badges.push('Premium');

  return Array.from(new Set(badges)).slice(0, 3);
};

const generateGroundedReason = (product: Product, factSheets?: PEPContext['factSheets']): string => {
  const factSheet = factSheets?.find((fact) => fact.id === product.id);
  if (factSheet) {
    const evidence = factSheet.evidence?.[0]?.snippet ?? factSheet.evidence?.[1]?.snippet;
    if (evidence) {
      return clampWords(evidence, 16);
    }
    const specEntries = Object.entries(factSheet.specs ?? {}).slice(0, 2);
    if (specEntries.length) {
      return clampWords(specEntries.map(([key, value]) => `${key}: ${value}`).join(', '), 16);
    }
  }

  const fragments: string[] = [];

  if (product.vendor) fragments.push(product.vendor);
  if (product.product_type) fragments.push(product.product_type.toLowerCase());
  if (product.price != null) fragments.push(`$${product.price}`);

  const tags = product.tags ?? [];
  const feature = tags.find((t) => /waterproof|lightweight|durable|portable|flexible|breathable/i.test(t));
  if (feature) fragments.push(feature.toLowerCase());

  if (fragments.length === 0 && product.description) {
    fragments.push(product.description.replace(/<[^>]+>/g, ' ').split(/\.\s+/)[0] ?? 'Quality pick');
  }

  return clampWords(fragments.slice(0, 3).join(', '), 16) || 'Quality pick';
};

const extractEvidence = (products: Product[], maxBullets: number): string[] => {
  if (!products.length) return [];

  const bullets: string[] = [];

  // Filter outliers for price range (remove bottom/top 10%)
  let prices = products
    .map((p) => p.price)
    .filter((price): price is number => price != null && !Number.isNaN(price))
    .sort((a, b) => a - b);

  if (prices.length > 4) {
    // Remove outliers
    const removeCount = Math.floor(prices.length * 0.1);
    prices = prices.slice(removeCount, prices.length - removeCount);
  }

  if (prices.length) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    if (min === max) {
      bullets.push(`All priced at $${min}`);
    } else if (max - min < 100) {
      bullets.push(`Around $${Math.round((min + max) / 2)}`);
    } else {
      bullets.push(`Most are $${min}–$${max}`);
    }
  }

  const tagCounts = new Map<string, number>();
  products.forEach((p) => {
    (p.tags ?? []).forEach((tag) => {
      const normalized = tag.toLowerCase();
      tagCounts.set(normalized, (tagCounts.get(normalized) ?? 0) + 1);
    });
  });

  Array.from(tagCounts.entries())
    .filter(([, count]) => count >= Math.ceil(products.length * 0.6))
    .slice(0, 2)
    .forEach(([tag]) => bullets.push(`Most include ${tag}`));

  return bullets.slice(0, maxBullets).map((bullet) => clampWords(bullet, 12));
};

const toProductCards = (
  products: Product[],
  tone: ToneStyle,
  sessionId: string,
  factSheets?: PEPContext['factSheets']
): ProductCard[] => {
  const maxCards = tone === 'concise' ? 3 : 4;
  const display = products.slice(0, maxCards);
  if (!display.length) return [];

  const topPickIndex = chooseTopPickIndex(display, sessionId);

  return display.map((p, index) => {
    const badges = extractBadges(p);
    if (index === topPickIndex && !badges.includes('Top pick')) {
      badges.unshift('Top pick');
    }

    const whyChips = index === topPickIndex ? extractFeatureChips(p) : [];

    return {
      id: p.id,
      title: p.title,
      price: p.price ?? 0,
      currency: p.currency || 'USD',
      image: p.image_url ?? null,
      badges,
      reason: generateGroundedReason(p, factSheets),
      handle: p.handle,
      variant_id: p.variants?.[0]?.id ?? null,
      similarity: p.combined_score ?? null,
      top_pick: index === topPickIndex,
      why_chips: whyChips.length ? whyChips : undefined,
    };
  });
};

export const buildPEPTurn = async ({
  intent,
  retrieval,
  conversationState = {},
  userMessage,
  sessionId,
  metrics,
  factSheets,
}: PEPContext): Promise<ChatTurn> => {
  const tone: ToneStyle = determineTone(userMessage, metrics);
  const config = toneConfig[tone];
  const strategy = decideTurnStrategy(retrieval, conversationState);
  const products = retrieval.products;

  // Decide segment ordering (question-first vs product-first)
  const flowOrder = decideFlowOrder({
    products,
    userQuery: userMessage,
    strategy,
    turnCount: metrics.turnCount
  });

  const segments: Segment[] = [];
  let clarifierOptionsForMeta: QuickReply[] = [];

  const buildClarifierReplies = (): QuickReply[] => {
    if (!strategy.askClarifier || !strategy.facetToAsk) return [];

    const optionLimit = tone === 'empathetic_urgent' ? 2 : 4;
    const baseOptions = facetToOptions(strategy.facetToAsk, strategy.optionValues ?? []);
    const trimmed: QuickReply[] = [];

    for (const option of baseOptions) {
      if (option.id === 'other') continue;
      if (trimmed.length >= Math.max(optionLimit - 1, 1)) break;
      trimmed.push(option);
    }

    clarifierOptionsForMeta = trimmed;

    if (!trimmed.length) {
      return [];
    }

    return [
      ...trimmed,
      { id: 'other', label: 'Something else', value: 'other' },
    ];
  };

  const narrativeSegments = await buildNarrativeSegments({
    tone,
    userMessage,
    products,
    config,
    sessionId,
    factSheets,
  });
  segments.push(...narrativeSegments);

  // Add evidence
  const evidence = extractEvidence(products, config.maxEvidenceBullets);
  if (evidence.length > 0 && tone !== 'concise') {
    segments.push({ type: 'evidence', bullets: evidence });
  }

  // FLOW ORDER LOGIC: Ask first for discovery, show first for targeted queries
  if (flowOrder === 'ask_then_show') {
    // Discovery mode: Ask question BEFORE showing products
    if (strategy.askClarifier && strategy.facetToAsk) {
      const question = selectPhrase('clarifier', tone, sessionId);
      segments.push({ type: 'ask', text: question });

      const replies = buildClarifierReplies();
      if (replies.length) {
        segments.push({ type: 'options', style: 'quick_replies', items: replies });
      }
    }

    // Products come AFTER user answers (not included in this turn)

  } else {
    // Targeted mode: Show products FIRST, then optional question
    if (products.length > 0) {
      const cards = toProductCards(products, tone, sessionId, factSheets);
      if (cards.length) {
        segments.push({ type: 'products', items: cards });
        const topCard = cards.find((card) => card.top_pick);
        if (topCard?.why_chips?.length) {
          segments.push({ type: 'note', tone: 'discreet', text: 'Why this pick' });
          segments.push({ type: 'chips', items: topCard.why_chips });
        }
      }
    }

    // Refinement suggestions
    if (toneConfig[tone].allowUpsell && strategy.suggestRefinements && strategy.suggestRefinements.length) {
      const uniqueRefinements = Array.from(new Set(strategy.suggestRefinements));
      const labels = uniqueRefinements.map((facet) => formatFacetLabel(facet)).filter(Boolean);
      if (labels.length) {
        const refinementText = `You can narrow by ${formatList(labels)}.`;
        segments.push({ type: 'note', tone: 'discreet', text: refinementText });
      }
    }

    // Optional follow-up question
    if (strategy.askClarifier && strategy.facetToAsk) {
      const question = selectPhrase('clarifier', tone, sessionId);
      segments.push({ type: 'ask', text: question });

      const replies = buildClarifierReplies();
      if (replies.length) {
        segments.push({ type: 'options', style: 'quick_replies', items: replies });
      }
    }
  }

  return {
    turn_id: `pep_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments,
    metadata: {
      intent,
      tone,
      asked_slot: strategy.askClarifier ? strategy.facetToAsk ?? null : null,
      candidate_stats: {
        count: products.length,
      },
      clarifier_options: clarifierOptionsForMeta,
    },
  };
};

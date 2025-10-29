import type { QuickReply } from '../../types/chat-turn';

type RetrievalProduct = {
  id: string;
  title: string;
  handle: string;
  price?: number | null;
  currency?: string | null;
  tags?: string[];
  product_type?: string | null;
  vendor?: string | null;
  image_url?: string | null;
  combined_score?: number | null;
};

export type RetrievalSet = {
  products: RetrievalProduct[];
  facets: Map<string, Set<string>>;
};

export type TurnStrategy = {
  action: 'show_results' | 'ask_clarifier';
  askClarifier: boolean;
  facetToAsk?: string;
  optionValues?: string[];
  suggestRefinements?: string[];
};

export type ConversationStrategyState = {
  askedSlots?: string[];
  clarifierHistory?: Record<string, number>;
  topPickHistory?: string[];
};

export const PRICE_BUCKETS = [
  { max: 50, label: 'Under $50' },
  { max: 100, label: '$50-$100' },
  { max: 150, label: '$100-$150' },
  { max: 200, label: '$150-$200' },
];

export const bucketizePrice = (price: number | null | undefined): string | null => {
  if (price == null || Number.isNaN(price)) return null;
  for (const bucket of PRICE_BUCKETS) {
    if (price <= bucket.max) return bucket.label;
  }
  return '$200+';
};

export const calculateEntropy = (counts: Map<string, number>): number => {
  let total = 0;
  counts.forEach((count) => {
    total += count;
  });
  if (total === 0) return 0;

  let entropy = 0;
  counts.forEach((count) => {
    if (count <= 0) return;
    const probability = count / total;
    entropy -= probability * Math.log2(probability);
  });
  return entropy;
};

export const decideTurnStrategy = (
  retrievalSet: RetrievalSet,
  conversationState: ConversationStrategyState
): TurnStrategy => {
  const { products, facets } = retrievalSet;
  const askedSlots = new Set(conversationState.askedSlots ?? []);
  const totalProducts = products.length;

  if (totalProducts === 0) {
    return {
      action: 'show_results',
      askClarifier: false,
    };
  }

  if (totalProducts <= 4) {
    return {
      action: 'show_results',
      askClarifier: false,
    };
  }

  const facetValueCounts = new Map<string, Map<string, number>>();
  const incrementCount = (facet: string, rawValue: string | null | undefined) => {
    if (!rawValue) return;
    const value = rawValue.trim();
    if (!value) return;
    if (!facetValueCounts.has(facet)) {
      facetValueCounts.set(facet, new Map());
    }
    const counts = facetValueCounts.get(facet)!;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  };

  products.forEach((product) => {
    incrementCount('product_type', product.product_type);
    incrementCount('vendor', product.vendor);
    incrementCount('price_bucket', bucketizePrice(product.price ?? null));
    (product.tags ?? []).slice(0, 5).forEach((tag) => incrementCount('tag', tag));
  });

  const CLICK_PRIORS: Record<string, number> = {
    price_bucket: 1,
    product_type: 0.9,
    tag: 0.65,
    vendor: 0.45,
  };

  const facetStats = Array.from(facets.entries()).map(([facet, values]) => {
    const counts = facetValueCounts.get(facet) ?? new Map<string, number>();
    const entropy = calculateEntropy(counts);
    let maxCount = 0;
    counts.forEach((count) => {
      if (count > maxCount) maxCount = count;
    });
    const impact = totalProducts > 0 ? 1 - maxCount / totalProducts : 0;
    const clickPrior = CLICK_PRIORS[facet] ?? 0.4;
    const utility = entropy * impact * clickPrior;

    return {
      facet,
      entropy,
      cardinality: values.size,
      impact,
      clickPrior,
      utility,
      counts,
    };
  }).sort((a, b) => b.utility - a.utility);

  const topFacet = facetStats.find(
    (stat) =>
      stat.cardinality >= 2 &&
      stat.cardinality <= 5 &&
      stat.impact >= 0.1 &&
      stat.utility >= 0.25 &&
      !askedSlots.has(stat.facet)
  );

  if (topFacet) {
    const valueList = Array.from(topFacet.counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([value]) => value)
      .filter(Boolean);

    const uniqueValues = Array.from(new Set(valueList)).slice(0, 4);

    if (uniqueValues.length >= 2) {
      return {
        action: 'ask_clarifier',
        askClarifier: true,
        facetToAsk: topFacet.facet,
        optionValues: uniqueValues,
      };
    }
  }

  const refinementFacets = facetStats
    .filter((stat) => stat.utility >= 0.15 && !askedSlots.has(stat.facet))
    .slice(0, 2)
    .map((stat) => stat.facet);

  return {
    action: 'show_results',
    askClarifier: false,
    suggestRefinements: refinementFacets,
  };
};

export const facetToQuestion = (facet: string): string => {
  switch (facet) {
    case 'price_bucket':
      return 'Which price range feels right?';
    case 'product_type':
      return 'Which style suits you best?';
    case 'style':
      return 'Any particular style or vibe you prefer?';
    case 'use_case':
      return 'What will you mostly use it for?';
    case 'vendor':
      return 'Do you prefer any brand?';
    case 'tag':
      return 'Want me to focus on any specific feature?';
    default:
      return 'How should we refine the options?';
  }
};

export const facetToOptions = (facet: string, values: string[]): QuickReply[] => {
  const limitedValues = values.slice(0, 6);
  const seenLabels = new Set<string>();

  const formatLabel = (raw: string): string | null => {
    if (!raw) return null;
    if (facet === 'price_bucket') return raw;

    const cleaned = raw
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return null;

    const words = cleaned
      .split(' ')
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());

    if (!words.length) return null;

    const label = words.slice(0, 3).join(' ');

    if (label.length > 28) return null;
    if (facet === 'tag' && !/[a-zA-Z]/.test(label)) return null;

    if (facet === 'vendor') {
      const stripped = label.replace(/\b(vendor|inc|corp|llc|ltd|store|co)\b/gi, '').trim();
      if (stripped.length >= 3) {
        return stripped;
      }
      return label;
    }

    return label;
  };

  const options: QuickReply[] = [];

  for (const value of limitedValues) {
    const label = formatLabel(value);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seenLabels.has(key)) continue;
    seenLabels.add(key);

    options.push({
      id: `${facet}-${label.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
      label,
      value,
    });

    if (options.length >= 4) break;
  }

  return options;
};

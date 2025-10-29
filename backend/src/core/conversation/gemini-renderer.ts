import type { ChatTurn, Segment, ProductCard, QuickReply } from '../../types/chat-turn';
import type { Product } from './types';
import type { ProductFactSheet } from './tools/product-facts';
import type { ParsedGeminiTurn } from './llm-types';
import { determineTone, toneConfig, type ConversationMetrics } from './tone-manager';

const clampWords = (text: string, limit: number) => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return `${words.slice(0, limit).join(' ')}…`;
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

const generateFallbackReason = (product: Product): string => {
  const summary = product.summary;
  if (summary?.keyFeatures?.length) {
    return summary.keyFeatures[0];
  }

  const fragments: string[] = [];
  if (product.vendor) fragments.push(product.vendor);
  if (product.product_type) fragments.push(product.product_type.toLowerCase());
  if (product.price != null) fragments.push(`$${product.price}`);
  return fragments.join(', ') || 'Recommended pick';
};

const toProductCard = (
  product: Product,
  rationale: string[],
  factSheet?: { evidence?: Array<{ snippet?: string | null; key: string }>; specs?: Record<string, string | number | null> }
): ProductCard => {
  const reason = factSheet?.evidence?.[0]?.snippet
    ?? factSheet?.evidence?.[0]?.key
    ?? rationale[0]
    ?? generateFallbackReason(product);

  return {
    id: product.id,
    title: product.title,
    price: product.price ?? 0,
    currency: product.currency || 'USD',
    image: product.image_url ?? null,
    badges: extractBadges(product),
    reason,
    handle: product.handle,
    variant_id: product.variants?.[0]?.id ?? null,
    similarity: product.combined_score ?? null,
  };
};

const buildEvidenceBullets = (recommendations: ParsedGeminiTurn['recommendations']) =>
  recommendations
    .flatMap((recommendation) => recommendation.rationale)
    .filter(Boolean)
    .slice(0, 4)
    .map((bullet) => clampWords(bullet, 14));

interface RenderOptions {
  parsedTurn: ParsedGeminiTurn;
  candidates: Product[];
  metrics: ConversationMetrics;
  factSheets?: ProductFactSheet[];
  rapportMode?: boolean;
  infoMode?: boolean;
}

const buildClarifierReplies = (clarifier?: ParsedGeminiTurn['clarifier']): QuickReply[] => {
  if (!clarifier) return [];
  return clarifier.options.slice(0, 5).map((option) => ({
    id: `${clarifier.facet}-${option.value.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    label: option.label,
    value: option.value,
  }));
};

export const buildGeminiPEPTurn = ({
  parsedTurn,
  candidates,
  metrics,
  factSheets,
  rapportMode = false,
  infoMode = false,
}: RenderOptions): ChatTurn => {
  const tone = determineTone(parsedTurn.rawText, metrics);
  const config = toneConfig[tone];

  const productMap = new Map(candidates.map((product) => [product.id, product]));
  const sheetMap = new Map((factSheets ?? []).map((sheet) => [sheet.id, sheet]));

  const cards: ProductCard[] = [];
  parsedTurn.recommendations.forEach((recommendation) => {
    const product = productMap.get(recommendation.productId);
    if (!product) return;
    cards.push(toProductCard(product, recommendation.rationale, sheetMap.get(product.id)));
  });

  if (!cards.length && parsedTurn.stage !== 'clarify') {
    candidates.slice(0, 4).forEach((product) => {
      cards.push(toProductCard(product, [], sheetMap.get(product.id)));
    });
  }

  const segments: Segment[] = [];

  segments.push({
    type: 'narrative',
    text: clampWords(parsedTurn.narrative, config.maxPreviewWords),
  });

  if (parsedTurn.stage !== 'clarify' && cards.length) {
    const evidence = buildEvidenceBullets(parsedTurn.recommendations);
    if (evidence.length && tone !== 'concise') {
      segments.push({ type: 'evidence', bullets: evidence });
    }

    segments.push({ type: 'products', items: cards.slice(0, tone === 'concise' ? 3 : 4) });
  }

  if (parsedTurn.uiHints?.comparison?.product_ids?.length) {
    const comparisonItems: Array<{ id: string; title: string; image?: string | null; features: Record<string, string | number | boolean | null | undefined> }> = [];

    parsedTurn.uiHints.comparison.product_ids.forEach((productId) => {
      const product = productMap.get(productId);
      if (!product) return;
      const sheet = sheetMap.get(product.id);
      const features: Record<string, string | number | boolean | null | undefined> = {};
      if (sheet?.specs) {
        Object.entries(sheet.specs).forEach(([key, value]) => {
          if (value == null) return;
          features[key] = value;
        });
      }
      if (sheet?.derived) {
        Object.entries(sheet.derived).forEach(([key, value]) => {
          if (value == null) return;
          features[key] = value;
        });
      }
      if (!Object.keys(features).length && product.summary?.keyFeatures?.length) {
        product.summary.keyFeatures.forEach((feature, index) => {
          features[`highlight_${index + 1}`] = feature;
        });
      }

      const item: { id: string; title: string; image?: string | null; features: Record<string, string | number | boolean | null | undefined> } = {
        id: product.id,
        title: product.title,
        features,
      };
      if (product.image_url) {
        item.image = product.image_url;
      }
      comparisonItems.push(item);
    });

    if (comparisonItems.length >= 2) {
      const recommended = parsedTurn.recommendations.find((rec) =>
        parsedTurn.uiHints?.comparison?.product_ids.includes(rec.productId)
      );
      segments.push({
        type: 'comparison',
        products: comparisonItems,
        recommendation: recommended
          ? { productId: recommended.productId, reason: recommended.rationale[0] }
          : undefined,
      });
    }
  }

  let askedSlot: string | null = null;
  const clarifierReplies = buildClarifierReplies(parsedTurn.clarifier);

  if (!rapportMode && !infoMode && parsedTurn.clarifier && clarifierReplies.length) {
    askedSlot = parsedTurn.clarifier.facet;
    segments.push({ type: 'ask', text: parsedTurn.clarifier.question });
    segments.push({
      type: 'options',
      style: 'quick_replies',
      items: [...clarifierReplies, { id: 'skip', label: 'Skip for now', value: 'something_else' }],
    });
  }

  const metadata: Record<string, unknown> = {
    tone,
    stage: parsedTurn.stage,
    asked_slot: askedSlot,
    candidate_stats: { count: candidates.length },
    clarifier_options: rapportMode || infoMode ? [] : clarifierReplies,
  };

  if (parsedTurn.uiHints) {
    metadata.ui_hints = parsedTurn.uiHints;
  }

  return {
    turn_id: `llm_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments,
    metadata,
  };
};

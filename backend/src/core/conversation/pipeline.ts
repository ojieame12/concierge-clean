import type { ConversationMessage } from '../../types/conversation';
import type { ChatTurn, QuickReply, Segment, ConciergeLayoutHints, ConciergeLayoutMode, ProductCard } from '@insite/shared-types';
import type { AccumulatedIntent } from './intent-extractor';
import { extractIntent } from './intent-extractor';
import type { FactSheetCache, SessionMetadata } from '../session/session-store';
import { calculateRepeatedClarifiers } from '../session/session-store';
import { determineTone, analyzeSentiment, type ConversationMetrics } from './tone-manager';
import type { RetrievalSet } from './conversation-policy';
import { buildLexicalQuery, runHybridSearch, type HybridSearchDependencies } from '../search/hybrid-search';
import type { Product } from './types';
import { buildPEPTurn as buildLegacyTurn } from './pep-builder';
import { bucketizePrice, PRICE_BUCKETS, decideTurnStrategy, facetToOptions, facetToQuestion } from './conversation-policy';
import { DEFAULT_CLARIFIER_CHOICES } from './clarifier-config';
import type { ClarifierOption } from './clarifier-config';
import { config } from '../../config';
import { chatModel } from '../../infra/llm/gemini';
import {
  applyRelaxation,
  loadCategoryClarifierConfig,
  selectCandidateProducts,
  computeFacetValues,
  type RelaxationOutcome,
  type RelaxationStep,
} from './modules/relaxation-manager';
import {
  buildCrossSellSegments as getCrossSellSegments,
  buildThresholdSegments as getThresholdSegments,
  buildPolicyOfferSegments as getPolicyOfferSegments,
  buildBundleSegments as getBundleSegments,
} from './modules/offer-engine';
import {
  isPriceObjection,
  fetchNegotiationRule,
  buildNegotiationSegments,
} from './modules/negotiation-engine';
import { fetchProductFactsShadow } from './shadow-tools/product-facts';
import { logShadowFactUsage, logKnowledgeTurnMetrics } from '../logging/shadow-log';
import { planToolsForTurn } from './planner';
import { fetchProductFacts, type ProductFactSheet } from './tools/product-facts';
import { sanitizeFilters } from './filter-sanitizer';
import { fetchActiveOntologyVersion, fetchKnowledgePacksByProducts, fetchCanonCandidates, rankCanonShards, fetchCalculatorRegistry } from '../knowledge/runtime-store';
import type { KnowledgePack, CanonShard } from '../knowledge/types';
import { defaultCalculators } from '../tools/calculators/registry';
import { detectAndRunCalculators } from '../tools/calculators/executor';
import { writeTurnCopy } from './copy-writer';
import { extractStoreContext, fetchStoreFacts, getStoreContextSafe, type StoreContext } from './store-context';
import { generateSmartTemplateCopy, type TurnMode, type TurnTopic } from './template-copy';
import {
  classifyTopic,
  pickMode,
  validateCoherence,
  calculateGroundability,
  selectBestFacet,
  SMALL_SET_CAP,
  ALWAYS_CLARIFY_ABOVE,
  GROUNDABILITY_THRESHOLD,
  type CoherenceCheck
} from './routing-gates';
import {
  hasUnresolvedPronoun,
  updateTopicAnchor,
  resolveReferent,
  createClarificationTurn,
  type TopicAnchor
} from './coref';
import { enhanceQueryWithContext } from './query-enhancer';
import { generateContextualReason, generateExpertGuidance, type UserContext } from './industry-knowledge';
import { getProductEnrichment, type ProductEnrichment } from '../enrichment/enrichment-service';
import { generateReasonFromEnrichment } from '../enrichment/gemini-extractor';

export interface ConversationPipelineDependencies extends HybridSearchDependencies {
  generateEmbedding: (text: string) => Promise<number[]>;
}

export interface ConversationPipelineInput {
  shopId: string;
  sessionId: string;
  messages: ConversationMessage[];
  sessionMetadata: SessionMetadata;
  brandProfile?: any;
  resultLimit?: number;
}

export interface ConversationPipelineResult {
  pepTurn: ChatTurn;
  retrieval: RetrievalSet;
  metrics: ConversationMetrics;
  zeroResultStreakNext: number;
  askedSlot: string | null;
  clarifierHistoryPatch: Record<string, number>;
  userMessage: string;
  accumulatedIntent: AccumulatedIntent;
  activeFilters: Record<string, string>;
  pendingClarifier: SessionMetadata['pendingClarifier'];
  manualClarifier: SessionMetadata['manualClarifier'];
  relaxationSteps: RelaxationStep[];
  offersPresented: string[];
  negotiationState: SessionMetadata['negotiationState'];
  factSheets?: ProductFactSheet[];
  factSheetCache?: FactSheetCache | null;
  uiHints?: ConciergeLayoutHints;
  rapportMode: boolean;
  infoMode: boolean;
  dialogueSummary?: string | null;
  sentiment?: 'positive' | 'neutral' | 'concerned' | null;
}

const normalise = (value: string) => value.trim().toLowerCase();

const summariseDialogue = (previous: string | null | undefined, userInput: string, turn: ChatTurn): string => {
  const narrative = turn.segments.find((segment) => segment.type === 'narrative')?.text ?? '';
  const entry = `User: ${userInput.slice(0, 140)} | Assistant: ${narrative.slice(0, 140)}`;
  const history = previous ? previous.split('\n').filter(Boolean) : [];
  history.push(entry);
  return history.slice(-3).join('\n');
};

const canonicaliseFacetValue = (facet: string, raw: string) => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  switch (facet) {
    case 'price_bucket':
    case 'vendor':
      return trimmed;
    default:
      return trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '_');
  }
};

const attemptRelaxation = async (
  deps: ConversationPipelineDependencies,
  baseParams: {
    shopId: string;
    lexicalQuery: string;
    embedding: number[];
    limit: number;
  },
  startingFilters: Record<string, string>,
  initialRetrieval: RetrievalSet
): Promise<RelaxationOutcome> =>
  applyRelaxation({
    retrieval: initialRetrieval,
    filters: startingFilters,
    deps: { supabaseAdmin: deps.supabaseAdmin },
    shopId: baseParams.shopId,
    lexicalQuery: baseParams.lexicalQuery,
    embedding: baseParams.embedding,
    limit: baseParams.limit,
  });

const inferPriceBucketFromInput = (input: string): string | null => {
  const lower = input.toLowerCase();
  const numbers = (input.match(/\d+/g) ?? [])
    .map((value) => Number.parseInt(value, 10))
    .filter((value) => !Number.isNaN(value));

  if (lower.includes('premium') || lower.includes('expensive') || lower.includes('high-end') || lower.includes('top tier')) {
    return '$200+';
  }

  if (lower.includes('budget') || lower.includes('cheap') || lower.includes('affordable') || lower.includes('low')) {
    return 'Under $50';
  }

  if (!numbers.length) {
    return null;
  }

  const target = lower.includes('over') || lower.includes('above') || lower.includes('more than') || lower.includes('greater than')
    ? Math.max(...numbers)
    : Math.min(...numbers);

  return bucketizePrice(target) ?? null;
};

const applyManualFacetValue = (facet: string, raw: string): string | null => {
  if (facet === 'price_bucket') {
    return inferPriceBucketFromInput(raw);
  }

  const canonical = canonicaliseFacetValue(facet, raw);
  return canonical || null;
};

const manualPromptForFacet = (facet: string) => {
  switch (facet) {
    case 'price_bucket':
      return 'Sure thing—what price range should I focus on? Just type it in and I\'ll adjust.';
    case 'style':
      return 'No problem. Tell me the vibe or style you have in mind and I\'ll tailor the picks.';
    case 'use_case':
      return 'Got it. What will you mostly use it for? Type a quick note and I\'ll refine the options.';
    case 'vendor':
      return 'Happy to! Let me know which brands you prefer and I\'ll prioritise them.';
    default:
      return 'All good—type what you\'re looking for and I\'ll take it from there.';
  }
};

const describeFacetLabel = (facet: string): string => {
  switch (facet) {
    case 'price_bucket':
      return 'price range';
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

const FACT_CACHE_LIMIT = 5;
const FACT_CACHE_TTL_MS = 5 * 60 * 1000;

const sliceFactProductIds = (products: Product[]): string[] =>
  products.slice(0, FACT_CACHE_LIMIT).map((product) => product.id);

const arraysEqual = (a: string[] | undefined, b: string[] | undefined) => {
  if (!a || !b) return false;
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) {
      return false;
    }
  }
  return true;
};

const isCacheFresh = (cache: FactSheetCache | null | undefined) => {
  if (!cache?.fetchedAt) return false;
  const fetched = Date.parse(cache.fetchedAt);
  if (Number.isNaN(fetched)) {
    return false;
  }
  return Date.now() - fetched <= FACT_CACHE_TTL_MS;
};

const buildManualClarifierTurn = (facet: string | null, prompt: string, candidateCount: number): ChatTurn => {
  const facetLabel = facet ? describeFacetLabel(facet) : 'preference';
  const instruction = `Just type your ${facetLabel} in the message box and press Enter when you're ready.`;

  return {
    turn_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments: [
      { type: 'ask', text: prompt },
      { type: 'note', text: instruction },
    ],
    metadata: {
      tone: 'neutral',
      stage: 'clarify',
      asked_slot: facet,
      candidate_stats: { count: candidateCount },
      clarifier_options: [],
      ui_hints: {
        mode: 'dialogue',
        show_quick_replies: false,
        notes: [instruction],
      },
    },
  };
};

const buildFactSheetFromKnowledge = (product: Product, pack: KnowledgePack): ProductFactSheet => {
  const evidence = [
    ...(pack.evidence ?? []).map((item) => ({
      key: item.key,
      snippet: item.snippet,
      confidence: item.confidence ?? null,
    })),
    ...(pack.whyReasons ?? []).map((reason, index) => ({
      key: reason.source ?? `why_${index + 1}`,
      snippet: reason.text,
      confidence: 0.8,
    })),
  ];

  const summary = pack.whyReasons?.[0]?.text
    ?? product.summary?.keyFeatures?.[0]
    ?? product.summary?.bestFor?.[0]
    ?? null;

  return {
    id: product.id,
    title: product.title,
    price: product.price ?? null,
    currency: product.currency ?? null,
    summary,
    specs: pack.normalizedSpecs ?? {},
    derived: pack.derivedMetrics ?? {},
    evidence,
  } satisfies ProductFactSheet;
};

interface CanonInsight {
  topic: string;
  assertions: string[];
  caveats?: string[];
  citation?: string;
}

const INITIAL_ALLOWED_PRICE_BUCKETS = new Set([...PRICE_BUCKETS.map((bucket) => bucket.label), '$200+']);

const CLARIFIER_OPTION_CAP = 5;
const SOMETHING_ELSE_QUICK_REPLY: QuickReply = {
  id: 'clarifier_something_else',
  label: 'Something else…',
  value: 'something else',
};
const computeGroundabilityMetrics = (retrieval: RetrievalSet) => {
  if (!retrieval.products.length) {
    return {
      domainConfidence: 0,
      coverage: 0,
      groundability: 0,
    };
  }

  const topScore = Math.max(0, Math.min(1, retrieval.products[0]?.combined_score ?? 0));
  const sample = retrieval.products.slice(0, 6);
  const coverage = sample.length
    ? sample.filter((product) => (product.combined_score ?? 0) >= 0.35).length / sample.length
    : 0;

  const groundability = Math.max(0, Math.min(1, (topScore + coverage) / 2));

  return {
    domainConfidence: topScore,
    coverage,
    groundability,
  };
};

const extractBadges = (product: Product): string[] => {
  const badges: string[] = [];
  const tags = product.tags ?? [];

  if (tags.some((tag) => /beginner/i.test(tag))) badges.push('Beginner friendly');
  if (tags.some((tag) => /advanced/i.test(tag))) badges.push('Advanced');
  if (tags.some((tag) => /waterproof|water-resistant/i.test(tag))) badges.push('Waterproof');
  if (tags.some((tag) => /lightweight/i.test(tag))) badges.push('Lightweight');
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

const toTitleCase = (value: string): string =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

type CapsuleRow = { label: string; values: string[] };

const DEFAULT_STYLE_VALUES = ['All-Mountain', 'Freestyle', 'Powder'];
const DEFAULT_FLEX_VALUES = ['Soft (1-3)', 'Medium (4-6)', 'Stiff (7-10)'];
const DEFAULT_WIDTH_VALUES = ['Regular', 'Mid-Wide', 'Wide'];

const splitSpecString = (value: string): string[] =>
  value
    .split(/[,/\u00B7;|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);

const uniqueTitleValues = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(toTitleCase(value));
  }
  return result;
};

const extractSpecValues = (sheet: ProductFactSheet | null, keys: string[]): string[] => {
  if (!sheet) return [];
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  const collected: string[] = [];
  const entries = sheet.specs ?? {};
  for (const [rawKey, rawValue] of Object.entries(entries)) {
    if (!wanted.has(rawKey.toLowerCase()) || rawValue == null) continue;
    if (typeof rawValue === 'string') {
      collected.push(...splitSpecString(rawValue));
    } else if (typeof rawValue === 'number') {
      collected.push(String(rawValue));
    }
  }
  return uniqueTitleValues(collected);
};

const deriveStyleValues = (term: string, sheet: ProductFactSheet | null, storeContext: StoreContext): string[] => {
  const specValues = extractSpecValues(sheet, ['style', 'style_descriptor', 'ride_style', 'terrain', 'category']);
  const categoryValues = (storeContext.categories ?? [])
    .map((cat) => toTitleCase(cat.name))
    .filter((name) => name && name.toLowerCase() !== term.toLowerCase());

  const fallback = [...specValues, ...categoryValues];
  return fallback.length ? uniqueTitleValues(fallback).slice(0, 4) : DEFAULT_STYLE_VALUES;
};

const flexValueFromToken = (token: string): string | null => {
  const lower = token.toLowerCase();
  if (/soft/.test(lower)) return 'Soft (1-3)';
  if (/medium/.test(lower)) return 'Medium (4-6)';
  if (/stiff|hard/.test(lower)) return 'Stiff (7-10)';
  const numeric = Number.parseFloat(token);
  if (Number.isFinite(numeric)) {
    if (numeric <= 3) return 'Soft (1-3)';
    if (numeric <= 6) return 'Medium (4-6)';
    return 'Stiff (7-10)';
  }
  return null;
};

const deriveFlexValues = (sheet: ProductFactSheet | null): string[] => {
  const raw = extractSpecValues(sheet, ['flex', 'flex_rating', 'flex_profile']);
  const mapped = raw
    .map((token) => flexValueFromToken(token))
    .filter((value): value is string => Boolean(value));
  const unique = uniqueTitleValues(mapped.length ? mapped : DEFAULT_FLEX_VALUES);
  return unique.slice(0, 3);
};

const deriveWidthValues = (sheet: ProductFactSheet | null): string[] => {
  const raw = extractSpecValues(sheet, ['width', 'waist_width', 'shape']);
  const mapped: string[] = [];
  for (const token of raw) {
    const lower = token.toLowerCase();
    if (/mid/.test(lower)) {
      mapped.push('Mid-Wide');
    } else if (/wide/.test(lower)) {
      mapped.push('Wide');
    } else if (/narrow/.test(lower)) {
      mapped.push('Regular');
    } else {
      const numeric = Number.parseFloat(lower.replace(/[^0-9.]+/g, ''));
      if (Number.isFinite(numeric)) {
        if (numeric >= 260) mapped.push('Wide');
        else if (numeric >= 255) mapped.push('Mid-Wide');
        else if (numeric > 0) mapped.push('Regular');
      }
    }
  }
  const unique = uniqueTitleValues(mapped.length ? mapped : DEFAULT_WIDTH_VALUES);
  return unique.slice(0, 3);
};

type PolicyFocus = 'shipping' | 'returns' | 'warranty' | 'general';

const splitPolicyText = (text?: string | null): string[] => {
  if (!text) return [];
  const normalised = text
    .replace(/•/g, '\n')
    .replace(/-\s+/g, '\n')
    .replace(/;/g, '\n');

  return normalised
    .split(/\r?\n|\.\s+/)
    .map((entry) => entry.replace(/^[•\-\s]+/, '').trim())
    .filter(Boolean)
    .slice(0, 4);
};

const detectPolicyFocus = (message: string): PolicyFocus => {
  const normalized = message.toLowerCase();
  if (/ship|delivery|fulfil|dispatch/.test(normalized)) {
    return 'shipping';
  }
  if (/return|refund|exchange/.test(normalized)) {
    return 'returns';
  }
  if (/warranty|guarantee/.test(normalized)) {
    return 'warranty';
  }
  return 'general';
};

const buildPolicyCapsuleRows = (policies: StoreContext['policies'] | undefined): CapsuleRow[] => {
  if (!policies) return [];
  const rows: CapsuleRow[] = [];
  (['shipping', 'returns', 'warranty'] as const).forEach((policyKey) => {
    const values = splitPolicyText(policies[policyKey as keyof typeof policies]);
    if (!values.length) return;
    rows.push({
      label: toTitleCase(policyKey),
      values,
    });
  });
  return rows;
};

const buildStoreCapsuleRows = (storeContext: StoreContext): CapsuleRow[] => {
  const rows: CapsuleRow[] = [];

  if (storeContext.categories?.length) {
    rows.push({
      label: 'Categories',
      values: storeContext.categories.slice(0, 4).map((cat) => toTitleCase(cat.name)),
    });
  }

  if (storeContext.topBrands?.length) {
    rows.push({
      label: 'Brands',
      values: storeContext.topBrands.slice(0, 4).map((brand) => toTitleCase(brand)),
    });
  }

  if (storeContext.priceRange?.min && storeContext.priceRange?.max && storeContext.priceRange.max > storeContext.priceRange.min) {
    rows.push({
      label: 'Price range',
      values: [`$${Math.round(storeContext.priceRange.min)} – $${Math.round(storeContext.priceRange.max)}`],
    });
  }

  if (!rows.length && storeContext.primaryCategory) {
    rows.push({
      label: 'Focus',
      values: [toTitleCase(storeContext.primaryCategory)],
    });
  }

  return rows;
};

const buildProductCapsuleRows = (
  term: string,
  factSheets: ProductFactSheet[] | null,
  storeContext: StoreContext
): CapsuleRow[] => {
  const rows: CapsuleRow[] = [];
  const primarySheet = factSheets?.[0] ?? null;

  const styles = deriveStyleValues(term, primarySheet, storeContext);
  if (styles.length) {
    rows.push({ label: 'Types', values: styles.slice(0, 4) });
  }

  const flexValues = deriveFlexValues(primarySheet);
  if (flexValues.length) {
    rows.push({ label: 'Flex', values: flexValues.slice(0, 3) });
  }

  const widthValues = deriveWidthValues(primarySheet);
  if (widthValues.length) {
    rows.push({ label: 'Width', values: widthValues.slice(0, 3) });
  }

  if (!rows.length) {
    rows.push({
      label: 'What to consider',
      values: ['Flex', 'Shape', 'Sizing'],
    });
  }

  return rows;
};

const extractDefinitionTerm = (message: string): string | null => {
  const match = message.match(/\b(?:what|tell\s+me\s+what)\s+(?:is|are)\s+(?:a|an|the)?\s*([\w\s-]+)/i);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
};

const DEFAULT_DEFINITIONS: Array<{ pattern: RegExp; headline: string; detail: string }> = [
  {
    pattern: /sneakers?|shoes?/i,
    headline: 'Sneakers are versatile footwear designed to balance comfort, support, and everyday style.',
    detail: 'From lightweight runners to fashion-forward streetwear, materials and cushioning change the feel. Want help finding a pair for workouts, weekends, or both?',
  },
  {
    pattern: /jackets?|coats?/i,
    headline: 'Jackets keep you comfortable by pairing the right insulation and shell materials with your climate.',
    detail: 'Options range from breathable rain shells to insulated parkas. Tell me about the weather you face and I can narrow down the best fabrics and fits.',
  },
  {
    pattern: /laptops?|notebooks?/i,
    headline: 'Laptops combine processing power, battery life, and portability so you can work or create anywhere.',
    detail: 'Specs like CPU, RAM, and storage determine performance, while size and weight affect mobility. Want help matching a model to design work, school, or travel?',
  },
  {
    pattern: /sofas?|couches?|sectionals?/i,
    headline: 'Sofas anchor a living space with the right dimensions, support, and upholstery for how you relax.',
    detail: 'Sectional, sleeper, or loveseat—each has advantages depending on layout, seating needs, and fabric preferences. Shall I show you pieces sized for your room?',
  },
  {
    pattern: /skincare|serums?|moisturizers?/i,
    headline: 'Skincare products target hydration, tone, and texture using active ingredients tailored to your routine.',
    detail: 'From daily moisturizers to treatment serums, formulas shift based on skin goals. Share your concerns and I can highlight the sets that fit best.',
  },
];

const buildDefinitionFallback = (
  term: string,
  storeContext: StoreContext,
  knowledgeFactSheets: ProductFactSheet[] | null
): { headline: string; detail: string } => {
  const title = toTitleCase(term);

  const matched = DEFAULT_DEFINITIONS.find((entry) => entry.pattern.test(term));
  if (matched) {
    return matched;
  }

  const sheetSummary = knowledgeFactSheets?.[0]?.summary
    ?? knowledgeFactSheets?.[0]?.evidence?.[0]?.snippet
    ?? storeContext.factualSummary;

  const category = storeContext.primaryCategory?.toLowerCase() || 'our range';
  const headline = `${title} are part of our ${category} collection.`;
  const bridge = 'Want to see examples or explore the different styles we carry?';
  const detail = sheetSummary
    ? `${sheetSummary.replace(/\.$/, '')}. ${bridge}`
    : `We stock them in a range of builds and price points. ${bridge}`;

  return { headline, detail };
};

interface ModeDecisionMetadata {
  decided_by: string;
  groundability?: number;
  facet?: string | null;
  comparison_intent?: boolean;
  result_count: number;
}

interface ModeDecisionInput {
  topic: TurnTopic;
  mode: TurnMode;
  resultCount: number;
  groundability: number;
  bestFacet?: string | null;
  comparisonIntent?: boolean;
}

const deriveModeDecision = ({
  topic,
  mode,
  resultCount,
  groundability,
  bestFacet,
  comparisonIntent,
}: ModeDecisionInput): ModeDecisionMetadata => {
  if (topic !== 'commerce') {
    return {
      decided_by: `${topic}_topic`,
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (resultCount === 0) {
    return {
      decided_by: 'no_products',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (groundability < GROUNDABILITY_THRESHOLD) {
    return {
      decided_by: 'low_groundability',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (mode === 'clarify') {
    if (resultCount > ALWAYS_CLARIFY_ABOVE) {
      return {
        decided_by: 'high_result_count',
        groundability,
        facet: bestFacet ?? null,
        comparison_intent: comparisonIntent,
        result_count: resultCount,
      };
    }
    if (bestFacet) {
      return {
        decided_by: `facet_${bestFacet}`,
        groundability,
        facet: bestFacet,
        comparison_intent: comparisonIntent,
        result_count: resultCount,
      };
    }
    return {
      decided_by: 'clarify_default',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (mode === 'compare') {
    return {
      decided_by: comparisonIntent ? 'comparison_intent' : 'compare_small_set',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (mode === 'recommend') {
    if (resultCount <= SMALL_SET_CAP) {
      return {
        decided_by: 'curated_small_set',
        groundability,
        facet: bestFacet ?? null,
        comparison_intent: comparisonIntent,
        result_count: resultCount,
      };
    }
    return {
      decided_by: 'recommend_default',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (mode === 'dead_end') {
    return {
      decided_by: 'dead_end_no_match',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  if (mode === 'chat') {
    return {
      decided_by: 'chat_fallback',
      groundability,
      facet: bestFacet ?? null,
      comparison_intent: comparisonIntent,
      result_count: resultCount,
    };
  }

  return {
    decided_by: 'mode_default',
    groundability,
    facet: bestFacet ?? null,
    comparison_intent: comparisonIntent,
    result_count: resultCount,
  };
};

const buildProductCard = (
  product: Product,
  factSheet?: ProductFactSheet,
  userContext?: UserContext,
  enrichment?: ProductEnrichment | null
): ProductCard => {
  // Priority 1: Use factSheet evidence (knowledge packs - highest quality)
  const evidenceSnippet = factSheet?.summary
    ?? factSheet?.evidence?.[0]?.snippet
    ?? factSheet?.evidence?.[0]?.key;

  // Priority 2: Use whyReasons from knowledge packs
  const whyReason = factSheet?.evidence?.find((e) => typeof e.snippet === 'string' && e.snippet.length > 20)?.snippet;

  // Priority 3: Use enrichment with user context matching (NEW!)
  const enrichedContextual = enrichment && userContext
    ? generateReasonFromEnrichment(enrichment, userContext)
    : null;

  // Priority 4: Use enrichment why_good (general)
  const enrichedGeneral = enrichment?.why_good;

  // Priority 5: Generate contextual reasoning using industry knowledge module
  const contextualReason = userContext ? generateContextualReason(product, userContext) : null;

  // Priority 6: Product summary
  const summaryReason = product.summary?.bestFor?.[0] || product.summary?.keyFeatures?.[0];

  // Select best available reason
  const reason = whyReason ??
                 evidenceSnippet ??
                 enrichedContextual ??
                 enrichedGeneral ??
                 contextualReason ??
                 summaryReason ??
                 generateFallbackReason(product);

  return {
    id: product.id,
    title: product.title,
    price: product.price ?? 0,
    currency: product.currency ?? 'USD',
    image: product.image_url ?? null,
    badges: extractBadges(product),
    reason,
    handle: product.handle,
    variant_id: product.variants?.[0]?.id ?? null,
    similarity: product.combined_score ?? null,
  };
};

const buildComparisonSegment = (
  productIds: string[],
  productMap: Map<string, Product>,
  factSheetMap: Map<string, ProductFactSheet>
): Segment | null => {
  const comparisonItems: Array<{
    id: string;
    title: string;
    image?: string | null;
    features: Record<string, string | number | boolean | null | undefined>;
  }> = [];

  productIds.forEach((productId) => {
    const product = productMap.get(productId);
    if (!product) return;

    const sheet = factSheetMap.get(product.id);
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
      product.summary.keyFeatures.slice(0, 3).forEach((feature, index) => {
        features[`highlight_${index + 1}`] = feature;
      });
    }

    const item: {
      id: string;
      title: string;
      image?: string | null;
      features: Record<string, string | number | boolean | null | undefined>;
    } = {
      id: product.id,
      title: product.title,
      features,
    };

    if (product.image_url) {
      item.image = product.image_url;
    }

    comparisonItems.push(item);
  });

  if (comparisonItems.length < 2) {
    return null;
  }

  return {
    type: 'comparison',
    products: comparisonItems,
  } satisfies Segment;
};


type ConciergeStage = 'diagnosis_situation' | 'diagnosis_problem' | 'diagnosis_implication' | 'prescription_need_payoff' | 'closing' | 'smalltalk';

type ConversationMode = 'commerce' | 'smalltalk';


const INFO_PATTERNS = [
  /best time to buy/,
  /when is the best time/,
  /should i (?:buy|get)/,
  /when should i/,
  /do you offer financing/,
  /how (?:does|do) .* work/,
  /where should i start/,
  /what size should i get/,
  /tips?$/,
  /\bwhat(?:'s|s| is| are) (?:the difference|better|worse|important)/,
  /\bhow (?:do|does|should|can) (?:i|you|one|we) (?:choose|decide|pick|select)/,
  /\bhow to\b/,
  /\bwhat is the (?:best|right|correct|proper)/,
  /\bwhat are the (?:benefits|advantages|pros|cons)/,
  /\bhow\s+(?:good|bad|important|safe|big|long|much|many|far|often|well)\b/,
];

const inferConversationStage = ({
  mode: _mode,
  rapportMode,
  turnCount,
  pendingClarifier,
  manualClarifier,
  unresolvedFacets,
  productCount,
  negotiationState,
}: {
  mode: ConversationMode;
  rapportMode: boolean;
  turnCount: number;
  pendingClarifier: SessionMetadata['pendingClarifier'];
  manualClarifier: SessionMetadata['manualClarifier'];
  unresolvedFacets: string[];
  productCount: number;
  negotiationState: SessionMetadata['negotiationState'];
}): ConciergeStage => {
  if (rapportMode) {
    return 'smalltalk';
  }
  if (negotiationState) {
    return 'closing';
  }

  if (pendingClarifier || manualClarifier) {
    return 'diagnosis_problem';
  }

  if (productCount > 10 && unresolvedFacets.length > 0) {
    return 'diagnosis_situation';
  }

  if (unresolvedFacets.length > 0) {
    return 'diagnosis_implication';
  }

  if (turnCount > 0) {
    return 'prescription_need_payoff';
  }

  return 'diagnosis_situation';
};

const validateInitialFilters = (filters: Record<string, string>) => {
  const removed: Array<{ facet: string; value: string }> = [];

  const price = filters.price_bucket;
  if (price) {
    const trimmed = price.trim();
    // Allow standard buckets OR "Under $X" / "Over $X" patterns
    const isStandardBucket = INITIAL_ALLOWED_PRICE_BUCKETS.has(trimmed);
    const isUnderPattern = /^Under\s+\$\d+$/i.test(trimmed);
    const isOverPattern = /^Over\s+\$\d+$/i.test(trimmed);
    const isRangePattern = /^\$\d+-\$\d+$/.test(trimmed);

    if (!isStandardBucket && !isUnderPattern && !isOverPattern && !isRangePattern) {
      removed.push({ facet: 'price_bucket', value: price });
      delete filters.price_bucket;
    }
  }

  return removed;
};

const buildDeadEndTurn = (
  query: string,
  options: QuickReply[]
): ChatTurn => {
  const segments: Segment[] = [
    {
      type: 'note',
      tone: 'info',
      variant: 'soft_fail',
      text: `I couldn’t find an exact match for “${query}”.`,
    },
  ];

  if (options.length) {
    segments.push({ type: 'options', style: 'quick_replies', items: options.slice(0, 4) });
  }

  segments.push({
    type: 'note',
    tone: 'info',
    text: 'Try adjusting the filters, browsing best-sellers, or let me know what to change.',
  });

  return {
    turn_id: `deadend_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments,
    metadata: {
      tone: 'neutral',
      asked_slot: null,
      stage: 'dead_end',
    },
  };
};

const slugCategoryKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 64) || 'uncategorized';

const collectCategoryKeys = (products: Product[]) => {
  const keys = new Set<string>();
  products.forEach((product) => {
    const category = product.summary?.category ?? product.product_type ?? null;
    if (!category) return;
    keys.add(slugCategoryKey(category));
  });
  return Array.from(keys);
};
const computeUnresolvedFacets = (
  priority: string[],
  activeFilters: Record<string, string>,
  clarifierHistory: Record<string, number>,
  pendingClarifier: SessionMetadata['pendingClarifier'],
  manualClarifier: SessionMetadata['manualClarifier']
) => {
  const resolved = new Set<string>();
  Object.keys(activeFilters).forEach((facet) => resolved.add(facet));

  if (activeFilters.product_type && !resolved.has('style')) {
    resolved.add('style');
  }

  if (pendingClarifier?.facet) {
    resolved.add(pendingClarifier.facet);
  }

  if (manualClarifier?.facet) {
    resolved.add(manualClarifier.facet);
  }

  return priority.filter((facet) => {
    if (resolved.has(facet)) return false;
    const askedCount = clarifierHistory[facet] ?? 0;
    return askedCount < 2;
  });
};

const buildPlainConversationTurn = async (messages: ConversationMessage[], brandProfile?: any, storeCard?: any, mode: 'rapport' | 'info' = 'info'): Promise<ChatTurn> => {
  // Use Store Card for brand voice if available
  let brandTone = 'warm, helpful concierge';
  let storeContext = '';
  
  if (storeCard) {
    brandTone = `${storeCard.brand_voice.personality} (${storeCard.brand_voice.tone}, ${storeCard.brand_voice.formality})`;
    const { formatStoreCardForContext } = await import('../store-intelligence');
    storeContext = `\n\nStore Context: ${formatStoreCardForContext(storeCard)}`;
  } else if (typeof brandProfile?.tone === 'string') {
    brandTone = brandProfile.tone;
  }
  
  const systemPrompt = `You are a friendly retail concierge. Answer conversationally with at least three sentences that explain the topic, include practical context or tips, and close by inviting the shopper to keep chatting. Tone: ${brandTone}.${storeContext}`;

  const lastUserMessage = [...messages].reverse().find((message) => message.role === 'user')?.content?.trim() ?? '';

  const contents = [
    { role: 'user' as const, parts: [{ text: systemPrompt }] },
    ...messages.map((message) => ({
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: message.content }],
    })),
  ];

  const response = await chatModel.generateContent({
    contents,
    generationConfig: {
      temperature: mode === 'rapport' ? 0.7 : 0.6,
      topP: 0.9,
      maxOutputTokens: mode === 'rapport' ? 320 : 400,
    },
  });

  const rawText = response.response.text()?.trim() || 'Let me know how I can help.';

  if (mode === 'rapport') {
    return {
      turn_id: `plain_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      persona: 'concierge',
      segments: [
        { type: 'narrative', text: rawText },
      ],
      metadata: {
        tone: 'warm',
        stage: 'smalltalk',
        info_mode: false,
      },
    };
  }

  const sentences = rawText.split(/(?<=[.!?])\s+/).map((value) => value.trim()).filter(Boolean);
  const context = sentences.slice(0, 3).join(' ') || rawText.slice(0, 280);
  const contextSnippets = [
    lastUserMessage ? `User asked: ${lastUserMessage}` : null,
    context,
  ].filter(Boolean) as string[];

  const copy = await writeTurnCopy({
    mode: 'chat',
    counts: {},
    brandVoice: {
      tone: brandTone,
      persona: typeof brandProfile?.persona === 'string' ? brandProfile.persona : undefined,
    },
    contextSnippets,
    userQuery: lastUserMessage || undefined,
  });

  return {
    turn_id: `plain_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    persona: 'concierge',
    segments: [
      { type: 'narrative', text: copy.lead },
      { type: 'narrative', text: copy.detail },
    ],
    metadata: {
      tone: 'warm',
      stage: 'smalltalk',
      info_mode: true,
      info_source: rawText,
    },
  };
};
export const runConversationPipeline = async (
  input: ConversationPipelineInput,
  deps: ConversationPipelineDependencies
): Promise<ConversationPipelineResult> => {
  const { shopId, sessionId, messages, sessionMetadata, brandProfile, resultLimit = 17 } = input;
  const userMessage = messages[messages.length - 1];

  // Fetch Store Card for brand-aware responses
  let storeCard: any = null;
  try {
    const { fetchStoreCard } = await import('../store-intelligence');
    storeCard = await fetchStoreCard(shopId);
    console.log(`Store Card loaded for ${shopId}:`, storeCard.store_name);
  } catch (error) {
    console.warn(`Failed to fetch Store Card for ${shopId}:`, error);
    // Continue without Store Card (graceful degradation)
  }

  if (!userMessage || userMessage.role !== 'user') {
    throw new Error('Conversation pipeline requires a trailing user message');
  }

  // Track topic anchor for pronoun resolution
  let topicAnchor: TopicAnchor | null = (sessionMetadata as any).topicAnchor || null;

  // New hard routing with topic classification
  const topic: TurnTopic = classifyTopic(userMessage.content);
  const rapportMode = topic === 'rapport';
  const infoMode = topic === 'store_info' || topic === 'policy_info' || topic === 'product_info';
  const isSmallTalk = rapportMode || infoMode;
  const conversationMode: ConversationMode = isSmallTalk ? 'smalltalk' : 'commerce';

  const normalizedMessage = userMessage.content.trim().toLowerCase();
  const sentimentScore = analyzeSentiment(userMessage.content);
  let sentiment: 'positive' | 'neutral' | 'concerned' | null = null;
  if (rapportMode && sentimentScore > 0.25) {
    sentiment = 'positive';
  } else if (sentimentScore < -0.25 || normalizedMessage.includes('frustrated') || normalizedMessage.includes('angry')) {
    sentiment = 'concerned';
  } else if (Math.abs(sentimentScore) > 0.05) {
    sentiment = 'neutral';
  }

  const turnCount = messages.filter((message) => message.role === 'user').length;

  let accumulatedIntent: AccumulatedIntent = sessionMetadata.accumulatedIntent ?? {};
  messages.forEach((msg) => {
    if (msg.role === 'user') {
      accumulatedIntent = extractIntent(msg.content, accumulatedIntent);
    }
  });

  // Enhance vague queries with dialogue context
  // "what can I get for 300" → "snowboard what can I get for 300" (after discussing snowboards)
  const enhancedQuery = enhanceQueryWithContext({
    query: userMessage.content,
    messages,
    topicAnchor,
  });

  const semanticQuery = buildLexicalQuery(enhancedQuery);

  let activeOntologyVersion: string | null = null;
  if (config.featureFlags.verticalPacks) {
    activeOntologyVersion = await fetchActiveOntologyVersion(deps.supabaseAdmin, shopId);
  }

  let canonCandidatesCache: CanonShard[] | null = null;
  let knowledgeFactSheets: ProductFactSheet[] | null = sessionMetadata.factSheetCache?.facts ?? null;

  const embedding = await deps.generateEmbedding(enhancedQuery);

  let activeFilters: Record<string, string> = {
    ...(sessionMetadata.activeFilters ?? {}),
  };

  // Handle price filters - construct price_bucket from min/max if present
  if (accumulatedIntent.priceBucket) {
    activeFilters.price_bucket = accumulatedIntent.priceBucket;
  } else if (accumulatedIntent.maxPrice && !accumulatedIntent.minPrice) {
    // "under $400" case
    activeFilters.price_bucket = `Under $${accumulatedIntent.maxPrice}`;
  } else if (accumulatedIntent.minPrice && !accumulatedIntent.maxPrice) {
    // "over $400" case
    activeFilters.price_bucket = `Over $${accumulatedIntent.minPrice}`;
  } else if (accumulatedIntent.minPrice && accumulatedIntent.maxPrice) {
    // "$200-$400" case
    activeFilters.price_bucket = `$${accumulatedIntent.minPrice}-$${accumulatedIntent.maxPrice}`;
  }

  if (accumulatedIntent.selectedVendor) {
    activeFilters.vendor = accumulatedIntent.selectedVendor;
  }

  let pendingClarifierNext = sessionMetadata.pendingClarifier ?? null;
  let manualClarifierNext = sessionMetadata.manualClarifier ?? null;
  let manualClarifierPrompt: string | null = null;
  let relaxationSteps: RelaxationStep[] = [];
  const offersPresented: string[] = [];
  let negotiationStateNext: SessionMetadata['negotiationState'] = sessionMetadata.negotiationState ?? null;

  if (!isSmallTalk && sessionMetadata.manualClarifier) {
    const manualFacet = sessionMetadata.manualClarifier.facet;
    const typed = userMessage.content.trim();
    const normalisedTyped = normalise(typed);

    if (typed && normalisedTyped !== 'something else') {
      const manualValue = applyManualFacetValue(manualFacet, typed);
      if (manualValue) {
        activeFilters[manualFacet] = manualValue;
        manualClarifierNext = null;
        pendingClarifierNext = null;
      }
    }
  } else if (isSmallTalk) {
    manualClarifierNext = null;
  }

  if (!isSmallTalk && sessionMetadata.pendingClarifier) {
    const pending = sessionMetadata.pendingClarifier;
    const messageValue = normalise(userMessage.content);

    if (['something else', 'skip', 'skip for now', 'skip_for_now'].includes(messageValue)) {
      delete activeFilters[pending.facet];
      pendingClarifierNext = null;
      manualClarifierNext = { facet: pending.facet };
      manualClarifierPrompt = manualPromptForFacet(pending.facet);
    } else {
      const matched = pending.options.find((option) => {
        const candidates = [option.label, option.value];
        return candidates.some((candidate) => normalise(candidate) === messageValue);
      });

      if (matched) {
        activeFilters[pending.facet] = matched.value;
        pendingClarifierNext = null;
        manualClarifierNext = null;
      }
    }
  } else if (isSmallTalk) {
    pendingClarifierNext = null;
  }

  let canonInsightsForPrompt: CanonInsight[] = [];
  if (activeOntologyVersion) {
    if (!canonCandidatesCache) {
      canonCandidatesCache = await fetchCanonCandidates(
        deps.supabaseAdmin,
        shopId,
        activeOntologyVersion,
        120
      );
    }
    const ranked = rankCanonShards(canonCandidatesCache ?? [], embedding, 4);
    canonInsightsForPrompt = ranked.map((entry) => ({
      topic: entry.topic,
      assertions: entry.assertions,
      caveats: entry.caveats,
      citation: entry.citation,
    }));
  }

  let calculatorConfigs: Array<{ calculator_id: string; config: Record<string, unknown>; ontology_version: string }> = [];
  if (!isSmallTalk && activeOntologyVersion) {
    const registryRows = await fetchCalculatorRegistry(deps.supabaseAdmin, shopId);
    calculatorConfigs = (registryRows ?? []).filter((row) => !row.ontology_version || row.ontology_version === activeOntologyVersion);
  }

  const calculatorsForDetection = calculatorConfigs
    .map((row) => defaultCalculators.find((calculator) => calculator.id === row.calculator_id))
    .filter((calculator): calculator is (typeof defaultCalculators)[number] => Boolean(calculator));

  const calculatorResults = await detectAndRunCalculators(userMessage.content, calculatorsForDetection);

  const metrics: ConversationMetrics = {
    turnCount,
    zeroResultCount: sessionMetadata.zeroResultStreak,
    repeatedClarifiers: calculateRepeatedClarifiers(sessionMetadata.clarifierHistory),
  };

  const filterCleanup: Array<{ facet: string; value: string }> = isSmallTalk
    ? []
    : validateInitialFilters(activeFilters);

  let retrieval: RetrievalSet;
  if (rapportMode) {
    retrieval = {
      products: [],
      facets: new Map(),
    };
  } else if (topic === 'product_info') {
    retrieval = await runHybridSearch(
      { supabaseAdmin: deps.supabaseAdmin },
      {
        shopId,
        lexicalQuery: semanticQuery,
        embedding,
        limit: resultLimit,
        activeFilters,
      }
    );
  } else if (infoMode) {
    retrieval = {
      products: [],
      facets: new Map(),
    };
  } else {
    retrieval = await runHybridSearch(
      { supabaseAdmin: deps.supabaseAdmin },
      {
        shopId,
        lexicalQuery: semanticQuery,
        embedding,
        limit: resultLimit,
        activeFilters,
      }
    );
  }

  // Extract store context with safe fallbacks - never show "0 products"
  let storeContext: StoreContext;
  if (retrieval.products.length > 0) {
    storeContext = extractStoreContext(retrieval.products);
  } else {
    // Use safe context that computes on-demand if needed
    storeContext = await getStoreContextSafe(deps.supabaseAdmin, shopId);
  }

  // Check for unresolved pronouns and handle clarification
  // BUT: Skip pronoun checking for rapport/info messages (they have clear intent)
  const pronounCheck = (rapportMode || infoMode) ? { needsClarification: false } : resolveReferent(userMessage.content, topicAnchor);
  if (pronounCheck.needsClarification) {
    // Create clarification turn for unresolved pronouns
    const clarifyTurn = createClarificationTurn(storeContext);

    return {
      pepTurn: clarifyTurn,
      retrieval: { products: [], facets: new Map() },
      metrics,
      zeroResultStreakNext: sessionMetadata.zeroResultStreak,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: null,
      relaxationSteps,
      offersPresented,
      negotiationState: negotiationStateNext,
      factSheets: undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'dialogue' },
      rapportMode: false,
      infoMode: false,
      dialogueSummary: sessionMetadata.dialogueSummary ?? null,
      sentiment,
    };
  }

  // Update topic anchor based on current turn
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');
  topicAnchor = updateTopicAnchor(
    topicAnchor,
    userMessage.content,
    lastAssistantMessage?.content || '',
    storeContext.primaryCategory,
    storeContext.topBrands
  );

  // Handle store_info with capsule view and bridge options
  if (topic === 'store_info') {
    const rows = buildStoreCapsuleRows(storeContext);
    const subject = storeContext.primaryCategory && storeContext.primaryCategory !== 'products'
      ? toTitleCase(storeContext.primaryCategory)
      : 'our collection';
    const bridgeOptions: QuickReply[] = [
      {
        id: 'store_show_primary',
        label: `Show ${subject}`,
        value: storeContext.primaryCategory ? `show me ${storeContext.primaryCategory}` : 'show me your products',
      },
      {
        id: 'store_help_choose',
        label: 'Help me choose',
        value: 'help me choose',
      },
    ];

    const infoSegments: Segment[] = [
      {
        type: 'narrative',
        text: rows.length
          ? `Here’s what we carry`
          : `We curate a selection built around what you’re shopping for.`,
      },
    ];

    if (rows.length) {
      infoSegments.push({ type: 'capsule', rows });
    }

    infoSegments.push({
      type: 'options',
      style: 'quick_replies',
      items: bridgeOptions,
    });

    const infoTurn: ChatTurn = {
      turn_id: `info_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      persona: 'concierge',
      segments: infoSegments,
      metadata: {
        tone: 'warm',
        stage: 'smalltalk',
        info_mode: true,
        reason: {
          topic,
          mode: 'info',
          decided_by: 'store_info_capsule',
          product_count: 0,
        },
        ui_hints: { mode: 'dialogue' },
      },
    };

    const infoSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, infoTurn);

    return {
      pepTurn: infoTurn,
      retrieval: { products: [], facets: new Map() },
      metrics,
      zeroResultStreakNext: sessionMetadata.zeroResultStreak,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: null,
      relaxationSteps,
      offersPresented,
      negotiationState: negotiationStateNext,
      factSheets: undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'dialogue' },
      rapportMode: false,
      infoMode: true,
      dialogueSummary: infoSummary,
      sentiment,
    };
  }
  if (topic === 'policy_info') {
    const focus = detectPolicyFocus(userMessage.content);
    const policies = storeContext.policies ?? {};

    const policyValues: Record<'shipping' | 'returns' | 'warranty', string[]> = {
      shipping: splitPolicyText(policies?.shipping),
      returns: splitPolicyText(policies?.returns),
      warranty: splitPolicyText(policies?.warranty),
    };

    let focusSummary: string | null = null;
    if (focus !== 'general' && policyValues[focus]?.length) {
      const [headline, ...rest] = policyValues[focus];
      focusSummary = headline ?? null;
      policyValues[focus] = rest;
    }

    const policyRows: CapsuleRow[] = (['shipping', 'returns', 'warranty'] as const)
      .map((key) => ({ key, values: policyValues[key] }))
      .filter(({ values }) => values && values.length)
      .map(({ key, values }) => ({
        label: toTitleCase(key),
        values: values.slice(0, 4),
      }));

    const quickReplies: QuickReply[] = [
      {
        id: 'policy_shop',
        label: storeContext.primaryCategory && storeContext.primaryCategory !== 'products'
          ? `Shop ${toTitleCase(storeContext.primaryCategory)}`
          : 'Browse products',
        value: storeContext.primaryCategory
          ? `show me ${storeContext.primaryCategory}`
          : 'show me your products',
      },
      {
        id: 'policy_help_choose',
        label: 'Help me choose',
        value: storeContext.primaryCategory
          ? `help me choose ${storeContext.primaryCategory}`
          : 'help me choose',
      },
      {
        id: 'policy_contact',
        label: 'Talk to a person',
        value: 'connect me with support',
      },
    ];

    const hasPolicyData = Boolean(focusSummary) || policyRows.length > 0;
    let decidedBy = 'policy_capsule';
    let infoSegments: Segment[];

    if (!hasPolicyData) {
      const templateCopy = await generateSmartTemplateCopy({
        mode: 'chat',
        topic,
        slots: {
          category: storeContext.primaryCategory,
          userQuery: userMessage.content,
        },
        storeContext,
        brandVoice: {
          tone: typeof brandProfile?.tone === 'string' ? brandProfile.tone : 'warm, helpful concierge',
          persona: typeof brandProfile?.persona === 'string' ? brandProfile.persona : undefined,
        },
        experiments: brandProfile?.experiments ?? null,
      });

      decidedBy = 'policy_template';
      infoSegments = [
        { type: 'narrative', text: templateCopy.lead },
        { type: 'note', tone: 'info', text: templateCopy.detail },
      ];
    } else {
      const headline = focus !== 'general' && (focusSummary || policyRows.length)
        ? `Here’s how our ${focus} policy works.`
        : 'Here’s how our store policies work.';

      infoSegments = [{ type: 'narrative', text: headline }];

      if (focusSummary) {
        infoSegments.push({ type: 'note', tone: 'info', text: focusSummary });
      }

      if (policyRows.length) {
        infoSegments.push({ type: 'capsule', rows: policyRows });
      }
    }

    infoSegments.push({ type: 'options', style: 'quick_replies', items: quickReplies });

    const infoTurn: ChatTurn = {
      turn_id: `policy_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      persona: 'concierge',
      segments: infoSegments,
      metadata: {
        tone: 'warm',
        stage: 'smalltalk',
        info_mode: true,
        reason: {
          topic,
          mode: 'info',
          decided_by: decidedBy,
          product_count: 0,
        },
        ui_hints: { mode: 'dialogue' },
      },
    };

    const infoSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, infoTurn);

    return {
      pepTurn: infoTurn,
      retrieval: { products: [], facets: new Map() },
      metrics,
      zeroResultStreakNext: sessionMetadata.zeroResultStreak,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: null,
      relaxationSteps,
      offersPresented,
      negotiationState: negotiationStateNext,
      factSheets: undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'dialogue' },
      rapportMode: false,
      infoMode: true,
      dialogueSummary: infoSummary,
      sentiment,
    };
  }
  if (topic === 'product_info') {
    const insight = canonInsightsForPrompt[0];
    const term = extractDefinitionTerm(userMessage.content) ?? storeContext.primaryCategory ?? 'item';
    const fallbackDefinition = buildDefinitionFallback(term, storeContext, knowledgeFactSheets);

    const rows = buildProductCapsuleRows(term, knowledgeFactSheets, storeContext);
    const headline = insight?.assertions?.[0] ?? fallbackDefinition.headline;
    const detail = insight?.assertions?.slice(1, 3).filter(Boolean).join(' ') || fallbackDefinition.detail;

    const quickReplies: QuickReply[] = [
      { id: 'product_examples', label: `Show ${toTitleCase(term)} we carry`, value: `show me ${term}` },
      { id: 'product_help_choose', label: 'Help me choose', value: `help me choose ${term}` },
    ];

    const infoSegments: Segment[] = [{ type: 'narrative', text: headline }];
    if (rows.length) {
      infoSegments.push({ type: 'capsule', rows });
    }
    if (detail) {
      infoSegments.push({ type: 'note', tone: 'info', text: detail });
    }
    infoSegments.push({ type: 'options', style: 'quick_replies', items: quickReplies });

    const infoTurn: ChatTurn = {
      turn_id: `definition_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      persona: 'concierge',
      segments: infoSegments,
      metadata: {
        tone: 'warm',
        stage: 'smalltalk',
        info_mode: true,
        reason: {
          topic,
          mode: 'info',
          decided_by: 'product_info_capsule',
          product_count: 0,
          subject: term,
        },
        info_source: insight?.assertions ?? null,
        ui_hints: { mode: 'dialogue' },
      },
    };

    const infoSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, infoTurn);

    return {
      pepTurn: infoTurn,
      retrieval: { products: [], facets: new Map() },
      metrics,
      zeroResultStreakNext: sessionMetadata.zeroResultStreak,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: null,
      relaxationSteps,
      offersPresented,
      negotiationState: sessionMetadata.negotiationState ?? null,
      factSheets: knowledgeFactSheets ?? undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'dialogue' },
      rapportMode: false,
      infoMode: true,
      dialogueSummary: infoSummary,
      sentiment,
    };
  }
  if (rapportMode && !infoMode) {
    const plainTurn = await buildPlainConversationTurn(messages, brandProfile, storeCard, 'rapport');
    const rapportRetrieval: RetrievalSet = {
      products: [],
      facets: new Map(),
    };

    const rapportSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, plainTurn);

    return {
      pepTurn: plainTurn,
      retrieval: rapportRetrieval,
      metrics,
      zeroResultStreakNext: sessionMetadata.zeroResultStreak,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: null,
      relaxationSteps,
      offersPresented,
      negotiationState: negotiationStateNext,
      factSheets: undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'dialogue' },
      rapportMode: true,
      infoMode: false,
      dialogueSummary: rapportSummary,
      sentiment,
    };
  }


  const relaxationNotes: Segment[] = [];
  const relaxationUndoOptions: QuickReply[] = [];

  const needsRelaxation = !isSmallTalk && retrieval.products.length === 0;

  if (needsRelaxation) {
    const relaxationOutcome = await attemptRelaxation(
      deps,
      {
        shopId,
        lexicalQuery: semanticQuery,
        embedding,
        limit: resultLimit,
      },
      activeFilters,
      retrieval
    );

    relaxationSteps = relaxationOutcome.steps;
    relaxationNotes.push(...relaxationOutcome.notes);
    relaxationUndoOptions.push(...relaxationOutcome.undoOptions);
    retrieval = relaxationOutcome.retrieval;
    activeFilters = relaxationOutcome.filters;
    if (retrieval.products.length === 0 && relaxationOutcome.steps.length) {
      relaxationNotes.unshift({
        type: 'note',
        tone: 'info',
        variant: 'soft_fail',
        text: `No exact matches for “${userMessage.content}”. I tried broadening things a bit.`,
      });
    }
  }

  if (filterCleanup.length && !isSmallTalk) {
    filterCleanup.forEach(({ facet, value }) => {
      relaxationNotes.push({
        type: 'note',
        tone: 'info',
        variant: 'relaxation',
        text: `I couldn’t match the ${describeFacetLabel(facet)} “${value}”, so I cleared it.`,
      });
    });
  }


  // Only fall back to info mode if truly no products AND query seems informational
  if (!isSmallTalk && retrieval.products.length === 0) {
    // Check if this seems like a genuine info request rather than failed product search
    const hasProductMention = SHOPPING_INTENT_PATTERN.test(normalizedMessage);
    const hasShoppingWords = /\b(recommend|buy|purchase|get|need|want|looking for|show me)\b/i.test(normalizedMessage);
    const looksLikeInfoRequest = INFO_PATTERNS.some((pattern) => pattern.test(normalizedMessage))
      && !hasProductMention
      && !hasShoppingWords;  // If has shopping words, don't fall back to info!

    if (looksLikeInfoRequest) {
      const plainTurn = await buildPlainConversationTurn(messages, brandProfile, storeCard, 'info');
      const infoRetrieval: RetrievalSet = { products: [], facets: new Map() };
      const infoSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, plainTurn);

      return {
        pepTurn: plainTurn,
        retrieval: infoRetrieval,
        metrics,
        zeroResultStreakNext: sessionMetadata.zeroResultStreak,
        askedSlot: null,
        clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
        userMessage: userMessage.content,
        accumulatedIntent,
        activeFilters,
        pendingClarifier: null,
        manualClarifier: manualClarifierNext,
        relaxationSteps,
        offersPresented,
        negotiationState: negotiationStateNext,
        factSheets: undefined,
        factSheetCache: sessionMetadata.factSheetCache ?? null,
        uiHints: { mode: 'dialogue' },
        rapportMode,
        infoMode: true,
        dialogueSummary: infoSummary,
        sentiment,
      };
    }
  }

  if (!isSmallTalk && retrieval.products.length === 0) {
    const fallbackOptions: QuickReply[] = [
      ...relaxationUndoOptions,
      { id: 'browse_popular', label: 'Show best-sellers' },
      { id: 'notify_me', label: 'Notify me when it’s back' },
      { id: 'expert_help', label: 'Talk to an expert' },
    ];

    const deadEndTurn = buildDeadEndTurn(userMessage.content, fallbackOptions);

    return {
      pepTurn: deadEndTurn,
      retrieval,
      metrics: {
        turnCount,
        zeroResultCount: sessionMetadata.zeroResultStreak,
        repeatedClarifiers: calculateRepeatedClarifiers(sessionMetadata.clarifierHistory),
      },
      zeroResultStreakNext: sessionMetadata.zeroResultStreak + 1,
      askedSlot: null,
      clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
      userMessage: userMessage.content,
      accumulatedIntent,
      activeFilters,
      pendingClarifier: null,
      manualClarifier: manualClarifierNext,
      relaxationSteps,
      offersPresented,
      negotiationState: negotiationStateNext,
      factSheets: undefined,
      factSheetCache: sessionMetadata.factSheetCache ?? null,
      uiHints: { mode: 'recovery' },
      rapportMode: false,
      infoMode: false,
      dialogueSummary: sessionMetadata.dialogueSummary ?? null,
      sentiment,
    };
  }

  const candidates = selectCandidateProducts(retrieval);
  const candidateFactIds = sliceFactProductIds(candidates);
  let facetPriority: string[] = [];
  let canonicalClarifiers: Record<string, ClarifierOption[]> = {};


  if (!isSmallTalk && activeOntologyVersion && candidateFactIds.length) {
    const knowledgePacks = await fetchKnowledgePacksByProducts(
      deps.supabaseAdmin,
      shopId,
      candidateFactIds,
      activeOntologyVersion
    );

    if (knowledgePacks.length) {
      const packByProduct = new Map<string, KnowledgePack>();
      knowledgePacks.forEach((pack) => {
        packByProduct.set(pack.productId, pack);
      });
      knowledgeFactSheets = candidates
        .filter((product) => packByProduct.has(product.id))
        .map((product) => buildFactSheetFromKnowledge(product, packByProduct.get(product.id)!));
    }
  }

  if (!isSmallTalk) {
    const categoryKeys = collectCategoryKeys(candidates);
    ({ facetPriority, canonicalClarifiers } = await loadCategoryClarifierConfig(
      { supabaseAdmin: deps.supabaseAdmin },
      shopId,
      categoryKeys
    ));
  }

  const unresolvedFacets = rapportMode
    ? []
    : computeUnresolvedFacets(
        facetPriority,
        activeFilters,
        sessionMetadata.clarifierHistory ?? {},
        pendingClarifierNext,
        manualClarifierNext
      );

  const availableFacetValues: Record<string, string[]> = {};
  if (!isSmallTalk) {
    unresolvedFacets.forEach((facet) => {
      const values = computeFacetValues(facet, retrieval, canonicalClarifiers);
      if (values.length) {
        availableFacetValues[facet] = values;
      }
    });

    const sanitizeResult = sanitizeFilters({
      activeFilters,
      canonicalClarifiers,
      retrieval,
      defaultChoices: DEFAULT_CLARIFIER_CHOICES,
    });

    if (sanitizeResult.removed.length) {
      filterCleanup.push(...sanitizeResult.removed);
      activeFilters = sanitizeResult.filters;
    }
  }

  let factSheets: ProductFactSheet[] | undefined;
  let factSheetCacheNext: FactSheetCache | null = sessionMetadata.factSheetCache ?? null;
  const cachedFactContext = sessionMetadata.factSheetCache ?? null;
  const cacheMatchesCandidates = cachedFactContext
    ? arraysEqual(cachedFactContext.productIds, candidateFactIds)
    : false;
  const hasFreshCache = cacheMatchesCandidates && isCacheFresh(cachedFactContext);

  if (hasFreshCache && cachedFactContext) {
    factSheets = cachedFactContext.facts;
  } else if (!cacheMatchesCandidates && cachedFactContext) {
    factSheetCacheNext = null;
  }

  if (knowledgeFactSheets?.length) {
    factSheets = knowledgeFactSheets;
    factSheetCacheNext = {
      productIds: candidateFactIds,
      facts: knowledgeFactSheets,
      fetchedAt: new Date().toISOString(),
    };
  }

  if (!isSmallTalk && config.featureFlags.verticalPacks) {
    const plan = planToolsForTurn({
      intent: 'find_product',
      products: candidates,
      message: userMessage.content,
      candidateFactIds,
      hasCachedFacts: Boolean(factSheets?.length),
      recentFactCache: cachedFactContext
        ? { productIds: cachedFactContext.productIds, fetchedAt: cachedFactContext.fetchedAt }
        : undefined,
    });

    const hadCachedFacts = Boolean(factSheets?.length);
    const shouldFetchFacts = (plan.callFactTool || !hadCachedFacts) && !knowledgeFactSheets?.length;

    if (shouldFetchFacts) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      try {
        const facts = await fetchProductFacts(
          shopId,
          candidateFactIds,
          controller.signal
        );
        if (facts?.length) {
          factSheets = facts;
          factSheetCacheNext = {
            productIds: candidateFactIds,
            facts,
            fetchedAt: new Date().toISOString(),
          };
          logShadowFactUsage(shopId, sessionId, {
            product_ids: facts.map((fact) => fact.id),
            sample: facts.slice(0, 3),
          }).catch((error) => {
            console.debug('[pipeline] failed to log fact sheets', error);
          });
        }
      } catch (error) {
        console.warn('[pipeline] fact tool failed', (error as Error).message);
      } finally {
        clearTimeout(timeout);
      }

      if ((!factSheets || factSheets.length === 0)) {
        fetchProductFactsShadow(shopId, candidates, sessionId).catch((error) => {
          console.debug('[pipeline] shadow tool failed', error);
        });
      }
    }

  }

  const conversationStagePreLLM = inferConversationStage({
    mode: conversationMode,
    rapportMode: rapportMode || infoMode,
    turnCount,
    pendingClarifier: pendingClarifierNext,
    manualClarifier: manualClarifierNext,
    unresolvedFacets,
    productCount: retrieval.products.length,
    negotiationState: sessionMetadata.negotiationState ?? null,
  });

  const choiceOverload = !(rapportMode || infoMode) && retrieval.products.length > 10;
  const recommendedSetSize = !(rapportMode || infoMode)
    ? (retrieval.products.length > 8 ? 3 : Math.min(retrieval.products.length, 4))
    : undefined;
  const validationMessage = !(rapportMode || infoMode) && retrieval.products.length
    ? `Found ${Math.min(retrieval.products.length, resultLimit)} curated matches based on your request.`
    : undefined;

  let pepTurn: ChatTurn | null = null;
  let askedSlot: string | null = null;
  let conversationStageFinal: ConciergeStage = conversationStagePreLLM;
  let uiHints: ConciergeLayoutHints | undefined;
  let modeDecision: ModeDecisionMetadata | null = null;

  if (manualClarifierPrompt && manualClarifierNext?.facet) {
    pepTurn = buildManualClarifierTurn(
      manualClarifierNext.facet,
      manualClarifierPrompt,
      retrieval.products.length
    );
    askedSlot = manualClarifierNext.facet;
    modeDecision = {
      decided_by: 'manual_clarifier',
      result_count: retrieval.products.length,
    };
  } else {
    try {
      const { domainConfidence } = computeGroundabilityMetrics(retrieval);

      // Use new hard routing gates
      const turnMode: TurnMode = pickMode(topic, retrieval, sessionMetadata, userMessage.content);

      const groundabilityScore = calculateGroundability(retrieval);
      const askedFacetSet = new Set(Object.keys(sessionMetadata.clarifierHistory || {}));
      const bestFacetCandidate = selectBestFacet(retrieval, askedFacetSet, sessionMetadata, userMessage.content);
      const comparisonIntent = /\b(compare|versus|vs\.?|difference)\b/i.test(userMessage.content);
      modeDecision = deriveModeDecision({
        topic,
        mode: turnMode,
        resultCount: retrieval.products.length,
        groundability: groundabilityScore,
        bestFacet: bestFacetCandidate?.facet ?? null,
        comparisonIntent,
      });

      let clarifierFacet: string | null = null;
      let clarifierQuestion: string | null = null;
      let clarifierOptionsForSession: Array<{ label: string; value: string }> = [];
      let clarifierOptionsDisplay: QuickReply[] = [];

      // If mode is clarify, find the best facet
      if (turnMode === 'clarify') {
        const strategy = decideTurnStrategy(retrieval, {
          askedSlots: sessionMetadata.askedSlots,
          clarifierHistory: sessionMetadata.clarifierHistory,
        });

        if (strategy.askClarifier && strategy.facetToAsk) {
          const canonicalValues = availableFacetValues[strategy.facetToAsk] ?? strategy.optionValues ?? [];
          const resolvedOptions = facetToOptions(strategy.facetToAsk, canonicalValues)
            .filter((option) => Boolean(option.label) && Boolean(option.value ?? option.label))
            .slice(0, CLARIFIER_OPTION_CAP - 1);

          if (resolvedOptions.length >= 2) {
            clarifierFacet = strategy.facetToAsk;
            clarifierQuestion = facetToQuestion(clarifierFacet);
            clarifierOptionsForSession = resolvedOptions.map((option) => ({
              label: option.label,
              value: option.value ?? option.label,
            }));
            clarifierOptionsDisplay = [...resolvedOptions];
            if (!clarifierOptionsDisplay.some((option) => option.value === SOMETHING_ELSE_QUICK_REPLY.value)) {
              clarifierOptionsDisplay.push(SOMETHING_ELSE_QUICK_REPLY);
            }
          }
        }
      }

      if (turnMode === 'clarify' && clarifierFacet && modeDecision) {
        modeDecision = {
          ...modeDecision,
          facet: clarifierFacet,
        };
      }

      if (turnMode === 'chat') {
        const plainTurn = await buildPlainConversationTurn(messages, brandProfile, storeCard, rapportMode ? 'rapport' : 'info');
        const infoSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, plainTurn);

        return {
          pepTurn: plainTurn,
          retrieval,
          metrics,
          zeroResultStreakNext: sessionMetadata.zeroResultStreak,
          askedSlot: null,
          clarifierHistoryPatch: { ...sessionMetadata.clarifierHistory },
          userMessage: userMessage.content,
          accumulatedIntent,
          activeFilters,
          pendingClarifier: null,
          manualClarifier: null,
          relaxationSteps,
          offersPresented,
          negotiationState: negotiationStateNext,
          factSheets,
          factSheetCache: sessionMetadata.factSheetCache ?? null,
          uiHints: { mode: 'dialogue' },
          rapportMode,
          infoMode: !rapportMode,
          dialogueSummary: infoSummary,
          sentiment,
        };
      }

      const productMap = new Map(candidates.map((product) => [product.id, product]));
      const factSheetMap = new Map((factSheets ?? []).map((sheet) => [sheet.id, sheet]));

      // Fetch product enrichments (auto-extracted specs and intelligence)
      const enrichmentMap = new Map<string, ProductEnrichment>();
      const enrichmentPromises = candidates.slice(0, 5).map(async (product) => {
        try {
          const enrichment = await getProductEnrichment(deps.supabaseAdmin, product);
          if (enrichment && enrichment.confidence && enrichment.confidence > 0.3) {
            enrichmentMap.set(product.id, enrichment);
          }
        } catch (error) {
          console.debug('[pipeline] enrichment fetch failed:', (error as Error).message);
        }
      });
      await Promise.allSettled(enrichmentPromises);  // Don't block on failures

      // Will be set after extracting skill/conditions
      let userContext: UserContext | undefined;

      const previewProducts = candidates.slice(0, 2);
      const recommendedProducts = candidates.slice(0, recommendedSetSize ?? 3);

      const comparisonIds = turnMode === 'compare'
        ? candidates.slice(0, Math.min(3, candidates.length)).map((product) => product.id)
        : [];
      const comparisonSegment = turnMode === 'compare'
        ? buildComparisonSegment(comparisonIds, productMap, factSheetMap)
        : null;

      // Extract lifestyle attributes from user message
      const skillMatch = userMessage.content.match(/\b(beginner|intermediate|advanced|expert)\b/i);
      const conditionsMatch = userMessage.content.match(/\b(icy|powder|park|groomer|backcountry|freestyle|all-mountain)\b/i);

      // Build user context for industry knowledge
      userContext = {
        skillLevel: skillMatch?.[1],
        conditions: conditionsMatch?.[1],
        budget: accumulatedIntent.maxPrice || undefined
      };

      // Build product cards with contextual reasoning + enrichments
      const previewCards = previewProducts.map((product) =>
        buildProductCard(
          product,
          factSheetMap.get(product.id),
          userContext,
          enrichmentMap.get(product.id)
        )
      );
      const recommendedCards = recommendedProducts.map((product) =>
        buildProductCard(
          product,
          factSheetMap.get(product.id),
          userContext,
          enrichmentMap.get(product.id)
        )
      );

      // Use template-based copy system
      const experiments = brandProfile?.experiments ?? null;

      const copy = await generateSmartTemplateCopy({
        mode: turnMode,
        topic: 'commerce',
        slots: {
          count: turnMode === 'clarify' ? candidates.length : recommendedCards.length,
          category: storeContext.primaryCategory,
          facet: clarifierFacet || 'preference',  // Default to 'preference' if no facet
          priceRange: storeContext.priceRange.min && storeContext.priceRange.max
            ? `$${Math.round(storeContext.priceRange.min)}-$${Math.round(storeContext.priceRange.max)}`
            : undefined,
          nextAction: turnMode === 'recommend' ? 'compare or add to cart' : undefined,
          skillLevel: skillMatch?.[1],       // ADD: "beginner", "intermediate", etc.
          conditions: conditionsMatch?.[1],  // ADD: "icy", "powder", "park", etc.
        },
        storeContext,
        brandVoice: {
          tone: typeof brandProfile?.tone === 'string' ? brandProfile.tone : undefined,
          persona: typeof brandProfile?.persona === 'string' ? brandProfile.persona : undefined,
        },
        experiments,
      });

      const segments: Segment[] = [
        { type: 'narrative', text: copy.lead },
      ];

      if (copy.detail) {
        segments.push({ type: 'note', tone: 'discreet', text: copy.detail });
      }

      // Add expert guidance when we have user context
      if (userContext && (userContext.skillLevel || userContext.conditions)) {
        const expertGuidance = generateExpertGuidance(userContext);
        const showExpertTips = experiments?.enableExpertTips !== false;
        if (expertGuidance && turnMode === 'recommend' && showExpertTips) {
          segments.push({
            type: 'note',
            tone: 'info',
            text: `💡 ${expertGuidance}`
          });
        }
      }

      if (turnMode !== 'clarify' && recommendedCards.length) {
        const evidenceBullets = recommendedCards
          .map((card) => card.reason)
          .filter(Boolean)
          .slice(0, 3);
        if (evidenceBullets.length) {
          segments.push({ type: 'evidence', bullets: evidenceBullets });
        }
        segments.push({ type: 'products', items: recommendedCards });

        // CONCIERGE: Offer comparison for 2-3 curated products
        if (recommendedCards.length >= 2 && recommendedCards.length <= 3) {
          const comparisonOptions: QuickReply[] = [];

          if (recommendedCards.length === 2) {
            // Auto-compare both
            comparisonOptions.push({
              id: 'compare_both',
              label: 'Compare these side-by-side',
              value: `Compare ${recommendedCards[0].title} vs ${recommendedCards[1].title}`
            });
          } else if (recommendedCards.length === 3) {
            // Offer choices
            comparisonOptions.push({
              id: 'compare_all',
              label: 'Compare all 3',
              value: 'compare all 3'
            });
            comparisonOptions.push({
              id: 'compare_top2',
              label: 'Just the top 2',
              value: `Compare ${recommendedCards[0].title} vs ${recommendedCards[1].title}`
            });
          }

          if (comparisonOptions.length) {
            segments.push({
              type: 'options',
              style: 'quick_replies',
              items: comparisonOptions
            });
          }
        }
      }

      if (turnMode === 'clarify' && previewCards.length) {
        segments.push({ type: 'products', items: previewCards });
      }

      if (turnMode === 'compare' && comparisonSegment) {
        segments.push(comparisonSegment);
      }

      if (turnMode === 'clarify' && clarifierQuestion && clarifierOptionsDisplay.length) {
        segments.push({ type: 'ask', text: clarifierQuestion });
        segments.push({ type: 'options', style: 'quick_replies', items: clarifierOptionsDisplay });
      }

      const tone = determineTone(`${copy.lead} ${copy.detail}`, metrics);
      const metadata: Record<string, unknown> = {
        tone,
        domain_confidence: domainConfidence,
        stage: turnMode === 'clarify' ? 'diagnosis_problem' : 'prescription_need_payoff',
        asked_slot: clarifierFacet,
        candidate_stats: { count: candidates.length },
        clarifier_options: turnMode === 'clarify' ? clarifierOptionsDisplay : [],
      };

      if (sentiment) {
        metadata.sentiment = sentiment;
      }
      if (calculatorResults.length) {
        metadata.calculator_results = calculatorResults.map((result) => ({
          id: result.id,
          label: result.label,
          inputs: result.inputs,
          outputs: result.outputs,
        }));
      }
      if (sessionMetadata.dialogueSummary) {
        metadata.dialogue_summary = sessionMetadata.dialogueSummary;
      }

      pepTurn = {
        turn_id: `deterministic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        persona: 'concierge',
        segments,
        metadata,
      };

      // Coherence gate validation
      const coherenceCheck: CoherenceCheck = {
        mode: turnMode,
        topic: 'commerce',
        hasProducts: segments.some(s => s.type === 'products' && s.items.length > 0),
        hasClarifier: segments.some(s => s.type === 'options'),
        hasComparison: segments.some(s => s.type === 'comparison'),
        productCount: recommendedCards.length,
        clarifierOptions: clarifierOptionsDisplay.length,
      };

      const coherenceResult = validateCoherence(coherenceCheck);
      if (!coherenceResult.valid) {
        console.warn('[pipeline] Coherence gate correction:', coherenceResult.reason);
        // Apply correction by switching to recommended mode
        if (coherenceResult.correctedMode === 'chat') {
          // Fall back to simple chat response
          const fallbackCopy = await generateSmartTemplateCopy({
            mode: 'chat',
            topic: 'commerce',
            slots: {
              category: storeContext.primaryCategory,
              userQuery: userMessage.content,
            },
            storeContext,
            brandVoice: {
              tone: typeof brandProfile?.tone === 'string' ? brandProfile.tone : undefined,
              persona: typeof brandProfile?.persona === 'string' ? brandProfile.persona : undefined,
            },
            experiments,
          });
          pepTurn.segments = [
            { type: 'narrative', text: fallbackCopy.lead },
            { type: 'note', tone: 'discreet', text: fallbackCopy.detail },
          ];
        }
      }

      switch (turnMode) {
        case 'clarify':
          askedSlot = clarifierFacet;
          pendingClarifierNext = clarifierFacet
            ? {
              facet: clarifierFacet,
              options: clarifierOptionsForSession,
            }
            : null;
          manualClarifierNext = null;
          conversationStageFinal = 'diagnosis_problem';
          uiHints = { mode: 'discovery_browse', show_quick_replies: true };
          break;
        case 'compare':
          askedSlot = null;
          pendingClarifierNext = null;
          manualClarifierNext = null;
          conversationStageFinal = 'prescription_need_payoff';
          uiHints = {
            mode: 'comparison',
            comparison: comparisonIds.length ? { product_ids: comparisonIds } : undefined,
          };
          break;
        default:
          askedSlot = null;
          pendingClarifierNext = null;
          manualClarifierNext = null;
          conversationStageFinal = 'prescription_need_payoff';
          uiHints = { mode: 'focused_recommendations' };
          break;
      }
    } catch (error) {
      console.warn('[conversation] deterministic turn failed, falling back:', error);
    }
  }

  if (!pepTurn) {
    pepTurn = await buildLegacyTurn({
      intent: 'find_product',
      retrieval,
      conversationState: {
        askedSlots: sessionMetadata.askedSlots,
        clarifierHistory: sessionMetadata.clarifierHistory,
      },
      userMessage: userMessage.content,
      sessionId,
      metrics,
      factSheets,
    });

    const metadata = pepTurn.metadata && typeof pepTurn.metadata === 'object'
      ? (pepTurn.metadata as Record<string, unknown>)
      : {};

    const askedSlotCandidate = metadata.asked_slot;
    askedSlot = typeof askedSlotCandidate === 'string' ? askedSlotCandidate : null;

    const legacyOptionsRaw = Array.isArray(metadata.clarifier_options)
      ? metadata.clarifier_options
      : [];
    const legacyOptions = legacyOptionsRaw
      .filter((option): option is { id?: string; label: string; value?: string; icon?: string } =>
        option != null
        && typeof option === 'object'
        && typeof (option as Record<string, unknown>).label === 'string'
      )
      .map((option, index) => ({
        id: typeof option.id === 'string' ? option.id : `legacy_${index}`,
        label: option.label,
        value: option.value ?? option.label,
        icon: option.icon,
      }));
    if (askedSlot && legacyOptions.length) {
      pendingClarifierNext = {
        facet: askedSlot,
        options: legacyOptions,
      };
    }

    conversationStageFinal = isSmallTalk ? 'smalltalk' : 'prescription_need_payoff';
    uiHints = uiHints ?? {};
  }

  const negotiationSegments: Segment[] = [];
  const negotiationQuickReplies: QuickReply[] = [];

  if (!isSmallTalk && !manualClarifierPrompt && candidates[0] && isPriceObjection(userMessage.content)) {
    const rule = await fetchNegotiationRule(deps.supabaseAdmin, shopId, candidates[0].id);
    if (rule) {
      const negotiationOutcome = buildNegotiationSegments(rule, candidates[0], sessionMetadata.negotiationState ?? null);
      if (negotiationOutcome) {
        negotiationSegments.push(...negotiationOutcome.segments);
        negotiationQuickReplies.push(...negotiationOutcome.quickReplies);
        offersPresented.push(...negotiationOutcome.offers);
        negotiationStateNext = negotiationOutcome.nextState;
      }
    }
  }

  if (negotiationSegments.length) {
    pepTurn.segments = [...pepTurn.segments, ...negotiationSegments];
    if (negotiationQuickReplies.length) {
      pepTurn.segments.push({
        type: 'options',
        style: 'quick_replies',
        items: negotiationQuickReplies,
      });
    }
  }

  const crossSell = (!isSmallTalk && candidates[0])
    ? await getCrossSellSegments(
        deps.supabaseAdmin,
        shopId,
        candidates[0],
      )
    : { segments: [] as Segment[], quickReplies: [] as QuickReply[] };

  if (!isSmallTalk && !manualClarifierPrompt && crossSell.segments.length) {
    pepTurn.segments = [...pepTurn.segments, ...crossSell.segments];
  }

  const bundleSegments = (!isSmallTalk && !manualClarifierPrompt && candidates[0] && (brandProfile?.experiments?.enableBundles ?? false))
    ? await getBundleSegments(deps.supabaseAdmin, shopId, candidates[0])
    : [];

  if (bundleSegments.length) {
    pepTurn.segments = [...pepTurn.segments, ...bundleSegments];
    offersPresented.push('bundle_suggestion');
  }

  if (!isSmallTalk && !manualClarifierPrompt) {
    const thresholdValue = brandProfile?.policies?.freeShippingThreshold ?? null;
    const thresholdSegments = getThresholdSegments(
      thresholdValue,
      candidates[0],
      crossSell.quickReplies
    );

    if (thresholdSegments.length) {
      pepTurn.segments = [...pepTurn.segments, ...thresholdSegments];
      offersPresented.push('threshold_nudge');
    }

    const offerSegments = getPolicyOfferSegments(brandProfile);
    if (offerSegments.length) {
      pepTurn.segments = [...pepTurn.segments, ...offerSegments];
      offerSegments.forEach((segment) => {
        if (segment.type === 'offer') {
          offersPresented.push(`offer_${segment.style}`);
        }
      });
    }
  }

  if (relaxationNotes.length) {
    const noteSegments = relaxationNotes.slice(0, 1);
    const existing = pepTurn.segments ?? [];
      const narrativeIndex = existing.findIndex((segment) => segment.type === 'narrative');
    const insertIndex = narrativeIndex >= 0 ? narrativeIndex + 1 : 0;
    pepTurn.segments = [
      ...existing.slice(0, insertIndex),
      ...noteSegments,
      ...existing.slice(insertIndex),
    ];
  }

  if (relaxationUndoOptions.length && relaxationNotes.length) {
    const undoSegment: Segment = {
      type: 'options',
      style: 'quick_replies',
      items: relaxationUndoOptions.slice(0, 4),
    };

    const insertIndex = relaxationNotes.length > 0
      ? relaxationNotes.length
      : Math.min(1, pepTurn.segments.length);

    pepTurn.segments = [
      ...pepTurn.segments.slice(0, insertIndex),
      undoSegment,
      ...pepTurn.segments.slice(insertIndex),
    ];
  }

  const clarifierHistoryPatch = { ...sessionMetadata.clarifierHistory };
  if (askedSlot) {
    clarifierHistoryPatch[askedSlot] = (clarifierHistoryPatch[askedSlot] ?? 0) + 1;
  }

  const hasProducts = pepTurn.segments.some((segment) => segment.type === 'products' && segment.items.length > 0);
  const defaultMode: ConciergeLayoutMode = rapportMode
    ? 'dialogue'
    : negotiationSegments.length || offersPresented.some((offer) => offer.startsWith('offer_'))
      ? 'offers'
      : hasProducts
        ? (conversationStageFinal === 'diagnosis_problem' ? 'discovery_browse' : 'focused_recommendations')
        : 'recovery';

  if (!uiHints) uiHints = {};
  if (!uiHints.mode) {
    uiHints.mode = defaultMode;
  }
  if (choiceOverload) {
    uiHints.show_quick_replies = uiHints.show_quick_replies ?? true;
    uiHints.notes = Array.from(new Set([...(uiHints.notes ?? []), 'Keeping the shortlist tight so it’s easy to compare.']));
  }
  if (recommendedSetSize && uiHints.recommended_set_size == null) {
    uiHints.recommended_set_size = recommendedSetSize;
  }

  const dialogueSummary = summariseDialogue(sessionMetadata.dialogueSummary, userMessage.content, pepTurn);

  const metadataObj = pepTurn.metadata && typeof pepTurn.metadata === 'object'
    ? { ...(pepTurn.metadata as Record<string, unknown>) }
    : {};
  metadataObj.conversation_stage = conversationStageFinal;
  metadataObj.conversation_mode = conversationMode;
  metadataObj.rapport_mode = rapportMode;
  metadataObj.info_mode = infoMode;
  if (activeOntologyVersion) {
    metadataObj.ontology_version = activeOntologyVersion;
  }
  metadataObj.choice_overload = choiceOverload;
  metadataObj.recommended_set_size = recommendedSetSize;
  if (validationMessage) {
    metadataObj.validation_message = validationMessage;
  }
  if (calculatorResults.length) {
    metadataObj.calculator_results = calculatorResults.map((result) => ({
      id: result.id,
      label: result.label,
      inputs: result.inputs,
      outputs: result.outputs,
    }));
  }
  if (dialogueSummary) {
    metadataObj.dialogue_summary = dialogueSummary;
  }
  if (sentiment) {
    metadataObj.sentiment = sentiment;
  }
  if (uiHints && Object.keys(uiHints).length > 0) {
    metadataObj.ui_hints = uiHints;
  }
  const existingReason = typeof (metadataObj as any).reason === 'object'
    ? { ...(metadataObj as any).reason as Record<string, unknown> }
    : {};
  const effectiveModeDecision = modeDecision ?? {
    decided_by: infoMode ? 'info_mode' : 'mode_default',
    result_count: retrieval.products.length,
  };

  const reasonPayload: Record<string, unknown> = {
    ...existingReason,
    topic,
    mode: infoMode ? 'info' : conversationMode,
    product_count: retrieval.products.length,
    decided_by: effectiveModeDecision.decided_by,
    result_count: effectiveModeDecision.result_count,
  };

  if (typeof effectiveModeDecision.groundability === 'number') {
    reasonPayload.groundability = effectiveModeDecision.groundability;
  }
  if (effectiveModeDecision.facet != null) {
    reasonPayload.facet = effectiveModeDecision.facet;
  }
  if (typeof effectiveModeDecision.comparison_intent === 'boolean') {
    reasonPayload.comparison_intent = effectiveModeDecision.comparison_intent;
  }

  if (relaxationSteps.length) {
    reasonPayload.relaxation_steps = relaxationSteps.map((step) => ({
      facet: step.facet,
      previous_value: step.previousValue ?? null,
      description: step.description,
    }));
  }

  metadataObj.reason = reasonPayload;
  pepTurn.metadata = metadataObj;

  const zeroResultStreakNext = retrieval.products.length === 0
    ? sessionMetadata.zeroResultStreak + 1
    : 0;

  if (!isSmallTalk || infoMode) {
    logKnowledgeTurnMetrics(shopId, sessionId, {
      mode: infoMode ? 'info' : 'commerce',
      ontology_version: activeOntologyVersion,
      knowledge_source: knowledgeFactSheets?.length ? 'knowledge_pack' : factSheets?.length ? 'tool' : 'none',
      canon_shards: canonInsightsForPrompt.length,
      calculators_available: calculatorConfigs.length,
      calculator_results: calculatorResults.length,
      sentiment,
    }).catch((error) => {
      console.debug('[pipeline] failed to log knowledge metrics', (error as Error).message);
    });
  }

  const manualClarifierForReturn = manualClarifierNext
    ? { ...manualClarifierNext, prompt: manualClarifierPrompt ?? undefined }
    : null;

  return {
    pepTurn,
    retrieval,
    metrics,
    zeroResultStreakNext,
    askedSlot,
    clarifierHistoryPatch,
    userMessage: userMessage.content,
    accumulatedIntent,
    activeFilters,
    pendingClarifier: pendingClarifierNext,
    manualClarifier: manualClarifierForReturn,
    relaxationSteps,
    offersPresented,
    negotiationState: negotiationStateNext,
    factSheets,
    factSheetCache: factSheetCacheNext,
    uiHints,
    rapportMode,
    infoMode,
    dialogueSummary,
    sentiment,
  };
};
const SHOPPING_INTENT_PATTERN = /(buy|shop|looking\s+for|show\s+me|find\s+me|recommend|need\s+a|need\s+some|browse|pick\s+out|type of|which type|what type|what kind|looking to)/;

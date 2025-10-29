import { chatModel } from '../../infra/llm/gemini';
import { ZodError } from 'zod';

import { bucketizePrice } from './conversation-policy';
import type { Product } from './types';
import {
  geminiResponseSchema,
  type GeminiStage,
  type GeminiTurnContext,
  type ParsedGeminiClarifier,
  type ParsedGeminiRecommendation,
  type ParsedGeminiTurn,
} from './llm-types';

const MAX_PRODUCTS_IN_PROMPT = 17;
const MAX_VARIANTS_IN_PROMPT = 5;
const MAX_RELATED_IN_PROMPT = 4;
const MAX_FAQS_IN_PROMPT = 3;
const MAX_DESCRIPTION_CHARS = 600;
const HISTORY_TURNS = 6;

const stripHtml = (value: string) => value.replace(/<[^>]+>/g, ' ');

const compressWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const buildExcerpt = (value: string | null | undefined, maxChars = MAX_DESCRIPTION_CHARS) => {
  if (!value) return null;
  const cleaned = compressWhitespace(stripHtml(value));
  if (!cleaned) return null;
  if (cleaned.length <= maxChars) return cleaned;
  return `${cleaned.slice(0, maxChars).replace(/[,;:\s]+$/g, '')}…`;
};

const mapVariantsForPrompt = (product: Product) =>
  (product.variants ?? [])
    .slice(0, MAX_VARIANTS_IN_PROMPT)
    .map((variant) => ({
      title: variant.title ?? null,
      price: variant.price ?? null,
      compare_at_price: variant.compare_at_price ?? null,
      sku: variant.sku ?? null,
      options: variant.option_values ?? [],
      inventory_quantity: variant.inventory_quantity ?? null,
      available: variant.available ?? null,
    }));

const mapRelationsForPrompt = (
  entries?: Array<{ relatedProductHandle: string; reason: string }>
) =>
  (entries ?? [])
    .filter((entry) => Boolean(entry?.relatedProductHandle))
    .slice(0, MAX_RELATED_IN_PROMPT)
    .map((entry) => ({
      handle: entry.relatedProductHandle,
      reason: entry.reason,
    }));

const mapFaqsForPrompt = (
  faqs: Array<{ question: string; answer: string }> | undefined
) =>
  (faqs ?? [])
    .slice(0, MAX_FAQS_IN_PROMPT)
    .map((faq) => ({
      question: faq.question,
      answer: faq.answer,
    }));

const buildHistory = (history: GeminiTurnContext['conversationHistory']) =>
  history.slice(-HISTORY_TURNS);

const mapProductForPrompt = (product: Product) => {
  const summary = product.summary ?? null;
  return {
    product_id: product.id,
    title: product.title,
    handle: product.handle,
    price: product.price ?? null,
    currency: product.currency ?? 'USD',
    price_bucket: bucketizePrice(product.price ?? null),
    vendor: product.vendor ?? null,
    category: summary?.category ?? product.product_type ?? null,
    key_features: summary?.keyFeatures ?? [],
    pros: summary?.pros ?? [],
    cons: summary?.cons ?? [],
    best_for: summary?.bestFor ?? [],
    use_cases: summary?.useCases ?? [],
    tags: product.tags ?? [],
    specifications: summary?.specifications ?? [],
    description_excerpt: buildExcerpt(product.description),
    faqs: mapFaqsForPrompt(summary?.highlightedFAQs),
    variants: mapVariantsForPrompt(product),
    cross_sell: mapRelationsForPrompt(summary?.crossSell),
    upsell: mapRelationsForPrompt(summary?.upsell),
  };
};

const buildPrompt = (context: GeminiTurnContext) => {
  const {
    candidateProducts,
    conversationHistory,
    activeFilters,
    brandProfile,
    unresolvedFacets,
    availableFacetValues,
    canonicalClarifierOptions = {},
    factSheets,
    brandDocs,
    canonInsights,
    calculators,
    calculatorResults,
    conversationHints,
  } = context;

const instructions = `You are the Insite merchandising concierge. Use only the facts provided in PRODUCT_FACTS and BRAND_DOCS.

Rules:
- Never invent specifications or prices.
- When recommending a product, cite the provided evidence snippet (PRODUCT_FACTS[i].evidence).
- Respect brand policies; only mention shipping/returns/warranty found in BRAND_DOCS.
- Do not reference facts outside PRODUCT_FACTS/BRAND_DOCS.
- CANON_SHARDS contains vetted industry knowledge. When the shopper asks broader questions, ground your coaching in these shards and mention the citation when summarizing.
- CALCULATORS lists deterministic tools you can call. If the shopper provides the required fields, return the computed result before advising next steps.
- When CALCULATOR_RESULTS are provided, weave the key values into your opening or transition so the shopper hears the numbers in context (e.g., "Cv lands around 4.2, so here are valves that hit that mark").
- Ask at most one clarifying question per turn—and only when the shopper has signaled a commerce need. Follow the SPIN cadence: empathetic Situation/Problem questions, thoughtful Implication follow-ups, and Need-Payoff language that echoes the shopper’s own words.
- If info_mode is false, default to showing relevant recommendations whenever they genuinely help—even if you also ask a follow-up diagnostic question. If info_mode is true, stay advisory: share seasonal insight, coaching, or high-level guidance and do not ask clarifiers or show quick replies unless the shopper explicitly requests product picks.
- Act as a benevolent choice architect: curate a tight set of options (2–4 unless recommended_set_size says otherwise), explain why each was chosen, and position them as solutions rather than a list of specs.
- When you present products, weave in concise storytelling that builds anticipation and close with a helpful next step (e.g., "Want me to line up sizes?" or "Should we look at a softer flex?").
- Mirror the shopper’s vocabulary and priorities—use their name if available, combine “you” and “we” language to reinforce collaboration, and validate their uniqueness.
- If the shopper hasn’t expressed a commerce need yet (greetings, check-ins, emotional moments), respond warmly in one or two sentences, acknowledge them, and invite them to tell you what they need when they are ready. Never pretend to run a search or mention missing matches in this situation.
- If info_mode is true, answer the question directly (definitions, timing advice, policies, how-to guidance), then invite them to tell you what they would like to explore. Do not run product search, ask clarifiers, or show quick replies unless the shopper explicitly asks for items. Never say you "looked" or "couldn't find matches" in this mode; simply inform and offer next steps. Example: “A snowboard is the deck you stand on—usually wood with fiberglass and metal edges. Most beginners start on a softer all-mountain board; when you’re ready I can line up a few that suit your riding plans.”
- If quick replies make sense, include a clear opt-out such as "Skip for now" so the shopper can continue typing freely.
- If relaxation_applied is true, briefly mention what changed to keep the shopper oriented.
- Avoid dead ends such as "I couldn’t find products." If something isn’t a fit, reframe and guide them toward the next best move.

You must respond with STRICT JSON that matches the schema below and nothing else.

Schema:
{
  "stage": "clarify" | "refine" | "final",
  "opening": string,                   // Warm sentence in the brand voice summarizing the situation
  "recommendations": [
    {
      "product_id": string,           // Must match a product_id from the catalog input
      "reason": string,               // One sentence grounded in provided facts
      "confidence": "high" | "medium" | "low" (optional)
    }
  ],
  "clarifier": {
    "facet": string,                  // e.g. "price_bucket", "color", "style"
    "question": string,               // Friendly question for the shopper
    "options": [
      { "label": string, "value": string, "aliases": string[]? }
    ]
  } | null,
  "suggested_filters": [
    { "facet": string, "value": string, "reason": string? }
  ]?,
  "ui_hints": {                       // Optional layout guidance for the client
    "mode": "discovery_browse" | "focused_recommendations" | "comparison" | "detail_assist" | "offers" | "recovery" | "handoff",
    "highlight_products": string[],   // product_ids to spotlight
    "suggested_actions": string[],     // free-form action cues (e.g., "check_sizes")
    "closing_style": "question" | "reassure" | "call_to_action",
    "show_quick_replies": boolean,
    "comparison": { "product_ids": string[] },
    "notes": string[]
  }?
}

Stage rules:
- "clarify": provide ONLY a clarifier question. recommendations MUST be []. clarifier MUST be present.
- "refine": provide 1-3 recommendations AND a clarifier question (follow-up refinement) ONLY if unresolved_facets is empty.
- "final": provide 2-4 recommendations. clarifier MUST be null and unresolved_facets MUST be empty.

General rules:
- Use the brand voice and policies when crafting the opening/question.
- Reasons must cite concrete attributes from the catalog (features, pros, best_for, price).
- Clarifier options must use canonical values supplied in available_choices[facet] for the selected facet. Place the canonical value in the "value" field and optionally provide a user-friendly "label".
- Values in suggested_filters must also match available canonical values.
- Never invent products or data not present in the catalog input.
- Use available_choice_labels[facet] to keep labels consistent when provided.
- Keep strings concise (<160 characters per field).
- Lean on catalog[*].description_excerpt, specifications, and faqs to answer detailed questions.
- Use catalog[*].variants to acknowledge sizes/options and availability.
- Mention cross_sell / upsell items only as supporting suggestions; recommendations array must use product_ids from catalog.
- If no exact match exists, relax only one constraint at a time. State explicitly what you relaxed and keep a reversible tone (e.g., "I widened the price cap to $220—want to keep it under $200?").
- When price is a concern, follow a motivational interviewing voice: reflect their budget, ask an open question, summarize, and offer to show choices before making concessions.
- Be truthful with social proof (include actual review counts/ratings when referenced) and avoid implying false scarcity.
- If you present a discount or sweetener, label it clearly and keep the shopper's agency (always end with a question or choice).
- Offer optional quick replies as shortcuts, but never assume the shopper will use them; always mention the shopper can respond in their own words.
- Use ui_hints to guide the UI when helpful. Keep them short and only include keys you need.

Examples:
GOOD clarify turn:
{
  "stage": "clarify",
  "opening": "Happy to help! Let me dial in the options.",
  "recommendations": [],
  "clarifier": {
    "facet": "price_bucket",
    "question": "Which price range feels right?",
    "options": [
      { "label": "Under $200", "value": "Under $200" },
      { "label": "$200-$400", "value": "$200-$400" },
      { "label": "$400+", "value": "$400+" }
    ]
  },
  "suggested_filters": []
}

GOOD final turn:
{
  "stage": "final",
  "opening": "Here are the boards that fit what you told me.",
  "recommendations": [
    { "product_id": "...", "reason": "Comes in 148cm and 152cm, soft flex keeps first runs stable." },
    { "product_id": "...", "reason": "Offers a 154cm wide option with mid-flex for park laps." }
  ],
  "clarifier": null,
  "suggested_filters": [
    { "facet": "use_case", "value": "snow_park_riding", "reason": "Keeps the set park-focused." }
  ]
}

BAD clarify turn (why it's wrong):
- stage "clarify" but includes recommendations.
- options use values not in available_choices.
- question is missing or not a question.
`;

  const payload = {
    customer_query: conversationHistory[conversationHistory.length - 1]?.text ?? '',
    conversation_history: buildHistory(conversationHistory),
    brand_profile: brandProfile ?? null,
    active_filters: activeFilters,
    unresolved_facets: unresolvedFacets,
    available_choices: unresolvedFacets.reduce<Record<string, string[]>>((acc, facet) => {
      acc[facet] = availableFacetValues[facet] ?? [];
      return acc;
    }, {}),
    available_choice_labels: unresolvedFacets.reduce<Record<string, Array<{ label: string; value: string }>>>((acc, facet) => {
      const canonical = canonicalClarifierOptions[facet];
      if (canonical?.length) {
        acc[facet] = canonical.map((option) => ({ label: option.label, value: option.value }));
      }
      return acc;
    }, {}),
    catalog: candidateProducts.slice(0, MAX_PRODUCTS_IN_PROMPT).map(mapProductForPrompt),
    product_count: conversationHints?.productCount ?? candidateProducts.length,
    relaxation_applied: conversationHints?.relaxationApplied ?? false,
    relaxation_summary: conversationHints?.relaxationSummary ?? null,
    conversation_mode: conversationHints?.conversationMode ?? 'commerce',
    info_mode: conversationHints?.infoMode ?? false,
    rapport_mode: conversationHints?.rapportMode ?? false,
    conversation_stage: conversationHints?.stage ?? null,
    persona_hint: conversationHints?.persona ?? null,
    choice_overload: conversationHints?.choiceOverload ?? false,
    recommended_set_size: conversationHints?.recommendedSetSize ?? null,
    validation_message: conversationHints?.validationMessage ?? null,
  };

  return `${instructions}\n\nCANON_SHARDS:\n${JSON.stringify(canonInsights ?? [], null, 2)}\n\nCALCULATORS:\n${JSON.stringify(calculators ?? [], null, 2)}\n\nCALCULATOR_RESULTS:\n${JSON.stringify(calculatorResults ?? [], null, 2)}\n\nBRAND_DOCS:\n${JSON.stringify(brandDocs ?? {}, null, 2)}\n\nPRODUCT_FACTS:\n${JSON.stringify(factSheets ?? [], null, 2)}\n\nINPUT:\n${JSON.stringify(payload, null, 2)}`;
};

const callGemini = async (prompt: string) => {
  const response = await chatModel.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.5,
      topP: 0.8,
      maxOutputTokens: 640,
      responseMimeType: 'application/json',
    },
  });

  const candidate = response.response.candidates?.[0];
  const text = candidate?.content?.parts?.[0]?.text?.trim();

  if (!text) {
    throw new Error('Gemini returned empty response');
  }

  return text;
};

const validateStage = (
  stage: GeminiStage,
  data: ReturnType<typeof geminiResponseSchema.parse>,
  conversationMode: 'commerce' | 'smalltalk',
  infoMode: boolean
) => {
  if (conversationMode === 'smalltalk' || infoMode) {
    return;
  }
  if (stage === 'clarify') {
    if (data.recommendations.length > 0) {
      throw new Error('Stage clarify must not include recommendations');
    }
    if (!data.clarifier) {
      throw new Error('Stage clarify requires a clarifier block');
    }
  }

  if (stage === 'refine') {
    if (!data.clarifier) {
      throw new Error('Stage refine requires a clarifier');
    }
    if (data.recommendations.length === 0) {
      throw new Error('Stage refine requires at least one recommendation');
    }
  }

  if (stage === 'final' && conversationMode !== 'commerce') {
    return;
  }

  if (stage === 'final') {
    if (data.clarifier) {
      throw new Error('Stage final must not include a clarifier');
    }
  }
};

const mapRecommendations = (
  recommendations: ReturnType<typeof geminiResponseSchema.parse>['recommendations'],
  candidates: Product[]
): ParsedGeminiRecommendation[] => {
  const productMap = new Map(candidates.map((product) => [product.id, product]));
  const results: ParsedGeminiRecommendation[] = [];

  recommendations.forEach((item) => {
    const product = productMap.get(item.product_id);
    if (!product) return;
    results.push({
      productId: product.id,
      rationale: [item.reason],
      headline: item.title,
    });
  });

  return results;
};

const mapClarifier = (
  clarifier: ReturnType<typeof geminiResponseSchema.parse>['clarifier']
): ParsedGeminiClarifier | undefined => {
  if (!clarifier) return undefined;

  return {
    facet: clarifier.facet,
    question: clarifier.question,
    options: clarifier.options.map((option) => ({
      label: option.label,
      value: option.value,
      aliases: option.aliases,
    })),
  };
};

export const generateGeminiTurn = async (
  context: GeminiTurnContext
): Promise<ParsedGeminiTurn> => {
  const prompt = buildPrompt(context);
  const raw = await callGemini(prompt);

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Gemini returned invalid JSON: ${(error as Error).message}`);
  }

  if (parsedJson && typeof parsedJson === 'object') {
    const asAny = parsedJson as any;

    if (Array.isArray(asAny?.clarifier?.options) && asAny.clarifier.options.length > 6) {
      asAny.clarifier.options = asAny.clarifier.options.slice(0, 6);
    }

    if (asAny?.clarifier && !Array.isArray(asAny.clarifier.options)) {
      asAny.clarifier.options = [];
    }

    if (asAny?.suggested_filters == null) {
      asAny.suggested_filters = [];
    }
  }

  let data;
  try {
    data = geminiResponseSchema.parse(parsedJson);
  } catch (error) {
    if (error instanceof ZodError && parsedJson && typeof parsedJson === 'object') {
      const issues = error.issues ?? [];
      const hasClarifierIssue = issues.some((issue) => issue.path.join('.') == 'clarifier.options');

      if (hasClarifierIssue) {
        const mutable = { ...(parsedJson as Record<string, unknown>) };
        mutable.clarifier = undefined;

        data = geminiResponseSchema.parse(mutable);
      } else {
        throw error;
      }
    } else {
      throw error;
    }
  }

  const infoModeRequested = Boolean(context.conversationHints?.infoMode);
  const clarifierForResponse = infoModeRequested ? undefined : data.clarifier ?? undefined;

  validateStage(
    data.stage,
    { ...data, clarifier: clarifierForResponse ?? null },
    context.conversationHints?.conversationMode ?? 'commerce',
    context.conversationHints?.infoMode ?? false,
  );

  const recommendations = mapRecommendations(data.recommendations, context.candidateProducts);
  const uiHints = data.ui_hints
    ? {
        mode: data.ui_hints.mode,
        highlight_products: data.ui_hints.highlight_products,
        suggested_actions: data.ui_hints.suggested_actions,
        closing_style: data.ui_hints.closing_style,
        show_quick_replies: data.ui_hints.show_quick_replies,
        comparison: data.ui_hints.comparison ?? undefined,
        notes: data.ui_hints.notes,
      }
    : undefined;

  return {
    rawText: raw,
    stage: data.stage,
    narrative: data.opening,
    recommendations,
    clarifier: mapClarifier(clarifierForResponse ?? null),
    suggestedFilters: data.suggested_filters,
    uiHints,
  };
};

export type { ParsedGeminiTurn } from './llm-types';

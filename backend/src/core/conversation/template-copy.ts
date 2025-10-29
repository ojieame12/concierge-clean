import { chatModel } from '../../infra/llm/gemini';
import type { StoreContext } from './store-context';

export type TurnMode = 'chat' | 'clarify' | 'recommend' | 'compare' | 'dead_end';
export type TurnTopic = 'rapport' | 'store_info' | 'policy_info' | 'product_info' | 'commerce';

export interface TemplateSlots {
  count?: number;
  category?: string;
  facet?: string;
  priceRange?: string;
  brands?: string;
  storeType?: string;
  primaryCategory?: string;
  nextAction?: string;
  userQuery?: string;
  factualSummary?: string;
  category_count?: string;
  definitionHeadline?: string;
  definitionDetail?: string;
  // Lifestyle & constraints
  skillLevel?: string;      // "beginner", "intermediate", "advanced"
  conditions?: string;      // "icy", "powder", "park", "freestyle"
  useCase?: string;         // "weekend riding", "competition"
  skillContext?: string;
  conditionsContext?: string;
}

export interface CopyTemplate {
  id: string;
  lead: string;
  detail: string;
}

export interface TemplateRequest {
  mode: TurnMode;
  topic: TurnTopic;
  slots: TemplateSlots;
  storeContext: StoreContext;
  brandVoice?: {
    tone?: string;
    persona?: string;
  };
  experiments?: {
    leadVariant?: 'default' | 'punchy';
    enableExpertTips?: boolean;
    templateVariant?: 'default' | 'concise';
  } | null;
}

export interface TemplateResponse {
  lead: string;
  detail: string;
  templateId: string;
  usedFallback: boolean;
}

const detailPrefixesDefault = ['Here’s the thinking:', 'Worth noting:', 'Let’s focus in:'];
const detailPrefixesConcise = ['Here’s the why:', 'Quick note:', 'Worth noting:'];

const hashString = (value: string): number => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return hash;
};

const prependDetailPrefix = (
  detail: string,
  templateId: string,
  experiments: TemplateRequest['experiments']
) => {
  const options = experiments?.templateVariant === 'concise'
    ? detailPrefixesConcise
    : detailPrefixesDefault;

  if (!options.length) {
    return detail;
  }

  const index = Math.abs(hashString(`${templateId}:${detail}`)) % options.length;
  const prefix = options[index];

  if (detail.toLowerCase().startsWith(prefix.toLowerCase())) {
    return detail;
  }

  return `${prefix} ${detail}`;
};

/**
 * Template library organized by mode and topic
 */
const TEMPLATES: Record<TurnMode, Record<string, CopyTemplate>> = {
  clarify: {
    T1: {
      id: 'clarify_T1',
      lead: 'I found several options that could be perfect for you{skillContext}.',
      detail: 'Let me ask about your {facet} preference to help narrow this down to the best 2-3 matches{conditionsContext}.',
    },
    T2: {
      id: 'clarify_T2',
      lead: 'I found several {category} that could work for you{skillContext}.',
      detail: 'To find your perfect match{conditionsContext}, what {facet} matters most to you?',
    },
    T3: {
      id: 'clarify_T3',
      lead: 'Let me help you find exactly what you\'re looking for{skillContext}.',
      detail: 'Quick question about your {facet} to curate the perfect recommendation{conditionsContext}.',
    },
  },
  recommend: {
    T1: {
      id: 'recommend_T1',
      lead: 'I\'ve curated {category_count} that perfectly match your needs.',
      detail: 'Each one has been carefully selected for you—tap a card for full specs or compare them side by side.',
    },
    T2: {
      id: 'recommend_T2',
      lead: 'These are the {category_count} I recommend for you.',
      detail: 'Hand-picked in the {priceRange} range you wanted. Ready to {nextAction}?',
    },
    T3: {
      id: 'recommend_T3',
      lead: 'I\'ve found the perfect match for you.',
      detail: 'Carefully selected {category} from {brands}, ready to ship.',
    },
    T4: {
      id: 'recommend_T4',
      lead: 'Here are the standouts worth your attention.',
      detail: 'Each nails the brief for {category}. Compare quickly or ask for something different.',
    },
    T5: {
      id: 'recommend_T5',
      lead: 'Let’s focus on three {category} that match what you told me.',
      detail: 'All sit inside your preferences. Pick a card to see why it fits or tell me what to tighten.',
    },
  },
  compare: {
    T1: {
      id: 'compare_T1',
      lead: 'Let\'s compare these side by side.',
      detail: 'Tap any 2-3 products to select them, then I\'ll show you the key differences.',
    },
    T2: {
      id: 'compare_T2',
      lead: 'Here\'s how these {category} compare.',
      detail: 'I\'ve highlighted the key differences to help you decide.',
    },
    T3: {
      id: 'compare_T3',
      lead: 'Ready to compare these options.',
      detail: 'Select 2-3 products to see them side by side.',
    },
  },
  chat: {
    T1: {
      id: 'chat_T1',
      lead: 'Let me help you with that.',
      detail: 'Tell me more about what you\'re looking for and I\'ll guide you to the right {category}.',
    },
    T2: {
      id: 'chat_T2',
      lead: 'I can answer that for you.',
      detail: 'We\'re a {storeType} specializing in {primaryCategory}. What specifically would you like to know?',
    },
  },
  dead_end: {
    T1: {
      id: 'dead_end_T1',
      lead: 'I couldn\'t find an exact match for that.',
      detail: 'Try adjusting your criteria or browse our {primaryCategory} collection to see what\'s available.',
    },
  },
};

/**
 * Topic-specific templates for store/policy info
 */
const INFO_TEMPLATES: Record<string, CopyTemplate> = {
  store_info: {
    id: 'store_info',
    lead: 'We\'re a {storeType}.',
    detail: '{factualSummary}',
  },
  policy_shipping: {
    id: 'policy_shipping',
    lead: 'Here\'s our shipping policy.',
    detail: 'Most orders ship within 1-2 business days. Free shipping on orders over $99.',
  },
  policy_returns: {
    id: 'policy_returns',
    lead: 'Our return policy is straightforward.',
    detail: '30-day returns on unopened items. Used gear can be exchanged within 14 days.',
  },
  product_info: {
    id: 'product_info',
    lead: '{definitionHeadline}',
    detail: '{definitionDetail}',
  },
};

/**
 * Fill template slots with actual values
 */
function fillTemplate(template: string, slots: TemplateSlots): string {
  let filled = template;

  Object.entries(slots).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    if (filled.includes(placeholder) && value !== undefined) {
      filled = filled.replace(new RegExp(placeholder, 'g'), String(value));
    }
  });

  // Remove any unfilled placeholders
  filled = filled.replace(/\{[^}]+\}/g, '');

  return filled.trim();
}

function formatCountedNoun(noun: string | undefined, count: number | undefined): string {
  const safeCount = count ?? 0;
  const base = (noun ?? 'item').trim();

  // Guard against showing "0 products" - return generic phrase instead
  if (safeCount === 0 || safeCount < 0) {
    if (/s$/i.test(base)) {
      return base; // already plural
    }
    if (/(ch|sh|x|z|s)$/i.test(base)) {
      return `${base}es`;
    }
    if (base.endsWith('y') && !/[aeiou]y$/i.test(base)) {
      return `${base.slice(0, -1)}ies`;
    }
    return `${base}s`;
  }

  if (safeCount === 1) {
    return `1 ${base}`;
  }
  if (!base) {
    return String(safeCount);
  }
  if (/s$/i.test(base)) {
    return `${safeCount} ${base}`;
  }
  if (/(ch|sh|x|z|s)$/i.test(base)) {
    return `${safeCount} ${base}es`;
  }
  if (base.endsWith('y') && !/[aeiou]y$/i.test(base)) {
    return `${safeCount} ${base.slice(0, -1)}ies`;
  }
  return `${safeCount} ${base}s`;
}

/**
 * Select best template based on context
 */
function selectBestTemplate(
  mode: TurnMode,
  topic: TurnTopic,
  slots: TemplateSlots,
  experiments?: TemplateRequest['experiments']
): CopyTemplate {
  // Handle info topics with specific templates
  if (topic === 'store_info') {
    return INFO_TEMPLATES.store_info;
  }
  if (topic === 'policy_info') {
    if (slots.userQuery?.includes('ship')) {
      return INFO_TEMPLATES.policy_shipping;
    }
    if (slots.userQuery?.includes('return')) {
      return INFO_TEMPLATES.policy_returns;
    }
    return INFO_TEMPLATES.store_info;
  }
  if (topic === 'product_info') {
    return INFO_TEMPLATES.product_info;
  }

  // Get mode-specific templates
  const modeTemplates = TEMPLATES[mode];
  if (!modeTemplates) {
    return TEMPLATES.chat.T1;
  }

  // Simple selection logic based on slots
  if (mode === 'clarify') {
    if (slots.count && slots.count > 10) return modeTemplates.T2;
    if (slots.count && slots.count <= 3) return modeTemplates.T3;
    return modeTemplates.T1;
  }

  if (mode === 'recommend') {
    if (experiments?.leadVariant === 'punchy' && modeTemplates.T4) {
      return modeTemplates.T4;
    }
    if (experiments?.templateVariant === 'concise' && modeTemplates.T5) {
      return modeTemplates.T5;
    }
    if (slots.priceRange) return modeTemplates.T2;
    if (slots.brands) return modeTemplates.T3;
    return modeTemplates.T1;
  }

  // Default to first template for mode
  return Object.values(modeTemplates)[0];
}

/**
 * Generate copy using template system
 */
export async function generateTemplateCopy(
  request: TemplateRequest
): Promise<TemplateResponse> {
  const { mode, topic, slots, storeContext } = request;
  const experiments = request.experiments ?? null;

  // Enrich slots with store context
  const enrichedSlots: TemplateSlots = {
    ...slots,
    storeType: storeContext.storeType,
    primaryCategory: storeContext.primaryCategory,
    factualSummary: storeContext.factualSummary,
  };

  // Format category_count with number (e.g., "3 snowboards")
  enrichedSlots.category_count = formatCountedNoun(
    slots.category ?? storeContext.primaryCategory,
    slots.count ?? storeContext.totalProducts
  );

  // Ensure category is always plural for templates like "several {category}"
  const baseCategory = slots.category ?? storeContext.primaryCategory ?? 'item';
  const pluralCategory = formatCountedNoun(baseCategory, 0);  // count=0 returns just plural form
  enrichedSlots.category = pluralCategory;

  // Format lifestyle context for natural insertion
  enrichedSlots.skillContext = slots.skillLevel ? ` as a ${slots.skillLevel} rider` : '';
  enrichedSlots.conditionsContext = slots.conditions ? ` for ${slots.conditions} riding` : '';

  // Format brands list if present
  if (storeContext.topBrands.length > 0) {
    enrichedSlots.brands = storeContext.topBrands.slice(0, 3).join(', ');
  }

  // Format price range if present
  if (storeContext.priceRange.min && storeContext.priceRange.max) {
    enrichedSlots.priceRange = `$${Math.round(storeContext.priceRange.min)}-$${Math.round(
      storeContext.priceRange.max
    )}`;
  }

  // Select template
  const template = selectBestTemplate(mode, topic, enrichedSlots, experiments);

  // Fill template with slots
  const lead = fillTemplate(template.lead, enrichedSlots);
  let detail = fillTemplate(template.detail, enrichedSlots);
  if (detail) {
    detail = prependDetailPrefix(detail, template.id, experiments);
  }

  return {
    lead,
    detail,
    templateId: template.id,
    usedFallback: experiments?.templateVariant === 'concise' || experiments?.leadVariant === 'punchy',
  };
}

/**
 * Smart template copy generation - DISABLED to avoid rate limits
 * Now always uses deterministic templates
 */
export async function generateSmartTemplateCopy(
  request: TemplateRequest
): Promise<TemplateResponse> {
  // ALWAYS use deterministic templates - no AI needed for template selection!
  // This was causing rate limits and isn't necessary
  // Previously this would call Gemini API for every request, causing:
  // - 429 rate limit errors (10 req/min limit)
  // - Slow response times
  // - Unnecessary costs
  // The deterministic templates work just as well for 99% of cases
  return generateTemplateCopy(request);
}

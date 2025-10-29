import type { BrandProfile } from '../../types/brand';
import type { ConversationMessage, ConversationState } from '../../types/conversation';
import type { ProductAttribute, ProductContext, ProductRetrievalResult, UpsellCandidate } from '../../types/product';

export type PromptContextInput = {
  brand: BrandProfile;
  conversationState: ConversationState;
  messages: ConversationMessage[];
  retrievedProducts: ProductRetrievalResult;
  themeConfig?: Record<string, unknown>;
  policiesOverride?: string;
};

export type PromptContext = {
  systemPrompt: string;
  stateSummary: string;
  productBriefs: Array<{
    title: string;
    bulletPoints: string[];
    upsellReasons: string[];
  }>;
  followUpSuggestions: string[];
};

const describeState = (state: ConversationState) => {
  const parts: string[] = [];

  if (state.intent) {
    parts.push(`Intent: ${state.intent}.`);
  }

  if (state.occasion) {
    parts.push(`Occasion: ${state.occasion}.`);
  }

  if (state.budget) {
    const { min, max } = state.budget;
    if (min && max) {
      parts.push(`Budget between $${min} and $${max}.`);
    } else if (min) {
      parts.push(`Budget around $${min}.`);
    }
  }

  if (state.constraints?.colorPreferences?.length) {
    parts.push(`Preferred colors: ${state.constraints.colorPreferences.join(', ')}.`);
  }

  if (state.preferences?.styleDescriptors?.length) {
    parts.push(`Style keywords: ${state.preferences.styleDescriptors.join(', ')}.`);
  }

  return parts.join(' ');
};

const buildProductBrief = (product: ProductContext) => {
  const bulletPoints = [
    ...product.sellingPoints,
    ...product.attributes.slice(0, 3).map((attr: ProductAttribute) => `${attr.name}: ${attr.value}`),
  ].filter(Boolean);

  const upsellReasons = product.upsellCandidates
    .slice(0, 3)
    .map((candidate: UpsellCandidate) => candidate.reason);

  return {
    title: product.title,
    bulletPoints,
    upsellReasons,
  };
};

export const buildPromptContext = ({
  brand,
  conversationState,
  retrievedProducts,
  policiesOverride,
}: PromptContextInput): PromptContext => {
  const stateSummary = describeState(conversationState);

  const productBriefs = retrievedProducts.products.slice(0, 6).map(buildProductBrief);

  const followUpSuggestions = conversationState.followUpQuestions.length
    ? conversationState.followUpQuestions
    : ['Would you like accessory suggestions?', 'Should I compare two options for you?', 'Need help with sizing or delivery timing?'];

  const policies = policiesOverride ??
    `${brand.policies.shipping}\n${brand.policies.returns}\n${brand.policies.guarantees ?? ''}`.trim();

  const merchandisingFocus = brand.merchandising?.promotionCopy
    ? `Promotions to highlight: ${brand.merchandising.promotionCopy}.`
    : '';

  const systemPrompt = `You are ${brand.brandName}'s AI concierge. Mission: ${brand.mission}.
Voice guidelines: ${brand.voice.persona}. Tone keywords: ${brand.voice.toneKeywords.join(', ')}.
Do: ${brand.voice.dos.join('; ')}.
Don't: ${brand.voice.donts.join('; ')}.
Key policies: ${policies}.
${merchandisingFocus}
Prioritized SKUs: ${(brand.merchandising?.highMarginSkus ?? []).join(', ') || 'None'}.
Featured campaigns: ${(brand.merchandising?.seasonalCampaigns ?? []).join(', ') || 'None'}.

Conversation state summary: ${stateSummary || 'No specific preferences captured yet.'}
Use only the provided product context and policies. Always explain WHY a product fits. Offer tailored follow-ups.`;

  return {
    systemPrompt,
    stateSummary,
    productBriefs,
    followUpSuggestions,
  };
};

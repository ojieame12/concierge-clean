import type { ConversationMessage, ConversationState } from '../../types/conversation';

const BUDGET_REGEX = /\$?(\d+)(?:\s*-\s*\$?(\d+))?/;
const OCCASION_KEYWORDS: Record<string, string[]> = {
  wedding: ['wedding', 'bridesmaid', 'ceremony', 'reception'],
  vacation: ['vacation', 'holiday', 'travel', 'resort'],
  work: ['office', 'work', 'meeting', 'interview'],
  party: ['party', 'celebration', 'birthday', 'anniversary'],
  fitness: ['gym', 'run', 'hike', 'yoga'],
};

const COLOR_WORDS = ['red', 'blue', 'green', 'black', 'white', 'gold', 'silver', 'pink', 'purple', 'orange', 'yellow'];
const MATERIAL_WORDS = ['cotton', 'linen', 'wool', 'leather', 'silk', 'denim', 'cashmere', 'sustainable', 'vegan'];
const STYLE_WORDS = ['minimal', 'bold', 'elegant', 'sporty', 'classic', 'modern', 'vintage', 'streetwear'];

const normalise = (value: string) => value.trim().toLowerCase();

const extractBudget = (content: string) => {
  const match = content.match(BUDGET_REGEX);
  if (!match) return undefined;
  const [, minStr, maxStr] = match;
  const min = Number(minStr);
  const max = maxStr ? Number(maxStr) : undefined;
  if (Number.isNaN(min)) return undefined;
  return { min, max };
};

const extractOccasion = (content: string) => {
  const lower = content.toLowerCase();
  for (const [occasion, keywords] of Object.entries(OCCASION_KEYWORDS)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return occasion;
    }
  }
  return undefined;
};

const extractArrayMatches = (content: string, vocabulary: string[]) =>
  vocabulary.filter((word) => content.toLowerCase().includes(word));

const mergeUnique = (current: string[] = [], next: string[] = []) =>
  Array.from(new Set([...current, ...next].map(normalise)));

export const updateConversationState = (
  previous: ConversationState | undefined,
  message: ConversationMessage
): ConversationState => {
  if (message.role !== 'user') {
    return previous ?? {
      lastRecommendedProductIds: [],
      declinedProductIds: [],
      acceptedProductIds: [],
      followUpQuestions: [],
      lastUpdatedAt: new Date().toISOString(),
    };
  }

  const budget = extractBudget(message.content) ?? previous?.budget;
  const occasion = extractOccasion(message.content) ?? previous?.occasion;
  const colors = extractArrayMatches(message.content, COLOR_WORDS);
  const materials = extractArrayMatches(message.content, MATERIAL_WORDS);
  const styles = extractArrayMatches(message.content, STYLE_WORDS);

  return {
    intent: previous?.intent,
    occasion,
    budget,
    constraints: {
      deliveryDeadline: previous?.constraints?.deliveryDeadline,
      size: previous?.constraints?.size,
      colorPreferences: mergeUnique(previous?.constraints?.colorPreferences, colors),
      materialPreferences: mergeUnique(previous?.constraints?.materialPreferences, materials),
    },
    preferences: {
      styleDescriptors: mergeUnique(previous?.preferences?.styleDescriptors, styles),
      dislikedFeatures: previous?.preferences?.dislikedFeatures ?? [],
    },
    lastRecommendedProductIds: previous?.lastRecommendedProductIds ?? [],
    declinedProductIds: previous?.declinedProductIds ?? [],
    acceptedProductIds: previous?.acceptedProductIds ?? [],
    followUpQuestions: previous?.followUpQuestions ?? [],
    lastUpdatedAt: new Date().toISOString(),
  };
};

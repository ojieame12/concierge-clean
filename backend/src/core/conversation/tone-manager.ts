import type { ToneStyle } from './phrase-bank';

export type ToneConfig = {
  allowUpsell: boolean;
  maxPreviewWords: number;
  maxEvidenceBullets: number;
  escalationThreshold: number;
  phraseStyle: 'friendly' | 'professional' | 'direct' | 'supportive';
};

export const toneConfig: Record<ToneStyle, ToneConfig> = {
  warm: {
    allowUpsell: true,
    maxPreviewWords: 20,
    maxEvidenceBullets: 3,
    escalationThreshold: 5,
    phraseStyle: 'friendly',
  },
  neutral: {
    allowUpsell: true,
    maxPreviewWords: 18,
    maxEvidenceBullets: 3,
    escalationThreshold: 4,
    phraseStyle: 'professional',
  },
  concise: {
    allowUpsell: false,
    maxPreviewWords: 12,
    maxEvidenceBullets: 2,
    escalationThreshold: 3,
    phraseStyle: 'direct',
  },
  empathetic_urgent: {
    allowUpsell: false,
    maxPreviewWords: 12,
    maxEvidenceBullets: 2,
    escalationThreshold: 1,
    phraseStyle: 'supportive',
  },
};

const FRUSTRATED_REGEX = /frustrated|angry|annoyed|ridiculous|useless|upset|worst|terrible|awful|hate/i;
const POSITIVE_REGEX = /love|amazing|perfect|awesome|yay|great|thanks|thank you|appreciate/i;
const NEGATIVE_REGEX = /bad|trash|broken|late|delay|refund|return|issue|problem|sucks|not working/i;
const URGENCY_REGEX = /urgent|asap|need this now|today|tomorrow|right away|quick|fast/i;

export type ConversationMetrics = {
  turnCount: number;
  zeroResultCount: number;
  repeatedClarifiers: number;
};

export function analyzeSentiment(text: string): number {
  const positives = (text.match(POSITIVE_REGEX) || []).length;
  const negatives = (text.match(NEGATIVE_REGEX) || []).length;

  if (positives === 0 && negatives === 0) return 0;

  return (positives - negatives) / (positives + negatives);
}

export function determineTone(userMessage: string, metrics: ConversationMetrics): ToneStyle {
  const sentiment = analyzeSentiment(userMessage);

  if (FRUSTRATED_REGEX.test(userMessage) || sentiment < -0.5 || metrics.zeroResultCount >= 2) {
    return 'empathetic_urgent';
  }

  if (metrics.turnCount >= 8 || metrics.repeatedClarifiers >= 2) {
    return 'concise';
  }

  if (sentiment > 0.5) {
    return 'warm';
  }

  if (URGENCY_REGEX.test(userMessage)) {
    return 'concise';
  }

  return 'neutral';
}

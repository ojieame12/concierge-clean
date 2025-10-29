import type {
  ConversationMessage,
  EscalationContext,
  EscalationDecision,
} from '../../types/conversation';

const NEGATIVE_KEYWORDS = [
  'angry',
  'frustrated',
  'upset',
  'disappointed',
  'ridiculous',
  'complain',
  'refund',
  'return',
  'broken',
  'damaged',
  'cancel',
  'chargeback',
  'sue',
  'lawsuit',
];

const ESCALATION_KEYWORDS = [
  'manager',
  'human',
  'person',
  'agent',
  'representative',
  'call me',
  'phone',
  'talk to someone',
  'escalate',
];

const HIGH_VALUE_CART_THRESHOLD = 400;
const HIGH_ITEM_COUNT_THRESHOLD = 5;
const MAX_MESSAGE_BEFORE_ESCALATION = 24;
const NEG_SENTIMENT_THRESHOLD = -0.35;
const VIP_LTV_THRESHOLD = 2000;

const simpleSentimentHeuristic = (messages: ConversationMessage[]): number => {
  const latestUser = [...messages].reverse().find((msg) => msg.role === 'user');
  if (!latestUser) {
    return 0;
  }

  const lower = latestUser.content.toLowerCase();
  if (NEGATIVE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return -0.6;
  }
  if (lower.includes('thank') || lower.includes('love')) {
    return 0.4;
  }
  return 0;
};

const messageContains = (messages: ConversationMessage[], tokens: string[]): boolean => {
  const lowerMessages = messages
    .filter((msg) => msg.role === 'user')
    .map((msg) => msg.content.toLowerCase());

  return lowerMessages.some((content) => tokens.some((token) => content.includes(token)));
};

export const evaluateEscalation = ({ messages, metadata }: EscalationContext): EscalationDecision => {
  const reasons: string[] = [];

  const recentSentiment =
    metadata.sentimentScore ?? simpleSentimentHeuristic(messages);

  if (recentSentiment <= NEG_SENTIMENT_THRESHOLD) {
    reasons.push('Detected negative sentiment in recent user message.');
  }

  if (metadata.hasComplaintKeywords || messageContains(messages, NEGATIVE_KEYWORDS)) {
    reasons.push('Complaint or problem keywords detected.');
  }

  if (messageContains(messages, ESCALATION_KEYWORDS)) {
    reasons.push('User explicitly requested a human.');
  }

  if ((metadata.cartTotal ?? 0) >= HIGH_VALUE_CART_THRESHOLD) {
    reasons.push('High-value cart detected.');
  }

  if ((metadata.cartItemCount ?? 0) >= HIGH_ITEM_COUNT_THRESHOLD) {
    reasons.push('Large cart item count.');
  }

  if (metadata.vipCustomer || (metadata.customerLtv ?? 0) >= VIP_LTV_THRESHOLD) {
    reasons.push('VIP customer identified.');
  }

  if (messages.length >= MAX_MESSAGE_BEFORE_ESCALATION) {
    reasons.push('Conversation length exceeds automated threshold.');
  }

  const escalate = reasons.length > 0;

  const priority: EscalationDecision['priority'] = (() => {
    if (metadata.vipCustomer || (metadata.cartTotal ?? 0) >= HIGH_VALUE_CART_THRESHOLD) {
      return 'high';
    }
    if (recentSentiment <= NEG_SENTIMENT_THRESHOLD) {
      return 'medium';
    }
    return 'low';
  })();

  const handoffMessage = escalate
    ? 'I want to make sure you get the best support possible. I am connecting you with a specialist who can help right away.'
    : undefined;

  return {
    escalate,
    reasons,
    priority,
    handoffMessage,
  };
};

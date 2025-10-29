import type {
  ConversationRole,
  ConversationMessage,
  ConversationMetadata,
  ConversationState,
} from '@insite/shared-types';

export type { ConversationRole, ConversationMessage, ConversationMetadata, ConversationState };

export type EscalationContext = {
  shopDomain: string;
  conversationId: string;
  messages: ConversationMessage[];
  metadata: ConversationMetadata;
};

export type EscalationDecision = {
  escalate: boolean;
  reasons: string[];
  priority: 'low' | 'medium' | 'high';
  handoffMessage?: string;
};

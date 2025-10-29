import type { Segment, ConversationMetadata } from './conversation';

export interface UserBubble {
  message: string;
  timestamp: Date;
}

export interface AssistantResponse {
  id: string;
  segments: Segment[];
  isActive: boolean;
  metadata?: ConversationMetadata;
  mainLead?: string | null;
  detail?: string | null;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  keepActive: boolean;
}

export interface SystemEvent {
  type: 'compare_start' | 'compare_execute' | 'selection_change' | 'add_to_cart';
  data?: unknown;
}

export type TimelineEntry =
  | { type: 'user'; message: UserBubble }
  | { type: 'assistant'; response: AssistantResponse }
  | { type: 'system'; event: SystemEvent };

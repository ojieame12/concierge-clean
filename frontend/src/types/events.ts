import type { RelaxationStep, NegotiationState } from './negotiation';
import type { ChatTurn } from './segments';

export type ConversationEventPayload =
  | { type: 'relaxation_applied'; steps: RelaxationStep[] }
  | { type: 'offer_presented'; offers: string[] }
  | { type: 'negotiation_state'; state: NegotiationState }
  | { type: 'user_action'; name: 'compare_start' | 'compare_execute' | 'add_to_cart'; data?: Record<string, unknown> };

export type ConversationEventRecord = {
  shop_id: string;
  session_id: string;
  event_type: 'relaxation_applied' | 'offer_presented' | 'negotiation_state' | 'user_action';
  payload: Record<string, unknown>;
  created_at: string;
};

export type SSESegmentEvent = {
  type: 'segment';
  segment: ChatTurn['segments'][number];
};

export type SSEDoneEvent = {
  type: 'done';
  metadata: Record<string, unknown>;
};

export type SSEErrorEvent = {
  type: 'error';
  error: string;
};

export type SSEPayload = SSESegmentEvent | SSEDoneEvent | SSEErrorEvent;

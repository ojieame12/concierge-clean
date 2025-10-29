import type { Segment, FactSheet, QuickReply } from './index';

export type { Segment, FactSheet, QuickReply } from './index';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export interface SSEDoneMetadata {
  session_key?: string;
  tone?: string;
  asked_slot?: string | null;
  candidate_stats?: { count: number };
  clarifier_options?: QuickReply[];
  conversation_stage?: string;
  conversation_mode?: string;
  rapport_mode?: boolean;
  info_mode?: boolean;
  choice_overload?: boolean;
  recommended_set_size?: number;
  validation_message?: string;
  ui_hints?: unknown;
  layout_hints?: unknown;
  pending_clarifier?: { facet: string; options?: QuickReply[] | null } | null;
  manual_clarifier?: { facet: string; prompt?: string | null } | null;
  relaxation_steps?: Array<{
    facet: string;
    from: unknown;
    to: unknown;
    found: number;
  }>;
  offers_presented?: string[];
  negotiation_state?: unknown;
  fact_sheets?: FactSheet[];
  zero_result_streak?: number;
}

export type SSEEvent =
  | { type: 'segment'; segment: Segment }
  | { type: 'done'; metadata?: SSEDoneMetadata }
  | { type: 'error'; error: string };

export interface ConversationMetadata {
  sessionKey?: string;
  askedSlot?: string | null;
  clarifierOptions?: QuickReply[];
  tone?: string | null;
  stage?: string | null;
  mode?: string | null;
  rapportMode?: boolean;
  infoMode?: boolean;
  layoutHints?: Record<string, unknown> | null;
  choiceOverload?: boolean;
  recommendedSetSize?: number | null;
  validationMessage?: string | null;
  factSheets?: FactSheet[];
  pendingClarifier?: { facet: string; options?: QuickReply[] | null } | null;
  manualClarifier?: { facet: string; prompt?: string | null } | null;
}

export interface Filter {
  id: string;
  label: string;
  value: string;
  facet: string;
}

export interface ConversationState {
  messages: Message[];
  segments: Segment[];
  filters: Filter[];
  isLoading: boolean;
  error: string | null;
  sessionKey: string;
  metadata: ConversationMetadata;
  manualClarifierActive: boolean;
}

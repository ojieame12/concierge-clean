export type ToneStyle = 'warm' | 'neutral' | 'concise' | 'empathetic_urgent';

export type QuickReply = {
  id: string;
  label: string;
  value?: string;
  icon?: string;
};

export type ProductCard = {
  id: string;
  title: string;
  price: number;
  currency: string;
  image: string | null;
  badges?: string[];
  reason: string;
  handle: string;
  variant_id?: string | null;
  similarity?: number | null;
  top_pick?: boolean;
  why_chips?: string[];
};

export type Segment =
  | { type: 'narrative'; text: string }
  | { type: 'evidence'; bullets: string[] }
  | { type: 'products'; items: ProductCard[]; layout?: 'default' | 'cross_sell' | 'threshold_nudge' | 'bundle' }
  | { type: 'capsule'; rows: Array<{ label: string; values: string[]; icon?: string }> }
  | { type: 'chips'; items: string[] }
  | { type: 'ask'; text: string }
  | { type: 'options'; style: 'quick_replies'; items: QuickReply[] }
  | { type: 'note'; text: string; tone?: 'discreet' | 'info'; variant?: 'soft_fail' | 'relaxation' | 'threshold' | 'warning' | 'info'; icon?: string }
  | { type: 'offer'; style: 'anchor' | 'sweetener' | 'discount' | 'risk'; title?: string; text: string; meta?: Record<string, unknown> }
  | { type: 'comparison';
      products: Array<{
        id: string;
        title: string;
        image?: string | null;
        features: Record<string, string | number | boolean | null | undefined>;
      }>;
      recommendation?: { productId: string; reason?: string };
    }
  | { type: 'action_suggestion'; actions: Array<Record<string, unknown>> };

export type ChatTurn = {
  turn_id: string;
  persona?: 'concierge' | 'neutral';
  segments: Segment[];
  metadata?: Record<string, unknown>;
};

export type ConciergeLayoutMode =
  | 'discovery_browse'
  | 'focused_recommendations'
  | 'comparison'
  | 'detail_assist'
  | 'offers'
  | 'recovery'
  | 'handoff'
  | 'dialogue';

export interface ConciergeLayoutHints {
  mode?: ConciergeLayoutMode;
  highlight_products?: string[];
  suggested_actions?: string[];
  closing_style?: 'question' | 'reassure' | 'call_to_action';
  show_quick_replies?: boolean;
  comparison?: {
    product_ids: string[];
  } | null;
  notes?: string[];
  recommended_set_size?: number;
}

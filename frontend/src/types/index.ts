/**
 * Conversation & Product Types
 */

// === Product Types ===

export interface ProductCard {
  id: string;
  title: string;
  price: number;
  currency?: string;
  image?: string;
  handle?: string;
  vendor?: string;
  badges?: string[];
  reason?: string;
  top_pick?: boolean;
  why_chips?: string[];
  similarity?: number;
  variants?: ProductVariant[];
}

export interface ProductVariant {
  id: string;
  title: string;
  price?: number;
  available?: boolean;
  color?: string;
  size?: string;
}

export interface FactSheet {
  id: string;
  title: string;
  summary?: string | null;
  specs?: Record<string, string | number | null>;
  derived?: Record<string, number | null>;
}

// === Segment Types ===

export interface QuickReply {
  id: string;
  label: string;
  value?: string;
  icon?: string;
  action?: string;
}

export interface ComparisonProduct {
  id: string;
  title: string;
  image?: string;
  features: Record<string, string | number | boolean>;
}

export type Segment =
  | { type: 'narrative'; text: string }
  | { type: 'evidence'; bullets: string[] }
  | { type: 'products'; items: ProductCard[]; layout?: 'default' | 'cross_sell' | 'threshold_nudge' }
  | { type: 'ask'; text: string }
  | {
      type: 'options';
      style?: 'quick_replies' | 'confirmation';
      items: QuickReply[];
    }
  | { type: 'chips'; items: string[] }
  | {
      type: 'note';
      text: string;
      tone?: 'discreet' | 'info';
      variant?: 'soft_fail' | 'relaxation' | 'threshold' | 'warning' | 'info';
      icon?: string;
    }
  | {
      type: 'offer';
      style: 'anchor' | 'sweetener' | 'discount' | 'risk';
      title?: string;
      text: string;
      meta?: Record<string, unknown>;
    }
  | {
      type: 'comparison';
      products: ComparisonProduct[];
      recommendation?: { productId: string; reason?: string };
    }
  | {
      type: 'capsule';
      rows: Array<{ label: string; values: string[] }>;
    }
  | { type: 'action_suggestion'; actions: Array<Record<string, unknown>> };

// === Component Props (for injection) ===

/**
 * Product card props (for component injection)
 */
export interface ProductCardProps {
  product: ProductCard;
  reason?: string;
  onClick?: () => void;
}

/**
 * Product drawer props (for component injection)
 */
export interface ProductDrawerProps {
  isOpen: boolean;
  product: ProductCard | null;
  onClose: () => void;
  onAddToCart?: (variantId: string, quantity: number) => Promise<boolean>;
  onCompare?: () => void;
}

/**
 * Response turn props
 */
export interface ResponseTurnProps {
  mainLead?: string;
  responseDetail?: string;
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectCapsuleValue?: (label: string, value: string) => void;
  onSelectProduct?: (product: ProductCard) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  isFirstResponse?: boolean;
  enableAnimations?: boolean;
  allowQuickReplies?: boolean;
  depth?: number;
  depthOpacity?: number;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCard) => void;
}

/**
 * Segment renderer props
 */
export interface SegmentRendererProps {
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectCapsuleValue?: (label: string, value: string) => void;
  onSelectProduct?: (product: ProductCard) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  allowQuickReplies?: boolean;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCard) => void;
}

/**
 * MainInput props
 */
export interface MainInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  isCompact?: boolean;
}

/**
 * OptionButtons props
 */
export interface OptionButtonsProps {
  options: QuickReply[];
  selectedValue?: string | null;
  isActive?: boolean;
  onSelect: (value: string, label: string) => void;
  hide?: boolean;
}

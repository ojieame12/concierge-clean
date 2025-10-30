/**
 * Shared Types for Insite
 * 
 * Common types used across frontend and backend
 */

// ===== Chat & Conversation =====

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments?: Segment[];
  timestamp: string;
}

// ===== Segments (UI Components) =====

export type SegmentType = 'narrative' | 'products' | 'ask' | 'options' | 'final_recommendation';

export interface BaseSegment {
  type: SegmentType;
}

export interface NarrativeSegment extends BaseSegment {
  type: 'narrative';
  text: string;
}

export interface ProductsSegment extends BaseSegment {
  type: 'products';
  products: ProductCard[];
  context?: string;
}

export interface AskSegment extends BaseSegment {
  type: 'ask';
  text: string;
}

export interface OptionsSegment extends BaseSegment {
  type: 'options';
  items: QuickReply[];
}

export interface FinalRecommendationSegment extends BaseSegment {
  type: 'final_recommendation';
  product: ProductCard;
  reasoning: string;
}

export type Segment = 
  | NarrativeSegment 
  | ProductsSegment 
  | AskSegment 
  | OptionsSegment 
  | FinalRecommendationSegment;

// ===== Products =====

export interface ProductCard {
  id: string;
  title: string;
  price: number;
  currency?: string;
  image_url?: string;
  url?: string;
  description?: string;
  in_stock?: boolean;
  rating?: number;
  review_count?: number;
  variants?: ProductVariant[];
  features?: string[];
  category?: string;
}

export interface ProductVariant {
  id: string;
  name: string;
  value: string;
  in_stock: boolean;
  price_delta?: number;
}

// ===== Quick Replies =====

export interface QuickReply {
  id: string;
  label: string;
  value?: string;
}

// ===== Session =====

export interface ConversationSession {
  id: string;
  shop_id: string;
  user_id?: string;
  messages: ChatMessage[];
  context?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// ===== Store Card =====

export interface StoreCard {
  store_id: string;
  store_name: string;
  shop_domain: string;
  brand_voice: {
    tone?: string;
    personality?: string;
    guidelines?: string[];
  };
  policies: {
    returns?: string;
    shipping?: string;
    exchanges?: string;
  };
  merchandising: {
    upsell_strategy?: string;
    cross_sell?: boolean;
  };
  categories: {
    primary: string[];
    expertise_areas: string[];
  };
  faqs: Array<{
    question: string;
    answer: string;
  }>;
  support?: {
    hours: string;
    channels: string[];
    response_time: string;
  };
  merchandising_priorities?: {
    price_sensitivity: 'low' | 'balanced' | 'high';
    quality_focus: 'budget' | 'balanced' | 'premium';
    sustainability_focus: boolean;
  };
  product_sample?: ProductCard[];
  ttl_days?: number;
}

// ===== API Requests/Responses =====

export interface ChatRequest {
  message: string;
  session_id?: string;
  shop_domain: string;
  user_id?: string;
  context?: Record<string, any>;
}

export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
  segments: Segment[];
}

// ===== Search & Ranking =====

export interface SearchQuery {
  query: string;
  shop_id: string;
  filters?: SearchFilters;
  limit?: number;
}

export interface SearchFilters {
  category?: string;
  price_min?: number;
  price_max?: number;
  in_stock?: boolean;
  rating_min?: number;
}

export interface SearchResult {
  products: ProductCard[];
  total: number;
  query: string;
}

// ===== Topic Classification =====

export type TopicType = 
  | 'product_search' 
  | 'product_info' 
  | 'store_info' 
  | 'policy_info' 
  | 'rapport' 
  | 'off_topic';

export interface TopicClassification {
  topic: TopicType;
  confidence: number;
  reasoning?: string;
}

// ===== Theme System =====

export * from './themeSchema';

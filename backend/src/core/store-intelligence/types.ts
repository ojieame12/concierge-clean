/**
 * Store Intelligence Types
 * 
 * Defines the structure of Store Cards - condensed store profiles
 * that provide brand voice, policies, and merchandising context.
 */

export interface StoreCard {
  // Store identity
  store_id: string;
  store_name: string;
  shop_domain: string;
  
  // Brand voice and tone
  brand_voice: {
    personality: string; // e.g., "Helpful, technical, concise"
    tone: 'warm' | 'neutral' | 'professional' | 'casual';
    formality: 'formal' | 'conversational' | 'friendly';
    expertise_level: 'beginner-friendly' | 'intermediate' | 'expert';
  };
  
  // Mission and positioning
  mission: string; // 1-2 sentences
  target_customer: string; // e.g., "Budget-conscious students and professionals"
  unique_value_prop: string; // What makes this store different
  
  // Policies
  policies: {
    returns: {
      window_days: number;
      conditions: string;
      restocking_fee: boolean;
      restocking_fee_amount?: string;
    };
    shipping: {
      free_threshold?: number;
      free_threshold_currency?: string;
      standard_time: string; // e.g., "3-5 business days"
      expedited_available: boolean;
      international: boolean;
    };
    warranty: {
      standard: string; // e.g., "1 year manufacturer warranty"
      extended_available: boolean;
    };
    price_match: {
      available: boolean;
      conditions?: string;
    };
  };
  
  // Merchandising priorities
  merchandising: {
    preferred_brands: string[]; // Brands to prioritize in recommendations
    price_positioning: 'budget' | 'mid-range' | 'premium' | 'luxury';
    quality_focus: 'value' | 'balanced' | 'premium';
    sustainability_focus: boolean;
  };
  
  // Category information
  categories: {
    primary: string[]; // Main product categories
    expertise_areas: string[]; // Categories with deep knowledge
  };
  
  // Customer service
  support: {
    hours: string; // e.g., "Mon-Fri 9am-6pm EST"
    channels: Array<'chat' | 'email' | 'phone'>;
    response_time: string; // e.g., "Within 24 hours"
  };
  
  // Loyalty and promotions
  loyalty?: {
    program_name: string;
    benefits: string[];
  };
  
  // FAQs (common questions and answers)
  faqs: Array<{
    question: string;
    answer: string;
    category: 'shipping' | 'returns' | 'warranty' | 'payment' | 'general';
  }>;
  
  // Metadata
  generated_at: string; // ISO timestamp
  version: string;
  ttl_days: number; // Cache TTL
}

export interface StoreCardGenerationContext {
  store_id: string;
  store_name: string;
  shop_domain: string;
  brand_profile?: any; // From database
  product_sample: Array<{
    id: string;
    title: string;
    vendor: string;
    product_type: string;
    price: number;
  }>; // Sample products for analysis
}

export interface StoreCardCache {
  store_id: string;
  card: StoreCard;
  cached_at: string;
  expires_at: string;
}

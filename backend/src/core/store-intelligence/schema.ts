import { z } from 'zod';

export const StoreCardSchema = z.object({
  store_id: z.string(),
  store_name: z.string(),
  shop_domain: z.string(),
  brand_voice: z.object({
    personality: z.string(),
    tone: z.enum(['warm', 'neutral', 'professional', 'casual']),
    formality: z.enum(['formal', 'conversational', 'friendly']),
    expertise_level: z.enum(['beginner-friendly', 'intermediate', 'expert'])
  }),
  mission: z.string(),
  positioning: z.string(),
  policies: z.object({
    returns: z.object({
      window_days: z.number().int().positive(),
      conditions: z.string(),
      exceptions: z.array(z.string()).optional()
    }),
    shipping: z.object({
      free_threshold: z.number().nonnegative(),
      standard_cost: z.number().nonnegative(),
      standard_days: z.string(),
      expedited_cost: z.number().nonnegative().optional(),
      expedited_days: z.string().optional(),
      international: z.string().optional()
    }),
    warranty: z.object({
      standard_months: z.number().int().positive(),
      extended_available: z.boolean().optional(),
      lifetime_categories: z.array(z.string()).optional()
    }).optional(),
    price_match: z.object({
      available: z.boolean(),
      conditions: z.string().optional()
    }).optional()
  }),
  merchandising: z.object({
    preferred_brands: z.array(z.string()),
    price_positioning: z.enum(['budget', 'mid-range', 'premium', 'luxury']),
    quality_focus: z.enum(['value', 'balanced', 'premium'])
  }),
  categories: z.object({
    primary: z.array(z.string()),
    secondary: z.array(z.string()).optional()
  }),
  expertise_areas: z.array(z.string()),
  customer_support: z.object({
    hours: z.string(),
    channels: z.array(z.string()),
    response_time: z.string()
  }),
  loyalty: z.object({
    program_name: z.string().optional(),
    benefits: z.array(z.string()).optional()
  }).optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    category: z.enum(['shipping', 'returns', 'warranty', 'payment', 'general'])
  })),
  generated_at: z.string(),
  version: z.string(),
  ttl_days: z.number().int().min(1).max(30)
});

export type StoreCard = z.infer<typeof StoreCardSchema>;

/**
 * Validate Store Card JSON from LLM
 */
export const validateStoreCard = (data: unknown): StoreCard => {
  return StoreCardSchema.parse(data);
};

/**
 * Safely validate Store Card
 */
export const safeParseStoreCard = (data: unknown) => {
  return StoreCardSchema.safeParse(data);
};

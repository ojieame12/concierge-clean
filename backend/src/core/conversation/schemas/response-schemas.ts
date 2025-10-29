/**
 * Zod Schemas for LLM Response Validation
 * 
 * Validates all LLM outputs to prevent malformed responses
 * and ensure type safety throughout the pipeline.
 */

import { z } from 'zod';

// === Product Schemas ===

export const ProductVariantSchema = z.object({
  id: z.string(),
  title: z.string(),
  price: z.number().nonnegative().optional(),
  available: z.boolean().optional(),
  color: z.string().optional(),
  size: z.string().optional()
});

export const ProductCardSchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200),
  price: z.number().nonnegative(),
  currency: z.string().optional(),
  image: z.string().url().optional().or(z.string().length(0)),
  handle: z.string().optional(),
  vendor: z.string().optional(),
  badges: z.array(z.string()).optional(),
  reason: z.string().max(300).optional(),
  top_pick: z.boolean().optional(),
  why_chips: z.array(z.string().max(100)).max(5).optional(),
  similarity: z.number().min(0).max(1).optional(),
  variants: z.array(ProductVariantSchema).optional()
});

export const FactSheetSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string().nullable().optional(),
  specs: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
  derived: z.record(z.string(), z.number().nullable()).optional()
});

// === Segment Schemas ===

export const QuickReplySchema = z.object({
  id: z.string(),
  label: z.string().min(1).max(100),
  value: z.string().optional(),
  icon: z.string().optional(),
  action: z.string().optional()
});

export const ComparisonProductSchema = z.object({
  id: z.string(),
  title: z.string(),
  image: z.string().optional(),
  features: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
});

// Segment type discriminated union
export const SegmentSchema = z.discriminatedUnion('type', [
  // Narrative segment
  z.object({
    type: z.literal('narrative'),
    text: z.string().min(1).max(1000)
  }),
  
  // Evidence segment
  z.object({
    type: z.literal('evidence'),
    bullets: z.array(z.string().min(1).max(200)).min(1).max(10)
  }),
  
  // Products segment
  z.object({
    type: z.literal('products'),
    items: z.array(ProductCardSchema).min(1).max(10),
    layout: z.enum(['default', 'cross_sell', 'threshold_nudge']).optional()
  }),
  
  // Ask segment
  z.object({
    type: z.literal('ask'),
    text: z.string().min(1).max(300)
  }),
  
  // Options segment
  z.object({
    type: z.literal('options'),
    style: z.enum(['quick_replies', 'confirmation']).optional(),
    items: z.array(QuickReplySchema).min(2).max(6)
  }),
  
  // Chips segment
  z.object({
    type: z.literal('chips'),
    items: z.array(z.string().min(1).max(50)).min(1).max(10)
  }),
  
  // Note segment
  z.object({
    type: z.literal('note'),
    text: z.string().min(1).max(500),
    tone: z.enum(['discreet', 'info']).optional(),
    variant: z.enum(['soft_fail', 'relaxation', 'threshold', 'warning', 'info']).optional(),
    icon: z.string().optional()
  }),
  
  // Offer segment
  z.object({
    type: z.literal('offer'),
    style: z.enum(['anchor', 'sweetener', 'discount', 'risk']),
    title: z.string().max(100).optional(),
    text: z.string().min(1).max(300),
    meta: z.record(z.string(), z.unknown()).optional()
  }),
  
  // Comparison segment
  z.object({
    type: z.literal('comparison'),
    products: z.array(ComparisonProductSchema).min(2).max(5),
    recommendation: z.object({
      productId: z.string(),
      reason: z.string().max(200).optional()
    }).optional()
  }),
  
  // Capsule segment
  z.object({
    type: z.literal('capsule'),
    rows: z.array(
      z.object({
        label: z.string().min(1).max(50),
        values: z.array(z.string().min(1).max(100)).min(1).max(5)
      })
    ).min(1).max(10)
  }),
  
  // Action suggestion segment
  z.object({
    type: z.literal('action_suggestion'),
    actions: z.array(z.record(z.string(), z.unknown())).min(1).max(5)
  })
]);

// === Response Metadata Schemas ===

export const RelaxationStepSchema = z.object({
  facet: z.string(),
  from: z.unknown(),
  to: z.unknown(),
  found: z.number().int().nonnegative()
});

export const PendingClarifierSchema = z.object({
  facet: z.string(),
  options: z.array(QuickReplySchema).nullable().optional()
});

export const ManualClarifierSchema = z.object({
  facet: z.string(),
  prompt: z.string().nullable().optional()
});

export const SSEDoneMetadataSchema = z.object({
  session_key: z.string().optional(),
  tone: z.string().optional(),
  asked_slot: z.string().nullable().optional(),
  candidate_stats: z.object({ count: z.number().int().nonnegative() }).optional(),
  clarifier_options: z.array(QuickReplySchema).optional(),
  conversation_stage: z.string().optional(),
  conversation_mode: z.string().optional(),
  rapport_mode: z.boolean().optional(),
  info_mode: z.boolean().optional(),
  choice_overload: z.boolean().optional(),
  recommended_set_size: z.number().int().positive().optional(),
  validation_message: z.string().optional(),
  ui_hints: z.unknown().optional(),
  layout_hints: z.unknown().optional(),
  pending_clarifier: PendingClarifierSchema.nullable().optional(),
  manual_clarifier: ManualClarifierSchema.nullable().optional(),
  relaxation_steps: z.array(RelaxationStepSchema).optional(),
  offers_presented: z.array(z.string()).optional(),
  negotiation_state: z.unknown().optional(),
  fact_sheets: z.array(FactSheetSchema).optional(),
  zero_result_streak: z.number().int().nonnegative().optional()
});

// === Complete Response Schema ===

export const ChatTurnSchema = z.object({
  segments: z.array(SegmentSchema).min(1).max(20),
  metadata: SSEDoneMetadataSchema.optional()
});

// === Type Exports ===

export type ProductCard = z.infer<typeof ProductCardSchema>;
export type ProductVariant = z.infer<typeof ProductVariantSchema>;
export type FactSheet = z.infer<typeof FactSheetSchema>;
export type QuickReply = z.infer<typeof QuickReplySchema>;
export type Segment = z.infer<typeof SegmentSchema>;
export type RelaxationStep = z.infer<typeof RelaxationStepSchema>;
export type SSEDoneMetadata = z.infer<typeof SSEDoneMetadataSchema>;
export type ChatTurn = z.infer<typeof ChatTurnSchema>;

// === Validation Helpers ===

/**
 * Validate and parse a chat turn response
 * Throws ZodError if validation fails
 */
export const validateChatTurn = (data: unknown): ChatTurn => {
  return ChatTurnSchema.parse(data);
};

/**
 * Safely validate a chat turn response
 * Returns { success: true, data } or { success: false, error }
 */
export const safeParseChatTurn = (data: unknown) => {
  return ChatTurnSchema.safeParse(data);
};

/**
 * Validate individual segment
 */
export const validateSegment = (data: unknown): Segment => {
  return SegmentSchema.parse(data);
};

/**
 * Safely validate individual segment
 */
export const safeParseSegment = (data: unknown) => {
  return SegmentSchema.safeParse(data);
};

/**
 * Validate product card
 */
export const validateProductCard = (data: unknown): ProductCard => {
  return ProductCardSchema.parse(data);
};

/**
 * Validate array of segments
 */
export const validateSegments = (data: unknown): Segment[] => {
  return z.array(SegmentSchema).min(1).max(20).parse(data);
};

/**
 * Auto-repair common validation errors
 * Returns repaired data or throws if unrepairable
 */
export const repairAndValidateChatTurn = (data: any): ChatTurn => {
  // Repair common issues
  if (data && typeof data === 'object') {
    // Ensure segments is an array
    if (!Array.isArray(data.segments)) {
      if (data.segments && typeof data.segments === 'object') {
        data.segments = [data.segments];
      } else {
        data.segments = [];
      }
    }
    
    // Repair segments
    data.segments = data.segments
      .filter((seg: any) => seg && typeof seg === 'object' && seg.type)
      .map((seg: any) => {
        // Truncate long text
        if (seg.type === 'narrative' && seg.text && seg.text.length > 1000) {
          seg.text = seg.text.substring(0, 997) + '...';
        }
        
        if (seg.type === 'ask' && seg.text && seg.text.length > 300) {
          seg.text = seg.text.substring(0, 297) + '...';
        }
        
        // Ensure products have required fields
        if (seg.type === 'products' && Array.isArray(seg.items)) {
          seg.items = seg.items
            .filter((p: any) => p && p.id && p.title && typeof p.price === 'number')
            .slice(0, 10); // Max 10 products
        }
        
        // Ensure options have required fields
        if (seg.type === 'options' && Array.isArray(seg.items)) {
          seg.items = seg.items
            .filter((opt: any) => opt && opt.id && opt.label)
            .slice(0, 6); // Max 6 options
        }
        
        return seg;
      });
    
    // Remove empty segments
    data.segments = data.segments.filter((seg: any) => {
      if (seg.type === 'products') {
        return seg.items && seg.items.length > 0;
      }
      if (seg.type === 'options') {
        return seg.items && seg.items.length >= 2;
      }
      return true;
    });
    
    // Ensure at least one segment
    if (data.segments.length === 0) {
      data.segments = [{
        type: 'narrative',
        text: 'I apologize, but I encountered an issue processing your request. Could you please rephrase?'
      }];
    }
  }
  
  // Validate after repair
  return ChatTurnSchema.parse(data);
};

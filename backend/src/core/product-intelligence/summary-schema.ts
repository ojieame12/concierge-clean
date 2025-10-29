import { z } from 'zod';

export const productSummarySchema = z.object({
  productId: z.string(),
  category: z.string().optional(),
  subcategory: z.string().optional(),
  pricePositioning: z.enum(['entry', 'mid', 'premium']).optional(),
  keyFeatures: z.array(z.string()).max(8).optional(),
  specifications: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
      })
    )
    .max(12)
    .optional(),
  pros: z.array(z.string()).max(6).optional(),
  cons: z.array(z.string()).max(6).optional(),
  bestFor: z.array(z.string()).max(5).optional(),
  useCases: z.array(z.string()).max(6).optional(),
  materials: z.array(z.string()).max(6).optional(),
  styleDescriptors: z.array(z.string()).max(6).optional(),
  careInstructions: z.array(z.string()).max(4).optional(),
  crossSell: z
    .array(
      z.object({
        relatedProductHandle: z.string(),
        reason: z.string(),
      })
    )
    .max(4)
    .optional(),
  upsell: z
    .array(
      z.object({
        relatedProductHandle: z.string(),
        reason: z.string(),
      })
    )
    .max(4)
    .optional(),
  highlightedFAQs: z
    .array(
      z.object({
        question: z.string(),
        answer: z.string(),
      })
    )
    .max(3)
    .optional(),
  tags: z.array(z.string()).max(12).optional(),
});

export type ProductSummary = z.infer<typeof productSummarySchema>;

export const PRODUCT_SUMMARY_PROMPT = `You are a merchandising analyst. Summarize the following product for an AI shopping assistant.
Return STRICT JSON matching this schema:
{
  "productId": string,                             // Must echo the provided product_id
  "category": string,                             // High-level category inferred from data
  "subcategory": string?,                         // Optional sub-category
  "pricePositioning": "entry" | "mid" | "premium"?,
  "keyFeatures": string[]?,                       // 3-6 bullet points, user-friendly
  "specifications": [{ "label": string, "value": string }]?,
  "pros": string[]?,
  "cons": string[]?,
  "bestFor": string[]?,                           // Who/when the product is ideal for
  "useCases": string[]?,
  "materials": string[]?,
  "styleDescriptors": string[]?,
  "careInstructions": string[]?,
  "crossSell": [{ "relatedProductHandle": string, "reason": string }]?,
  "upsell": [{ "relatedProductHandle": string, "reason": string }]?,
  "highlightedFAQs": [{ "question": string, "answer": string }]?,
  "tags": string[]?
}

Rules:
- Only use factual information from the provided product data (title, description, vendor, product_type, variants, tags).
- keyFeatures should be short, user-friendly bullet text (≤12 words each).
- pros/cons must be honest, derived from the description/specs.
- bestFor / useCases should be short phrases (e.g. "Daily commuting").
- pricePositioning is optional but, if inferred, map to entry (<$75), mid ($75-$200), or premium (>$200) price point.
- crossSell / upsell handles should come from any related products mentioned in content (if none, omit the field).
- Respond with JSON ONLY (no markdown, no prose).`;

import { z } from 'zod';

import type { Product } from './types';
import type { ProductFactSheet } from './tools/product-facts';
import type { ConciergeLayoutHints } from '@insite/shared-types';

export interface GeminiTurnContext {
  shopId: string;
  brandProfile?: any;
  conversationHistory: Array<{ speaker: 'user' | 'assistant'; text: string }>;
  activeFilters: Record<string, string>;
  rejectedProductIds: string[];
  acceptedProductIds: string[];
  candidateProducts: Product[];
  unresolvedFacets: string[];
  availableFacetValues: Record<string, string[]>;
  canonicalClarifierOptions?: Record<string, ClarifierOption[]>;
  factSheets?: ProductFactSheet[];
  brandDocs?: Record<string, string | undefined>;
  canonInsights?: Array<{ topic: string; assertions: string[]; caveats?: string[]; citation?: string }>;
  calculators?: Array<{ id: string; label?: string; description?: string; inputSchema?: Record<string, unknown>; outputSchema?: Record<string, unknown>; appliesTo?: string[] }>;
  calculatorResults?: Array<{ id: string; label: string; inputs: Record<string, number>; outputs: Record<string, unknown>; description?: string }>;
  conversationHints?: {
    conversationMode?: 'commerce' | 'smalltalk';
    rapportMode?: boolean;
    infoMode?: boolean;
    stage?: 'diagnosis_situation' | 'diagnosis_problem' | 'diagnosis_implication' | 'prescription_need_payoff' | 'closing' | 'smalltalk';
    persona?: 'explorer' | 'validator' | 'minimalist' | 'undetermined';
    productCount: number;
    relaxationApplied: boolean;
    relaxationSummary?: string;
    choiceOverload?: boolean;
    recommendedSetSize?: number;
    validationMessage?: string;
  };
}

export type GeminiStage = 'clarify' | 'refine' | 'final';

export interface ClarifierOption {
  label: string;
  value: string;
  aliases?: string[];
}

export interface ParsedGeminiClarifier {
  facet: string;
  question: string;
  options: ClarifierOption[];
}

export interface ParsedGeminiRecommendation {
  productId: string;
  rationale: string[];
  headline?: string;
}

export interface ParsedGeminiTurn {
  rawText: string;
  stage: GeminiStage;
  narrative: string;
  recommendations: ParsedGeminiRecommendation[];
  clarifier?: ParsedGeminiClarifier;
  suggestedFilters?: Array<{ facet: string; value: string; reason?: string }>;
  uiHints?: ConciergeLayoutHints;
}

const uiHintsSchema = z
  .object({
    mode: z
      .enum([
        'discovery_browse',
        'focused_recommendations',
        'comparison',
        'detail_assist',
        'offers',
        'recovery',
        'handoff',
      ])
      .optional(),
    highlight_products: z.array(z.string()).max(12).optional(),
    suggested_actions: z.array(z.string().min(1).max(80)).max(6).optional(),
    closing_style: z.enum(['question', 'reassure', 'call_to_action']).optional(),
    show_quick_replies: z.boolean().optional(),
    comparison: z
      .object({
        product_ids: z.array(z.string()).min(2).max(5),
      })
      .optional()
      .nullable(),
    notes: z.array(z.string().min(1).max(160)).max(4).optional(),
  })
  .optional();

export const geminiResponseSchema = z.object({
  stage: z.enum(['clarify', 'refine', 'final']),
  opening: z.string().min(3).max(320),
  recommendations: z
    .array(
      z.object({
        product_id: z.string(),
        title: z.string().optional(),
        reason: z.string().min(3).max(280),
        confidence: z.enum(['high', 'medium', 'low']).optional(),
      })
    )
    .default([]),
  clarifier: z
    .object({
      facet: z.string(),
      question: z.string().min(3).max(200),
      options: z
        .array(
          z.object({
            label: z.string().min(1).max(80),
            value: z.string().min(1).max(80),
            aliases: z.array(z.string().min(1).max(80)).optional(),
          })
        )
        .min(2)
        .max(6),
    })
    .nullish(),
  suggested_filters: z
    .array(
      z.object({
        facet: z.string(),
        value: z.string(),
        reason: z.string().optional(),
      })
    )
    .optional()
    .nullable()
    .transform((value) => value ?? []),
  ui_hints: uiHintsSchema,
});

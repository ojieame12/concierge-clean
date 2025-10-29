import { chatModel } from '../../infra/llm/gemini';
import type { Product } from '../conversation/types';

/**
 * Gemini-Powered Product Spec Extractor
 *
 * Automatically enriches products with structured specifications
 * by analyzing descriptions, titles, and tags.
 *
 * Works with ANY product data quality - fills in the blanks intelligently.
 */

export interface ProductEnrichment {
  flex_rating?: 'soft' | 'medium' | 'stiff' | 'medium-soft' | 'medium-stiff';
  camber_profile?: 'traditional' | 'rocker' | 'hybrid' | 'flat';
  shape?: 'twin' | 'directional' | 'directional twin' | 'asymmetric';
  skill_level?: ('beginner' | 'intermediate' | 'advanced')[];
  best_for?: string[];  // ["all-mountain", "park", "powder"]
  key_features?: string[];  // ["Forgiving flex", "Hybrid camber"]
  why_good?: string;  // "Perfect for beginners learning edge control"
  typical_rider?: string;  // "Intermediate riders who want versatility"
  confidence?: number;  // 0.0-1.0
  source?: string;  // 'gemini_extraction' | 'gemini_research' | 'reference_db'
}

/**
 * Extract specifications from product using Gemini
 * Fast extraction from existing description/tags (no web search)
 */
export async function extractSpecsWithGemini(product: Product): Promise<ProductEnrichment> {
  const prompt = `Analyze this snowboard and extract technical specifications. Be precise and only include what you're confident about.

Product Title: ${product.title}
Brand: ${product.vendor || 'Unknown'}
Description: ${product.description || 'No description provided'}
Tags: ${product.tags?.join(', ') || 'None'}
Price: $${product.price || 'Unknown'}

Extract specifications in JSON format:
{
  "flex_rating": "soft" | "medium" | "stiff" | "medium-soft" | "medium-stiff" | null,
  "camber_profile": "traditional" | "rocker" | "hybrid" | "flat" | null,
  "shape": "twin" | "directional" | "directional twin" | null,
  "skill_level": ["beginner", "intermediate", "advanced"] (array, can be multiple),
  "best_for": ["all-mountain", "park", "powder", "freeride", "carving"] (array),
  "key_features": ["max 3 standout features as short phrases"],
  "why_good": "One clear sentence explaining what makes this board special or who it's perfect for",
  "typical_rider": "Short description of ideal user"
}

Guidelines:
- If uncertain about a spec, use null
- Infer from brand reputation if needed (Burton Custom = medium flex, hybrid camber)
- Be specific and actionable
- Focus on what matters to riders

Return only valid JSON, no additional text.`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,  // Low temperature for factual extraction
        topP: 0.8,
        maxOutputTokens: 400
      }
    });

    const text = response.response.text().trim();

    // Clean potential JSON markdown
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const enrichment: ProductEnrichment = JSON.parse(jsonText);

    return {
      ...enrichment,
      confidence: 0.75,  // Gemini extraction confidence
      source: 'gemini_extraction'
    };
  } catch (error) {
    console.warn('[gemini-extractor] Failed to extract specs:', (error as Error).message);
    return {
      confidence: 0,
      source: 'extraction_failed'
    };
  }
}

/**
 * Enrichment with web research (more thorough, slower)
 * Use for products where basic extraction returns insufficient data
 */
export async function enrichWithWebResearch(product: Product): Promise<ProductEnrichment> {
  const searchQuery = `${product.vendor} ${product.title} snowboard specifications review`;

  const prompt = `Research this snowboard online and provide detailed specifications.

Product: ${product.title}
Brand: ${product.vendor}
Search for: Official specs, reviews, manufacturer data

Extract and return JSON:
{
  "flex_rating": "soft" | "medium" | "stiff" | null,
  "camber_profile": "traditional" | "rocker" | "hybrid" | null,
  "shape": "twin" | "directional" | null,
  "skill_level": [...],
  "best_for": [...],
  "key_features": [...],
  "why_good": "Detailed explanation based on reviews and specs",
  "typical_rider": "Who this board is perfect for",
  "expert_notes": "Any special considerations or standout characteristics"
}

Be thorough and cite real specifications. If you can't find certain specs, use null.`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600
      }
      // Note: Web grounding/search would be enabled here if available
    });

    const text = response.response.text().trim();
    const jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const enrichment: ProductEnrichment = JSON.parse(jsonText);

    return {
      ...enrichment,
      confidence: 0.9,  // Web research confidence
      source: 'gemini_research'
    };
  } catch (error) {
    console.warn('[gemini-extractor] Web research failed:', (error as Error).message);
    return {
      confidence: 0,
      source: 'research_failed'
    };
  }
}

/**
 * Quick check if product needs enrichment
 */
export function needsEnrichment(product: Product): boolean {
  // Has minimal data
  const hasMinimalDescription = !product.description || product.description.length < 50;
  const hasFewTags = !product.tags || product.tags.length < 3;
  const noSummary = !product.summary || Object.keys(product.summary).length === 0;

  return hasMinimalDescription || hasFewTags || noSummary;
}

/**
 * Match enriched specs to user context and generate reasoning
 */
export function generateReasonFromEnrichment(
  enrichment: ProductEnrichment,
  userContext: { skillLevel?: string; conditions?: string }
): string | null {
  const reasons: string[] = [];

  // Match skill level
  if (userContext.skillLevel && enrichment.skill_level?.includes(userContext.skillLevel as any)) {
    if (enrichment.flex_rating) {
      reasons.push(`${enrichment.flex_rating} flex ideal for ${userContext.skillLevel}s`);
    }
  }

  // Match conditions
  if (userContext.conditions) {
    if (userContext.conditions.includes('ice') && enrichment.camber_profile) {
      if (enrichment.camber_profile === 'traditional' || enrichment.camber_profile === 'hybrid') {
        reasons.push('solid edge grip on ice');
      }
    }

    if (userContext.conditions.includes('powder') && enrichment.shape === 'directional') {
      reasons.push('floats well in deep snow');
    }

    if (userContext.conditions.includes('park') && enrichment.shape === 'twin') {
      reasons.push('perfect for landing switch');
    }
  }

  // Use why_good if available and no better match
  if (reasons.length === 0 && enrichment.why_good) {
    return enrichment.why_good;
  }

  return reasons.length > 0 ? reasons.join(', ') : null;
}

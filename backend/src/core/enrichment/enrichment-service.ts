import type { SupabaseClient } from '@supabase/supabase-js';
import type { Product } from '../conversation/types';
import { extractSpecsWithGemini, enrichWithWebResearch, type ProductEnrichment } from './gemini-extractor';

/**
 * Product Enrichment Service
 *
 * Manages automatic product intelligence with caching and fallbacks.
 * Ensures every product has rich reasoning regardless of source data quality.
 */

// In-memory cache for enrichments (avoid repeated DB calls)
const enrichmentCache = new Map<string, ProductEnrichment>();
const CACHE_TTL_MS = 60 * 60 * 1000;  // 1 hour

interface CachedEnrichment {
  data: ProductEnrichment;
  fetchedAt: number;
}

const enrichmentCacheWithTTL = new Map<string, CachedEnrichment>();

/**
 * Get enrichment for a product (with caching)
 */
export async function getProductEnrichment(
  supabase: SupabaseClient,
  product: Product
): Promise<ProductEnrichment | null> {
  // Check memory cache first
  const cached = enrichmentCacheWithTTL.get(product.id);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Check database
  try {
    const { data, error } = await supabase
      .from('product_enrichments')
      .select('*')
      .eq('product_id', product.id)
      .single();

    if (data && !error) {
      const enrichment: ProductEnrichment = {
        flex_rating: data.flex_rating,
        camber_profile: data.camber_profile,
        shape: data.shape,
        skill_level: data.skill_level,
        best_for: data.best_for,
        key_features: data.key_features,
        why_good: data.why_good,
        typical_rider: data.typical_rider,
        confidence: data.confidence,
        source: data.source
      };

      // Cache it
      enrichmentCacheWithTTL.set(product.id, {
        data: enrichment,
        fetchedAt: Date.now()
      });

      return enrichment;
    }
  } catch (error) {
    console.warn('[enrichment] DB lookup failed:', (error as Error).message);
  }

  return null;
}

/**
 * Enrich a product and store the result
 */
export async function enrichProduct(
  supabase: SupabaseClient,
  product: Product,
  useWebResearch: boolean = false
): Promise<ProductEnrichment> {
  console.log(`[enrichment] Enriching product: ${product.title}`);

  let enrichment: ProductEnrichment;

  if (useWebResearch) {
    enrichment = await enrichWithWebResearch(product);
  } else {
    enrichment = await extractSpecsWithGemini(product);
  }

  // Store in database
  try {
    const productRecord = product as unknown as { shop_id?: unknown };
    const shopId = typeof productRecord.shop_id === 'string' ? productRecord.shop_id : null;

    const { error: upsertError } = await supabase
      .from('product_enrichments')
      .upsert({
        product_id: product.id,
        shop_id: typeof shopId === 'string' ? shopId : null,
        flex_rating: enrichment.flex_rating || null,
        camber_profile: enrichment.camber_profile || null,
        shape: enrichment.shape || null,
        skill_level: enrichment.skill_level || [],
        best_for: enrichment.best_for || [],
        key_features: enrichment.key_features || [],
        why_good: enrichment.why_good || null,
        typical_rider: enrichment.typical_rider || null,
        expert_notes: (enrichment as any).expert_notes || null,
        source: enrichment.source || 'unknown',
        confidence: enrichment.confidence || 0.5,
        enriched_at: new Date().toISOString(),
        enrichment_version: 1
      });

    if (upsertError) {
      console.error(`[enrichment] ❌ Database error for ${product.title}:`, upsertError);
      throw upsertError;
    }

    console.log(`[enrichment] ✓ Stored enrichment for: ${product.title}`);
  } catch (error) {
    console.error('[enrichment] Failed to store:', error);
    throw error;  // Don't silently swallow errors
  }

  // Cache it
  enrichmentCacheWithTTL.set(product.id, {
    data: enrichment,
    fetchedAt: Date.now()
  });

  return enrichment;
}

/**
 * Get or create enrichment (lazy enrichment)
 */
export async function getOrEnrichProduct(
  supabase: SupabaseClient,
  product: Product
): Promise<ProductEnrichment | null> {
  // Try to get existing
  const existing = await getProductEnrichment(supabase, product);
  if (existing && existing.confidence && existing.confidence > 0.3) {
    return existing;
  }

  // Generate new enrichment (async, don't block)
  enrichProduct(supabase, product, false).catch(error => {
    console.warn('[enrichment] Background enrichment failed:', error);
  });

  // Return existing even if low confidence (better than nothing)
  return existing;
}

/**
 * Batch enrich multiple products
 */
export async function enrichProducts(
  supabase: SupabaseClient,
  products: Product[],
  options: {
    useWebResearch?: boolean;
    rateLimitMs?: number;
  } = {}
): Promise<{ success: number; failed: number }> {
  const { useWebResearch = false, rateLimitMs = 1000 } = options;

  let success = 0;
  let failed = 0;

  for (const product of products) {
    try {
      await enrichProduct(supabase, product, useWebResearch);
      success++;

      // Rate limit to avoid API throttling
      if (rateLimitMs > 0) {
        await new Promise(resolve => setTimeout(resolve, rateLimitMs));
      }
    } catch (error) {
      console.error(`[enrichment] Failed: ${product.title}`, error);
      failed++;
    }
  }

  console.log(`[enrichment] Complete: ${success} success, ${failed} failed`);
  return { success, failed };
}

export type { ProductEnrichment };

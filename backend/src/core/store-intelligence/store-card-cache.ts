/**
 * Store Card Cache
 * 
 * Manages caching of Store Cards with 7-day TTL.
 * Uses Supabase for persistent storage.
 * 
 * SCHEMA TOLERANCE: This module works with BOTH cache schemas:
 * 1. Modern: store_id + card JSONB (migration schema)
 * 2. Structured: shop_id + store_name + brand_voice + ... (seed schema)
 */

import type { StoreCard, StoreCardCache } from './types';
import { supabaseAdmin } from '../../infra/supabase/client';

const CACHE_TABLE = 'store_cards';
const DEFAULT_TTL_DAYS = 7;

/**
 * Get Store Card from cache
 * Tolerates both modern (card JSONB) and structured (individual columns) schemas
 */
export async function getStoredStoreCard(storeId: string): Promise<StoreCard | null> {
  try {
    // Try modern cache schema first: store_id + card JSON
    let { data, error } = await supabaseAdmin
      .from(CACHE_TABLE)
      .select('store_id, card, expires_at')
      .eq('store_id', storeId)
      .single();

    if (error || !data || !('card' in data)) {
      // Fallback to structured schema (seeded)
      const { data: structured, error: e2 } = await supabaseAdmin
        .from(CACHE_TABLE)
        .select('shop_id, store_name, shop_domain, brand_voice, policies, merchandising, categories, faqs, ttl_days, updated_at')
        .eq('shop_id', storeId)
        .single();
      
      if (e2 || !structured) return null;
      
      // Recompose StoreCard object from structured columns
      const card: StoreCard = {
        store_id: structured.shop_id,
        store_name: structured.store_name || '',
        shop_domain: structured.shop_domain || '',
        brand_voice: structured.brand_voice ?? {},
        policies: structured.policies ?? {},
        merchandising: structured.merchandising ?? {},
        categories: {
          primary: Array.isArray(structured.categories) ? structured.categories : [],
          expertise_areas: [],
        },
        faqs: structured.faqs ?? [],
        support: { hours: '', channels: ['chat'], response_time: '' },
        merchandising_priorities: { 
          price_sensitivity: 'balanced', 
          quality_focus: 'balanced', 
          sustainability_focus: false 
        },
        product_sample: [],
        ttl_days: structured.ttl_days || DEFAULT_TTL_DAYS,
      };
      
      console.log(`Store Card loaded from structured schema for ${storeId}`);
      return card;
    }

    // Modern cache expiry check
    const expiresAt = data.expires_at ? new Date(data.expires_at) : null;
    if (expiresAt && expiresAt < new Date()) {
      console.log(`Store Card expired for ${storeId}`);
      return null;
    }

    console.log(`Store Card loaded from modern cache for ${storeId}`);
    return data.card as StoreCard;
  } catch (error) {
    console.error('Error fetching Store Card from cache:', error);
    return null;
  }
}

/**
 * Save Store Card to cache
 * Prefers modern cache JSON format; falls back to structured columns if needed
 */
export async function saveStoreCard(card: StoreCard): Promise<void> {
  try {
    const ttlDays = card.ttl_days || DEFAULT_TTL_DAYS;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000).toISOString();
    
    // Try modern cache JSON format first
    const upsertJson = await supabaseAdmin
      .from(CACHE_TABLE)
      .upsert({
        store_id: card.store_id,
        card,
        cached_at: new Date().toISOString(),
        expires_at: expiresAt,
      });
    
    // If column doesn't exist (error 42703), fall back to structured schema
    if (upsertJson.error?.code === '42703') {
      const { error: up2 } = await supabaseAdmin
        .from(CACHE_TABLE)
        .upsert({
          shop_id: card.store_id,
          store_name: card.store_name,
          shop_domain: card.shop_domain,
          brand_voice: card.brand_voice,
          policies: card.policies,
          merchandising: card.merchandising,
          categories: card.categories?.primary ?? [],
          faqs: card.faqs ?? [],
          version: 'v1',
          ttl_days: ttlDays,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'shop_id' as any });
      
      if (up2) throw up2;
      console.log(`Store Card saved to structured schema for ${card.store_id}`);
    } else if (upsertJson.error) {
      throw upsertJson.error;
    } else {
      console.log(`Store Card saved to modern cache for ${card.store_id} until ${expiresAt}`);
    }
  } catch (error) {
    console.error('Error in saveStoreCard:', error);
    throw error;
  }
}

/**
 * Invalidate Store Card cache
 * Works with both schemas
 */
export async function invalidateStoreCard(storeId: string): Promise<void> {
  try {
    // Try modern schema first
    const { error } = await supabaseAdmin
      .from(CACHE_TABLE)
      .delete()
      .eq('store_id', storeId);

    if (error?.code === '42703') {
      // Fallback to structured schema
      const { error: e2 } = await supabaseAdmin
        .from(CACHE_TABLE)
        .delete()
        .eq('shop_id', storeId);
      
      if (e2) throw e2;
    } else if (error) {
      throw error;
    }

    console.log(`Store Card invalidated for ${storeId}`);
  } catch (error) {
    console.error('Error in invalidateStoreCard:', error);
    throw error;
  }
}

/**
 * Get or generate Store Card (with caching)
 */
export async function getOrGenerateStoreCard(
  storeId: string,
  generator: () => Promise<StoreCard>
): Promise<StoreCard> {
  // Try cache first
  const cached = await getStoredStoreCard(storeId);
  if (cached) {
    console.log(`Store Card cache hit for ${storeId}`);
    return cached;
  }

  // Generate new card
  console.log(`Store Card cache miss for ${storeId}, generating...`);
  const card = await generator();

  // Save to cache
  await saveStoreCard(card);

  return card;
}

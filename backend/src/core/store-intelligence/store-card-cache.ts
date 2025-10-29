/**
 * Store Card Cache
 * 
 * Manages caching of Store Cards with 7-day TTL.
 * Uses Supabase for persistent storage.
 */

import type { StoreCard, StoreCardCache } from './types';
import { supabaseAdmin } from '../../infra/supabase/client';

const CACHE_TABLE = 'store_cards';
const DEFAULT_TTL_DAYS = 7;

/**
 * Get Store Card from cache
 */
export async function getStoredStoreCard(storeId: string): Promise<StoreCard | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from(CACHE_TABLE)
      .select('*')
      .eq('store_id', storeId)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      console.log(`Store Card expired for ${storeId}`);
      return null;
    }

    return data.card as StoreCard;
  } catch (error) {
    console.error('Error fetching Store Card from cache:', error);
    return null;
  }
}

/**
 * Save Store Card to cache
 */
export async function saveStoreCard(card: StoreCard): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + card.ttl_days * 24 * 60 * 60 * 1000);

  const cacheEntry: StoreCardCache = {
    store_id: card.store_id,
    card,
    cached_at: now.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  try {
    const { error } = await supabaseAdmin
      .from(CACHE_TABLE)
      .upsert(cacheEntry, {
        onConflict: 'store_id',
      });

    if (error) {
      console.error('Error saving Store Card to cache:', error);
      throw error;
    }

    console.log(`Store Card cached for ${card.store_id} until ${expiresAt.toISOString()}`);
  } catch (error) {
    console.error('Error in saveStoreCard:', error);
    throw error;
  }
}

/**
 * Invalidate Store Card cache
 */
export async function invalidateStoreCard(storeId: string): Promise<void> {
  try {
    const { error } = await supabaseAdmin
      .from(CACHE_TABLE)
      .delete()
      .eq('store_id', storeId);

    if (error) {
      console.error('Error invalidating Store Card:', error);
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

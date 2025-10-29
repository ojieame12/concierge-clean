/**
 * Store Card Service
 * 
 * High-level service for fetching/generating Store Cards
 * in the conversation pipeline.
 */

import type { StoreCard, StoreCardGenerationContext } from './types';
import { generateStoreCard } from './store-card-generator';
import { getOrGenerateStoreCard } from './store-card-cache';
import { supabaseAdmin } from '../../infra/supabase/client';

/**
 * Fetch Store Card for a shop
 * 
 * Checks cache first, generates if needed.
 */
export async function fetchStoreCard(shopId: string): Promise<StoreCard> {
  return getOrGenerateStoreCard(shopId, async () => {
    // Fetch store context from database
    const context = await fetchStoreContext(shopId);
    
    // Generate Store Card
    return generateStoreCard(context);
  });
}

/**
 * Fetch store context from database
 */
async function fetchStoreContext(shopId: string): Promise<StoreCardGenerationContext> {
  // Fetch brand profile
  const { data: brandData, error: brandError } = await supabaseAdmin
    .from('brand_profiles')
    .select('*')
    .eq('shop_id', shopId)
    .single();

  if (brandError) {
    console.warn(`No brand profile found for ${shopId}:`, brandError.message);
  }

  const brandProfile = brandData || null;

  // Fetch product sample (50 random products)
  const { data: products, error: productsError } = await supabaseAdmin
    .from('products')
    .select('id, title, vendor, product_type, price')
    .eq('shop_id', shopId)
    .limit(50);

  if (productsError) {
    console.error(`Error fetching products for ${shopId}:`, productsError);
    throw new Error('Failed to fetch product sample');
  }

  if (!products || products.length === 0) {
    throw new Error(`No products found for shop ${shopId}`);
  }

  // Extract store name and domain from brand profile or products
  const storeName = brandProfile?.store_name || brandProfile?.shop_domain || 'Store';
  const shopDomain = brandProfile?.shop_domain || shopId;

  return {
    store_id: shopId,
    store_name: storeName,
    shop_domain: shopDomain,
    brand_profile: brandProfile,
    product_sample: products.map(p => ({
      id: p.id,
      title: p.title,
      vendor: p.vendor || 'Unknown',
      product_type: p.product_type || 'General',
      price: p.price || 0,
    })),
  };
}

/**
 * Refresh Store Card (force regeneration)
 */
export async function refreshStoreCard(shopId: string): Promise<StoreCard> {
  const { invalidateStoreCard } = await import('./store-card-cache');
  
  // Invalidate cache
  await invalidateStoreCard(shopId);
  
  // Fetch fresh
  return fetchStoreCard(shopId);
}

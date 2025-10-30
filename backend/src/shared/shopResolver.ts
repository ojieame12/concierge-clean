/**
 * Centralized Shop Resolution
 * 
 * Provides a single source of truth for resolving shop context from various inputs.
 * Handles domain normalization, database lookup, and clear error messages.
 * 
 * Usage:
 * ```typescript
 * const shop = await resolveShop({ shop_domain: "run.local" }, supabase);
 * // Returns: { shop_id: "...", domain: "run.local", storeCard: {...} }
 * ```
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface ShopInput {
  shop?: string;
  shop_domain?: string;
  host?: string;
}

export interface ResolvedShop {
  shop_id: string;
  domain: string;
  storeCard?: any; // Store Card JSON
}

/**
 * Normalize domain for consistent lookup
 * - Lowercase
 * - Strip protocol (http://, https://)
 * - Strip www.
 * - Strip trailing slash
 */
export function normalizeDomain(domain: string | undefined): string | null {
  if (!domain) return null;

  let normalized = domain.toLowerCase().trim();

  // Strip protocol
  normalized = normalized.replace(/^https?:\/\//, '');

  // Strip www.
  normalized = normalized.replace(/^www\./, '');

  // Strip trailing slash
  normalized = normalized.replace(/\/$/, '');

  return normalized || null;
}

/**
 * Resolve shop from various input formats
 * 
 * Tries multiple candidate domains and provides clear error messages
 * if shop cannot be found.
 */
export async function resolveShop(
  input: ShopInput,
  supabase: SupabaseClient
): Promise<ResolvedShop> {
  // Generate candidate domains
  const candidates = [
    input.shop,
    input.shop_domain,
    input.host,
  ]
    .filter(Boolean)
    .map(normalizeDomain)
    .filter(Boolean) as string[];

  if (candidates.length === 0) {
    throw new Error(
      'Shop resolution failed: No shop identifier provided. ' +
      'Please provide one of: shop, shop_domain, or host.'
    );
  }

  // Query database for matching shop
  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, domain, store_card')
    .in('domain', candidates);

  if (error) {
    throw new Error(`Shop resolution database error: ${error.message}`);
  }

  if (!shops || shops.length === 0) {
    // Fetch available shops for helpful error message
    const { data: availableShops } = await supabase
      .from('shops')
      .select('domain')
      .limit(10);

    const availableDomains = availableShops?.map((s) => s.domain) || [];

    throw new Error(
      `Shop not found. Tried: ${candidates.join(', ')}. ` +
      `Available shops: ${availableDomains.join(', ') || 'none'}. ` +
      `Make sure the shop is seeded in the database.`
    );
  }

  // If multiple matches, prefer exact match, then first seeded test shop
  let selectedShop = shops[0];

  if (shops.length > 1) {
    // Prefer exact match
    const exactMatch = shops.find((s) =>
      candidates.includes(normalizeDomain(s.domain))
    );
    if (exactMatch) {
      selectedShop = exactMatch;
    }
  }

  return {
    shop_id: selectedShop.id,
    domain: selectedShop.domain,
    storeCard: selectedShop.store_card,
  };
}

/**
 * Resolve shop ID only (lighter query)
 */
export async function resolveShopId(
  input: ShopInput,
  supabase: SupabaseClient
): Promise<string> {
  const shop = await resolveShop(input, supabase);
  return shop.shop_id;
}

/**
 * Validate shop exists (for test setup)
 */
export async function validateShopExists(
  domain: string,
  supabase: SupabaseClient
): Promise<boolean> {
  const normalized = normalizeDomain(domain);
  if (!normalized) return false;

  const { data, error } = await supabase
    .from('shops')
    .select('id')
    .eq('domain', normalized)
    .single();

  return !error && !!data;
}

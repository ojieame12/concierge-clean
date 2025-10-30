import type { Theme } from '@insite/shared-types';
import { supabaseAdmin } from '../../infra/supabase/client';
import { DEFAULT_THEME } from './defaults';

/**
 * Theme Storage - Persist merchant themes
 * 
 * Stores themes in the shops table as JSONB.
 * Provides caching for performance.
 */

// In-memory cache for themes (TTL: 5 minutes)
const themeCache = new Map<string, { theme: Theme; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get theme for a shop
 * Returns null if no custom theme exists
 */
export async function getThemeForShop(shopId: string): Promise<Theme | null> {
  // Check cache first
  const cached = themeCache.get(shopId);
  if (cached && cached.expires > Date.now()) {
    return cached.theme;
  }

  try {
    // Fetch from database
    const { data: shop, error } = await supabaseAdmin
      .from('shops')
      .select('theme')
      .eq('id', shopId)
      .single();

    if (error) {
      console.error('Error fetching theme:', error);
      return null;
    }

    if (!shop || !shop.theme) {
      return null;
    }

    // Parse theme
    const theme = typeof shop.theme === 'string' 
      ? JSON.parse(shop.theme) 
      : shop.theme;

    // Cache it
    themeCache.set(shopId, {
      theme,
      expires: Date.now() + CACHE_TTL
    });

    return theme;
    
  } catch (error) {
    console.error('Error getting theme:', error);
    return null;
  }
}

/**
 * Save theme for a shop
 */
export async function saveThemeForShop(shopId: string, theme: Theme): Promise<void> {
  try {
    // Save to database
    const { error } = await supabaseAdmin
      .from('shops')
      .update({ theme: theme as any })
      .eq('id', shopId);

    if (error) {
      throw new Error(`Failed to save theme: ${error.message}`);
    }

    // Update cache
    themeCache.set(shopId, {
      theme,
      expires: Date.now() + CACHE_TTL
    });
    
  } catch (error) {
    console.error('Error saving theme:', error);
    throw error;
  }
}

/**
 * Clear theme cache for a shop
 */
export function clearThemeCache(shopId?: string): void {
  if (shopId) {
    themeCache.delete(shopId);
  } else {
    themeCache.clear();
  }
}

/**
 * Get theme with fallback to default
 */
export async function getThemeOrDefault(shopId: string): Promise<Theme> {
  const theme = await getThemeForShop(shopId);
  return theme || DEFAULT_THEME;
}

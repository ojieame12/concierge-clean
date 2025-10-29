import express from 'express';

import { supabaseAdmin } from '../infra/supabase/client';
import { shopify } from '../shopify';
import { syncThemeForShop } from '../jobs/sync-theme';

const router = express.Router();

const FALLBACK_THEME = {
  palette: {
    primary: '#4a5cff',
    secondary: '#7b5cff',
    background: '#f8f9fe',
    surface: '#ffffff',
    text: '#0f172a',
  },
  typography: {
    headingFont: 'Inter',
    bodyFont: 'Inter',
  },
};

const FALLBACK_BRAND = {
  brand_name: 'AI Store Concierge',
  brandName: 'AI Store Concierge',
  mission: "Personalized shopping guidance tailored to your brand's voice.",
  sample_prompts: [
    'Show me popular picks',
    "What’s new this week?",
    'Help me compare a couple of options',
  ],
};

router.get('/', async (req, res) => {
  const shopParam = req.query.shop?.toString();
  const force = req.query.force === 'true';

  if (!shopParam) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  const sanitized = shopify.utils.sanitizeShop(shopParam);

  if (!sanitized) {
    res.status(400).json({ error: 'Invalid shop parameter' });
    return;
  }

  const { data: shop, error } = await supabaseAdmin
    .from('shops')
    .select('theme_config, theme_last_synced_at, brand_profile')
    .eq('shop_domain', sanitized)
    .single();

  if (error) {
    console.warn('Theme lookup failed; using fallback theme', error);
    res.json({ theme: FALLBACK_THEME, brandProfile: FALLBACK_BRAND, source: 'fallback' });
    return;
  }

  if (!shop?.theme_config || force) {
    try {
      const theme = await syncThemeForShop(sanitized);
      res.json({ theme, brandProfile: shop?.brand_profile ?? FALLBACK_BRAND, source: 'synced' });
      return;
    } catch (syncError) {
      console.warn('Theme sync failed; using fallback theme', syncError);
      res.json({ theme: FALLBACK_THEME, brandProfile: FALLBACK_BRAND, source: 'fallback' });
      return;
    }
  }

  const responsePayload = {
    theme: shop.theme_config ?? FALLBACK_THEME,
    brandProfile: shop.brand_profile ?? FALLBACK_BRAND,
    syncedAt: shop.theme_last_synced_at,
    source: 'cache' as const,
  };

  res.json(responsePayload);
});

export const themeRouter = router;

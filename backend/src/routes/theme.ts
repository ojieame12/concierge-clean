import express from 'express';

import { supabaseAdmin } from '../infra/supabase/client';

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
    "What's new this week?",
    'Help me compare a couple of options',
  ],
};

router.get('/', async (req, res) => {
  const shopParam = req.query.shop?.toString();

  if (!shopParam) {
    res.status(400).json({ error: 'Missing shop parameter' });
    return;
  }

  // Simple sanitization - just trim and lowercase
  const sanitized = shopParam.trim().toLowerCase();

  if (!sanitized) {
    res.status(400).json({ error: 'Invalid shop parameter' });
    return;
  }

  const { data: shop, error } = await supabaseAdmin
    .from('shops')
    .select('*')
    .eq('shop_domain', sanitized)
    .maybeSingle();

  if (error) {
    console.error('[theme] Database error:', error);
    res.status(500).json({ error: 'Failed to fetch shop data' });
    return;
  }

  if (!shop) {
    // Return fallback for unknown shops
    res.json({
      theme: FALLBACK_THEME,
      brandProfile: FALLBACK_BRAND,
    });
    return;
  }

  const brandProfile = shop.brand_profile || FALLBACK_BRAND;
  const theme = shop.theme || FALLBACK_THEME;

  res.json({
    theme,
    brandProfile,
  });
});

export default router;

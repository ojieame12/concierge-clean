import express from 'express';
import { z } from 'zod';

import { supabaseAdmin } from '../infra/supabase/client';
import { requireClientKey } from '../middleware/require-client-key';

const router = express.Router();

router.use(requireClientKey);

const userEventSchema = z.object({
  type: z.enum([
    'compare_start',
    'compare_execute',
    'selection_change',
    'add_to_cart',
    'capsule_select',
  ]),
  data: z.record(z.any()).optional(),
});

const eventRequestSchema = z.object({
  shopDomain: z.string().trim().min(3).max(255),
  sessionId: z.string().trim().min(1).max(255),
  event: userEventSchema,
});

router.post('/', async (req, res) => {
  const parsed = eventRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: 'Invalid request payload',
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { shopDomain, sessionId, event } = parsed.data;

  try {
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id')
      .eq('shop_domain', shopDomain)
      .single();

    if (shopError || !shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    await supabaseAdmin.from('conversation_events').insert({
      shop_id: shop.id,
      session_id: sessionId,
      event_type: 'user_action',
      payload: {
        type: event.type,
        data: event.data ?? null,
      },
    });

    res.status(200).json({ status: 'ok' });
  } catch (error) {
    console.error('Failed to record conversation event', error);
    res.status(500).json({ error: 'Failed to record event' });
  }
});

export const eventsRouter = router;

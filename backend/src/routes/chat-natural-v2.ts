/**
 * Natural Chat V2 Route (Gemini-Orchestrated)
 * 
 * This route uses the orchestrator where Gemini controls the conversation.
 * NO rigid routing. NO pattern matching. Gemini decides everything.
 * 
 * Enable with: NATURAL_V2=true in .env
 * Endpoint: POST /api/chat-natural-v2
 */

import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin } from '../infra/supabase/client';
import { generateEmbedding } from '../infra/llm/gemini';
import { requireClientKey } from '../middleware/require-client-key';
import { runTurn } from '../core/conversation/orchestrator';
import { createTools } from '../core/conversation/tools';
import type { ConversationMessage } from '../core/conversation/types';

const router = Router();

// Request schema
const ChatRequestSchema = z.object({
  shopDomain: z.string(),
  sessionId: z.string().optional(),
  messages: z.array(z.object({
    id: z.string().optional(),
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    createdAt: z.string().optional(),
  })),
});

router.post('/', requireClientKey, async (req, res) => {
  try {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error });
    }

    const { shopDomain, messages: incomingMessages } = parsed.data;

    // Get shop
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, shop_domain, brand_profile')
      .eq('shop_domain', shopDomain)
      .single();

    if (shopError || !shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    // Convert messages
    const messages: ConversationMessage[] = incomingMessages.map((msg, index) => ({
      id: msg.id || `${msg.role}_${index}`,
      role: msg.role,
      content: msg.content.trim(),
      createdAt: msg.createdAt || new Date().toISOString(),
    }));

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    // Create tools
    const tools = createTools(supabaseAdmin, generateEmbedding, shop.id);

    // Fetch store card
    let storeCard: any = null;
    try {
      const { fetchStoreCard } = await import('../core/store-intelligence');
      storeCard = await fetchStoreCard(shop.id);
    } catch (error) {
      console.warn('Failed to fetch store card:', error);
    }

    // Run orchestrator
    const output = await runTurn(
      {
        shopId: shop.id,
        sessionId: parsed.data.sessionId || `session_${Date.now()}`,
        messages: messages.slice(0, -1), // Exclude last message (it's passed separately)
        storeCard,
        brandProfile: shop.brand_profile,
      },
      lastMessage.content,
      tools
    );

    // Convert to streaming response format
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream message
    res.write(`data: ${JSON.stringify({ 
      type: 'segment', 
      segment: { type: 'narrative', text: output.message }
    })}\n\n`);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Stream products if any
    if (output.products && output.products.length > 0) {
      for (const product of output.products) {
        res.write(`data: ${JSON.stringify({
          type: 'segment',
          segment: {
            type: 'product_card',
            product_id: product.id,
            reasons: product.why,
          }
        })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Stream clarifier if any
    if (output.clarifier) {
      res.write(`data: ${JSON.stringify({
        type: 'segment',
        segment: {
          type: 'clarifier',
          question: output.clarifier.question,
          options: output.clarifier.options || [],
        }
      })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Done
    res.write(`data: ${JSON.stringify({
      type: 'done',
      metadata: {
        mode: output.mode,
        actions: output.actions,
        tone: 'warm',
        layout_hints: { mode: output.mode === 'recommend' ? 'grid' : 'dialogue' },
      }
    })}\n\n`);

    res.end();

  } catch (error) {
    console.error('Chat natural v2 error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
      res.end();
    }
  }
});

export const chatNaturalV2Router = router;

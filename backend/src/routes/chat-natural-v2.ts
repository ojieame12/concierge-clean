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
    console.log('[DEBUG] Looking up shop:', shopDomain);
    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, shop_domain, brand_profile')
      .eq('shop_domain', shopDomain)
      .single();

    console.log('[DEBUG] Shop lookup result:', { shop, shopError });
    if (shopError || !shop) {
      return res.status(404).json({ error: 'Shop not found', details: shopError?.message });
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

    // Stream mainLead and actionDetail (or fallback to message)
    if (output.mainLead && output.actionDetail) {
      res.write(`data: ${JSON.stringify({ 
        type: 'segment', 
        segment: { type: 'narrative', text: output.mainLead }
      })}\n\n`);
      
      await new Promise(resolve => setTimeout(resolve, 50));
      
      res.write(`data: ${JSON.stringify({ 
        type: 'segment', 
        segment: { type: 'narrative', text: output.actionDetail }
      })}\n\n`);
    } else if (output.message) {
      // Legacy fallback
      res.write(`data: ${JSON.stringify({ 
        type: 'segment', 
        segment: { type: 'narrative', text: output.message }
      })}\n\n`);
    }

    await new Promise(resolve => setTimeout(resolve, 50));

    // Stream products if any
    if (output.products && output.products.length > 0) {
      // Fetch full product details
      const productIds = output.products.map(p => p.id);
      const { data: products } = await supabaseAdmin
        .from('products')
        .select(`
          id,
          title,
          description,
          vendor,
          image_url,
          product_variants (
            id,
            title,
            price,
            compare_at_price,
            available
          )
        `)
        .in('id', productIds);

      if (products && products.length > 0) {
        const items = products.map((p, idx) => {
          const variant = p.product_variants?.[0];
          const whyChips = output.products.find(op => op.id === p.id)?.why || [];
          
          return {
            id: p.id,
            title: p.title,
            price: variant?.price || 0,
            currency: 'USD',
            image: p.image_url,
            vendor: p.vendor,
            why_chips: whyChips,
            top_pick: idx === 0, // First product is top pick
          };
        });

        res.write(`data: ${JSON.stringify({
          type: 'segment',
          segment: {
            type: 'products',
            items,
            layout: 'default',
          }
        })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Stream clarifier if any
    if (output.clarifier) {
      // Add clarifier as narrative + options
      res.write(`data: ${JSON.stringify({
        type: 'segment',
        segment: {
          type: 'ask',
          text: output.clarifier.question,
        }
      })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 50));

      if (output.clarifier.options && output.clarifier.options.length > 0) {
        const items = output.clarifier.options.map((opt, idx) => ({
          id: `opt_${idx}`,
          label: opt,
          value: opt,
        }));

        res.write(`data: ${JSON.stringify({
          type: 'segment',
          segment: {
            type: 'options',
            style: 'quick_replies',
            items,
          }
        })}\n\n`);
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    // Done - include structured format in metadata
    res.write(`data: ${JSON.stringify({
      type: 'done',
      mainLead: output.mainLead,
      actionDetail: output.actionDetail,
      clarifier: output.clarifier,
      products: output.products,
      cta: output.cta,
      metadata: {
        mode: output.mode,
        actions: output.actions,
        tone: 'warm',
        layout_hints: { mode: output.mode === 'recommend' ? 'grid' : 'dialogue' },
        ...output.meta,
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

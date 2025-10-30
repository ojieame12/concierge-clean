/**
 * Natural Chat Route
 * 
 * Parallel implementation of the chat endpoint using the natural conversation pipeline.
 * This allows us to test and compare the natural approach side-by-side with the current pipeline.
 * 
 * Endpoint: POST /api/chat-natural
 */

import { randomUUID } from 'crypto';
import express from 'express';
import { z } from 'zod';

import { generateEmbedding } from '../infra/llm/gemini';
import { repairAndValidateChatTurn } from '../core/conversation/schemas';
import { supabaseAdmin } from '../infra/supabase/client';
import { getOrCreateSession, updateSessionMetadata } from '../core/session/session-store';
import { runNaturalPipeline } from '../core/conversation/pipeline-natural';
import type { ConversationMessage } from '../types/conversation';
import { config } from '../config';
import { resolveShop } from '../shared/shopResolver';

const router = express.Router();

const messageSchema = z.object({
  id: z.string().trim().max(128).optional(),
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().trim().min(1).max(config.chat.maxMessageLength),
  createdAt: z.string().optional(),
});

const chatRequestSchema = z.object({
  messages: z.array(messageSchema).min(1).max(config.chat.maxMessages),
  shopDomain: z.string().trim().min(3).max(255),
  sessionId: z.string().trim().max(config.chat.sessionIdMaxLength).optional(),
  conversationId: z.string().trim().max(128).optional(),
});

router.post('/', async (req, res) => {
  try {
    const parsed = chatRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid request payload',
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const { shopDomain, sessionId: incomingSessionId } = parsed.data;

    const incomingMessages = parsed.data.messages.map((message, index) => {
      const createdAtIso = (() => {
        if (message.createdAt) {
          const parsedDate = Date.parse(message.createdAt);
          if (!Number.isNaN(parsedDate)) {
            return new Date(parsedDate).toISOString();
          }
        }
        return new Date().toISOString();
      })();

      const content = message.content.trim();

      const id =
        message.id && message.id.trim().length
          ? message.id.trim()
          : `${message.role}_${index}_${randomUUID()}`;

      return {
        id,
        role: message.role,
        content,
        createdAt: createdAtIso,
      } satisfies ConversationMessage;
    });

    const totalChars = incomingMessages.reduce((sum, message) => sum + message.content.length, 0);
    if (totalChars > config.chat.maxTotalChars) {
      return res.status(400).json({ error: 'Conversation too long, please start a new session.' });
    }

    if (!incomingMessages.some((message) => message.role === 'user')) {
      return res.status(400).json({ error: 'At least one user message is required.' });
    }

    const messages: ConversationMessage[] = incomingMessages;

    // Resolve shop using centralized resolver
    let shop;
    try {
      const resolvedShop = await resolveShop(
        { shop_domain: shopDomain },
        supabaseAdmin
      );

      // Fetch brand profile
      const { data: shopData, error: shopError } = await supabaseAdmin
        .from('shops')
        .select('id, shop_domain, brand_profile')
        .eq('id', resolvedShop.shop_id)
        .single();

      if (shopError || !shopData) {
        return res.status(404).json({ error: 'Shop not found' });
      }

      shop = shopData;
    } catch (error: any) {
      console.error('[Natural Chat] Shop resolution failed:', error.message);
      return res.status(404).json({ 
        error: 'Shop not found',
        details: error.message 
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    const slugFromSeed = (seed: string) =>
      seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 12) || 'session';
    const fallbackSeed = messages.find((msg) => msg.role === 'user')?.content ?? `${Date.now()}`;
    const fallbackKey = `${shop.id}-sess-natural-${slugFromSeed(fallbackSeed)}`;
    const sessionKey =
      typeof incomingSessionId === 'string' && incomingSessionId.trim().length
        ? incomingSessionId.trim()
        : fallbackKey;

    const sessionRecord = await getOrCreateSession(shop.id, sessionKey);
    const sessionMetadata = sessionRecord.metadata;

    console.log('[Natural Chat] Processing request:', {
      shopId: shop.id,
      sessionKey,
      messageCount: messages.length,
      lastMessage: lastMessage.content.slice(0, 50),
    });

    // Run natural pipeline
    const pipelineResult = await runNaturalPipeline(
      {
        shopId: shop.id,
        sessionId: sessionKey,
        messages,
        sessionMetadata,
        brandProfile: shop.brand_profile,
      },
      {
        supabaseAdmin,
        generateEmbedding,
      }
    );

    console.log('[Natural Chat] Pipeline result:', {
      segmentCount: pipelineResult.pepTurn.segments.length,
      conversationTurn: pipelineResult.conversationTurn,
    });

    // Update session metadata
    try {
      await updateSessionMetadata(
        sessionRecord.id,
        {
          accumulatedIntent: pipelineResult.accumulatedIntent,
          turnCount: pipelineResult.conversationTurn,
        },
        shop.id,
        sessionKey
      );
    } catch (sessionError) {
      console.warn('[Natural Chat] Failed to persist session metadata:', sessionError);
    }

    // Validate pipeline result with Zod schema
    let validatedTurn;
    try {
      validatedTurn = repairAndValidateChatTurn({
        segments: pipelineResult.pepTurn.segments,
        metadata: {
          ...(pipelineResult.pepTurn.metadata ?? {}),
          session_key: sessionKey,
          conversation_turn: pipelineResult.conversationTurn,
        },
      });
      console.log('[Natural Chat] Validation successful');
    } catch (validationError) {
      console.error('[Natural Chat] Validation failed:', validationError);
      validatedTurn = {
        segments: pipelineResult.pepTurn.segments,
        metadata: {
          session_key: sessionKey,
          validation_message: 'Schema validation failed, returning unvalidated response',
        },
      };
    }

    return res.status(200).json(validatedTurn);
  } catch (error) {
    console.error('[Natural Chat] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

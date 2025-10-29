import { randomUUID } from 'node:crypto';

import express from 'express';
import { z } from 'zod';

import { generateEmbedding } from '../infra/llm/gemini';
import { repairAndValidateChatTurn, safeParseChatTurn } from '../core/conversation/schemas';
import { supabaseAdmin } from '../infra/supabase/client';
import { getOrCreateSession, updateSessionMetadata } from '../core/session/session-store';
import { runConversationPipeline } from '../core/conversation/pipeline';
import type { ConversationMessage } from '../types/conversation';
import type { ToneStyle } from '@insite/shared-types';
import { config } from '../config';

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

      const id = message.id && message.id.trim().length
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

    const { data: shop, error: shopError } = await supabaseAdmin
      .from('shops')
      .select('id, shop_domain, brand_profile')
      .eq('shop_domain', shopDomain)
      .single();

    if (shopError || !shop) {
      return res.status(404).json({ error: 'Shop not found' });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user') {
      return res.status(400).json({ error: 'Last message must be from user' });
    }

    const slugFromSeed = (seed: string) => seed.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 12) || 'session';
    const fallbackSeed = messages.find((msg) => msg.role === 'user')?.content ?? `${Date.now()}`;
    const fallbackKey = `${shop.id}-sess-${slugFromSeed(fallbackSeed)}`;
    const sessionKey = typeof incomingSessionId === 'string' && incomingSessionId.trim().length
      ? incomingSessionId.trim()
      : fallbackKey;

    const sessionRecord = await getOrCreateSession(shop.id, sessionKey);
    const sessionMetadata = sessionRecord.metadata;

    const pipelineResult = await runConversationPipeline(
      {
        supabaseAdmin,
        generateEmbedding,
      },
      {
        shopId: shop.id,
        sessionId: sessionKey,
        messages,
        sessionMetadata,
        brandProfile: shop.brand_profile,
      }
    );

    try {
      await updateSessionMetadata(
        sessionRecord.id,
        {
          askedSlots: pipelineResult.askedSlot ? [pipelineResult.askedSlot] : undefined,
          clarifierHistory: pipelineResult.clarifierHistoryPatch,
          zeroResultStreak: pipelineResult.zeroResultStreakNext,
          turnCount: pipelineResult.metrics.turnCount,
          lastTone: (() => {
            const toneCandidate = pipelineResult.pepTurn.metadata?.tone;
            const allowed: ToneStyle[] = ['warm', 'neutral', 'concise', 'empathetic_urgent'];
            return typeof toneCandidate === 'string' && allowed.includes(toneCandidate as ToneStyle)
              ? (toneCandidate as ToneStyle)
              : undefined;
          })(),
          accumulatedIntent: pipelineResult.accumulatedIntent,  // ⭐ Save intent
          activeFilters: pipelineResult.activeFilters,          // ⭐ Save filters
          pendingClarifier: pipelineResult.pendingClarifier,   // ⭐ Save pending question
          manualClarifier: pipelineResult.manualClarifier,
          negotiationState: pipelineResult.negotiationState,
          factSheetCache: pipelineResult.factSheetCache,
          dialogueSummary: pipelineResult.dialogueSummary ?? undefined,
          sentiment: pipelineResult.sentiment ?? undefined,
        },
        shop.id,
        sessionKey
      );
    } catch (sessionError) {
      console.warn('Failed to persist session metadata', sessionError);
    }

    try {
      const eventRows: Array<{ shop_id: string; session_id: string; event_type: string; payload: any }> = [];

      if (pipelineResult.relaxationSteps.length) {
        eventRows.push({
          shop_id: shop.id,
          session_id: sessionKey,
          event_type: 'relaxation_applied',
          payload: { steps: pipelineResult.relaxationSteps },
        });
      }

      if (pipelineResult.offersPresented.length) {
        eventRows.push({
          shop_id: shop.id,
          session_id: sessionKey,
          event_type: 'offer_presented',
          payload: { offers: pipelineResult.offersPresented },
        });
      }

      if (pipelineResult.negotiationState) {
        eventRows.push({
          shop_id: shop.id,
          session_id: sessionKey,
          event_type: 'negotiation_state',
          payload: pipelineResult.negotiationState,
        });
      }

      if (eventRows.length) {
        await supabaseAdmin.from('conversation_events').insert(eventRows);
      }
    } catch (eventError) {
      console.warn('Failed to persist conversation events', eventError);
    }

    // Validate pipeline result with Zod schema
    let validatedTurn;
    try {
      validatedTurn = repairAndValidateChatTurn({
        segments: pipelineResult.pepTurn.segments,
        metadata: {
          ...(pipelineResult.pepTurn.metadata ?? {}),
          session_key: sessionKey,
          rapport_mode: pipelineResult.rapportMode,
          info_mode: pipelineResult.pepTurn.metadata?.info_mode ?? undefined,
          zero_result_streak: pipelineResult.zeroResultStreakNext,
          relaxation_steps: pipelineResult.relaxationSteps,
          offers_presented: pipelineResult.offersPresented,
          negotiation_state: pipelineResult.negotiationState,
          fact_sheets: pipelineResult.factSheets?.slice(0, 3),
          layout_hints: pipelineResult.uiHints ?? (pipelineResult.pepTurn.metadata as any)?.ui_hints ?? null,
          manual_clarifier: pipelineResult.manualClarifier ?? null,
          pending_clarifier: pipelineResult.pendingClarifier ?? null,
        }
      });
    } catch (validationError) {
      console.error('Response validation failed:', validationError);
      // Fallback to safe response
      validatedTurn = {
        segments: [{
          type: 'narrative' as const,
          text: 'I apologize, but I encountered an issue processing your request. Could you please rephrase?'
        }],
        metadata: {
          session_key: sessionKey,
          validation_message: 'Response validation failed'
        }
      };
    }

    const doneMetadata = validatedTurn.metadata ?? {};

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream validated segments
    for (const segment of validatedTurn.segments) {
      res.write(`data: ${JSON.stringify({ type: 'segment', segment })}\n\n`);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    res.write(`data: ${JSON.stringify({ type: 'done', metadata: doneMetadata })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);

    if (!res.headersSent) {
      res.status(500).json({ error: 'Chat failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
      res.end();
    }
  }
});

export const chatRouter = router;

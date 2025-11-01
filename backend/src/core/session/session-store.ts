import { randomUUID } from 'node:crypto';

import { supabaseAdmin } from '../../infra/supabase/client';
import type { ToneStyle } from '../conversation/phrase-bank';
import type { AccumulatedIntent } from '../conversation/intent-extractor';
import type { ProductFactSheet } from '../conversation/tools/product-facts';

export type ClarifierOption = {
  label: string;
  value: string;
};

export type FactSheetCache = {
  productIds: string[];
  facts: ProductFactSheet[];
  fetchedAt: string;
};

export type SessionMetadata = {
  askedSlots: string[];
  clarifierHistory: Record<string, number>;
  zeroResultStreak: number;
  turnCount: number;
  lastTone?: ToneStyle;
  activeFilters: Record<string, string>;
  pendingClarifier?: {
    facet: string;
    options: ClarifierOption[];
  } | null;
  manualClarifier?: {
    facet: string;
  } | null;
  negotiationState?: {
    productId?: string;
    stage: 'anchor' | 'sweetener' | 'discount';
    concessionIndex: number;
  } | null;
  accumulatedIntent?: AccumulatedIntent;
  rejectedProductIds?: string[];
  acceptedProductIds?: string[];
  factSheetCache?: FactSheetCache | null;
  dialogueSummary?: string | null;
  sentiment?: 'positive' | 'neutral' | 'concerned' | null;
  openerHistory?: string[];
  answeredClarifierFacets?: string[];
};

type MemorySession = {
  id: string;
  metadata: SessionMetadata;
};

const DEFAULT_METADATA: SessionMetadata = {
  askedSlots: [],
  clarifierHistory: {},
  zeroResultStreak: 0,
  turnCount: 0,
  lastTone: 'neutral',
  activeFilters: {},
  pendingClarifier: null,
  manualClarifier: null,
  negotiationState: null,
  accumulatedIntent: {},
  rejectedProductIds: [],
  acceptedProductIds: [],
  factSheetCache: null,
  dialogueSummary: null,
  sentiment: null,
  openerHistory: [],
  answeredClarifierFacets: [],
};

const memorySessions = new Map<string, MemorySession>();

const sessionKeyFor = (shopId: string, sessionKey: string) => `${shopId}:${sessionKey}`;

const mergeAskedSlots = (current: string[], next: string[]) => {
  const seen = new Set(current);
  for (const value of next) {
    if (!seen.has(value)) {
      seen.add(value);
      current.push(value);
    }
  }
  return current;
};

const shouldFallbackToMemory = (error: { code?: string } | null | undefined) =>
  Boolean(error) && (error!.code === '42P01' || error!.code === '42703' || error!.code === 'PGRST116');

const getMemorySession = (shopId: string, sessionKey: string) => {
  const key = sessionKeyFor(shopId, sessionKey);
  let session = memorySessions.get(key);
  if (!session) {
    session = { id: randomUUID(), metadata: { ...DEFAULT_METADATA } };
    memorySessions.set(key, session);
  }
  return session;
};

export async function getOrCreateSession(shopId: string, sessionKey: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_sessions')
      .select('id, metadata')
      .eq('shop_id', shopId)
      .eq('session_key', sessionKey)
      .limit(1)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      if (shouldFallbackToMemory(error)) {
        return getMemorySession(shopId, sessionKey);
      }
      throw error;
    }

    if (data) {
      const metadata = { ...DEFAULT_METADATA, ...(data.metadata as SessionMetadata | null ?? {}) };
      return {
        id: data.id,
        metadata,
      };
    }

    const insertPayload = {
      shop_id: shopId,
      session_key: sessionKey,
      metadata: DEFAULT_METADATA,
    };

    const { data: inserted, error: insertError } = await supabaseAdmin
      .from('conversation_sessions')
      .insert(insertPayload)
      .select('id, metadata')
      .single();

    if (insertError) {
      if (shouldFallbackToMemory(insertError)) {
        return getMemorySession(shopId, sessionKey);
      }
      throw insertError;
    }

    return {
      id: inserted.id,
      metadata: { ...DEFAULT_METADATA, ...(inserted.metadata as SessionMetadata | null ?? {}) },
    };
  } catch (error) {
    if (shouldFallbackToMemory(error as { code?: string })) {
      return getMemorySession(shopId, sessionKey);
    }
    throw error;
  }
}

export async function updateSessionMetadata(
  sessionId: string,
  patch: Partial<SessionMetadata>,
  shopId?: string,
  sessionKey?: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from('conversation_sessions')
      .select('metadata')
      .eq('id', sessionId)
      .single();

    if (error) {
      if (shouldFallbackToMemory(error) && shopId && sessionKey) {
        const session = getMemorySession(shopId, sessionKey);
        const next = mergeMetadata(session.metadata, patch);
        session.metadata = next;
        memorySessions.set(sessionKeyFor(shopId, sessionKey), session);
        return next;
      }
      throw error;
    }

    const current = { ...DEFAULT_METADATA, ...(data.metadata as SessionMetadata | null ?? {}) };
    const next = mergeMetadata(current, patch);

    await supabaseAdmin
      .from('conversation_sessions')
      .update({
        metadata: next,
        last_event_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    return next;
  } catch (error) {
    if (shouldFallbackToMemory(error as { code?: string }) && shopId && sessionKey) {
      const session = getMemorySession(shopId, sessionKey);
      const next = mergeMetadata(session.metadata, patch);
      session.metadata = next;
      memorySessions.set(sessionKeyFor(shopId, sessionKey), session);
      return next;
    }
    throw error;
  }
}

const mergeMetadata = (current: SessionMetadata, patch: Partial<SessionMetadata>): SessionMetadata => {
  const next: SessionMetadata = {
    ...current,
    ...patch,
    clarifierHistory: {
      ...current.clarifierHistory,
      ...(patch.clarifierHistory ?? {}),
    },
    askedSlots: mergeAskedSlots([...current.askedSlots], patch.askedSlots ?? []),
    lastTone: patch.lastTone ?? current.lastTone,
    zeroResultStreak:
      typeof patch.zeroResultStreak === 'number' ? patch.zeroResultStreak : current.zeroResultStreak,
    turnCount: typeof patch.turnCount === 'number' ? patch.turnCount : current.turnCount,
    activeFilters: patch.activeFilters ?? current.activeFilters,
    pendingClarifier:
      Object.prototype.hasOwnProperty.call(patch, 'pendingClarifier')
        ? patch.pendingClarifier ?? null
        : current.pendingClarifier ?? null,
    manualClarifier:
      Object.prototype.hasOwnProperty.call(patch, 'manualClarifier')
        ? patch.manualClarifier ?? null
        : current.manualClarifier ?? null,
    negotiationState:
      Object.prototype.hasOwnProperty.call(patch, 'negotiationState')
        ? patch.negotiationState ?? null
        : current.negotiationState ?? null,
    accumulatedIntent: patch.accumulatedIntent ?? current.accumulatedIntent,
    rejectedProductIds: patch.rejectedProductIds ?? current.rejectedProductIds,
    acceptedProductIds: patch.acceptedProductIds ?? current.acceptedProductIds,
    factSheetCache: Object.prototype.hasOwnProperty.call(patch, 'factSheetCache')
      ? patch.factSheetCache ?? null
      : current.factSheetCache ?? null,
    dialogueSummary: Object.prototype.hasOwnProperty.call(patch, 'dialogueSummary')
      ? patch.dialogueSummary ?? null
      : current.dialogueSummary ?? null,
    sentiment: Object.prototype.hasOwnProperty.call(patch, 'sentiment')
      ? patch.sentiment ?? null
      : current.sentiment ?? null,
  };

  return next;
};

export function calculateRepeatedClarifiers(history: Record<string, number>): number {
  return Object.values(history).filter((count) => count > 1).length;
}

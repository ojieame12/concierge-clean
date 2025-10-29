import { supabaseAdmin } from '../../infra/supabase/client';

export const logShadowFactUsage = async (
  shopId: string,
  sessionId: string,
  payload: Record<string, unknown>
) => {
  try {
    await supabaseAdmin.from('conversation_events').insert({
      shop_id: shopId,
      session_id: sessionId,
      event_type: 'shadow_fact_sheet',
      payload,
    });
  } catch (error) {
    console.warn('[shadow-log] failed to record fact sheet usage', (error as Error).message);
  }
};

export const logKnowledgeTurnMetrics = async (
  shopId: string,
  sessionId: string,
  payload: Record<string, unknown>
) => {
  try {
    await supabaseAdmin.from('conversation_events').insert({
      shop_id: shopId,
      session_id: sessionId,
      event_type: 'knowledge_turn',
      payload,
      reason: payload.reason ?? null,
      message_id: typeof payload.message_id === 'string' ? payload.message_id : null,
    });
  } catch (error) {
    console.warn('[shadow-log] failed to record knowledge metrics', (error as Error).message);
  }
};

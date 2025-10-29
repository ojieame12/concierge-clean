import { describe, expect, it, vi } from 'vitest';

import { logShadowFactUsage } from '../shadow-log';

const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

vi.mock('../../../infra/supabase/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({ insert: insertMock })),
  },
}));

describe('logShadowFactUsage', () => {
  it('inserts shadow event', async () => {
    await logShadowFactUsage('shop_123', 'session_abc', { product_ids: ['p1', 'p2'] });

    expect(insertMock).toHaveBeenCalledWith({
      shop_id: 'shop_123',
      session_id: 'session_abc',
      event_type: 'shadow_fact_sheet',
      payload: { product_ids: ['p1', 'p2'] },
    });
  });
});

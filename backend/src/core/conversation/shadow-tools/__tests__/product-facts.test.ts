import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchProductFactsShadow } from '../product-facts';

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

describe('fetchProductFactsShadow', () => {
  afterEach(() => {
    mockFetch.mockReset();
    delete process.env.ENABLE_VERTICAL_PACKS;
  });

  it('skips when feature flag disabled', async () => {
    await fetchProductFactsShadow('shop_123', []);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

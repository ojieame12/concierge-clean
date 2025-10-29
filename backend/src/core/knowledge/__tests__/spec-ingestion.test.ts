import { describe, expect, it, vi } from 'vitest';

import { detectVerticalForProduct } from '../vertical-registry';

const selectProducts = vi.fn(() => ({
  eq: vi.fn(() => ({
    in: vi.fn(async () => ({
      data: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          description: 'Soft flex park board for beginners.',
          tags: ['Park', 'Beginner'],
          product_type: 'Snowboard',
        },
      ],
      error: null,
    })),
  })),
}));

const genericUpsert = vi.fn().mockResolvedValue({ data: null, error: null });

const applySupabaseMock = () => {
  vi.doMock('../../infra/supabase/client', () => ({
    supabaseAdmin: {
      from: vi.fn((table: string) => {
        if (table === 'products') {
          return { select: selectProducts } as any;
        }
        return { upsert: genericUpsert } as any;
      }),
    },
  }));
};

applySupabaseMock();

describe('vertical detection', () => {
  it('detects snowboards via product type', () => {
    const vertical = detectVerticalForProduct({
      productType: 'All-Mountain Snowboard',
      tags: ['Winter'],
    });

    expect(vertical).toBe('snowboard');
  });

  it('returns null when no pack matches', () => {
    const vertical = detectVerticalForProduct({
      productType: 'Trail Running Shoes',
      tags: ['Footwear'],
    });

    expect(vertical).toBeNull();
  });
});

const reloadSpecIngestion = async () => {
  vi.resetModules();
  applySupabaseMock();
  return import('../spec-ingestion');
};

describe('ensureSpecPlaceholders', () => {
  it('is a no-op when feature flag disabled', async () => {
    delete process.env.ENABLE_VERTICAL_PACKS;
    const { ensureSpecPlaceholders } = await reloadSpecIngestion();

    await expect(
      ensureSpecPlaceholders({
        shopId: '00000000-0000-0000-0000-000000000123',
        products: [
        {
          productId: '11111111-1111-1111-1111-111111111111',
          productType: 'Snowboard',
          tags: ['Winter'],
        },
        ],
      })
    ).resolves.toBeUndefined();
  });

  it('logs operations when feature flag enabled', async () => {
    process.env.ENABLE_VERTICAL_PACKS = 'true';
    const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const { ensureSpecPlaceholders } = await reloadSpecIngestion();

    await ensureSpecPlaceholders({
      shopId: '00000000-0000-0000-0000-000000000123',
      products: [
        {
          productId: '11111111-1111-1111-1111-111111111111',
          productType: 'Freeride Snowboard',
          tags: ['snowboard'],
        },
      ],
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[knowledge] planned spec ingestion',
      expect.objectContaining({
        shopId: '00000000-0000-0000-0000-000000000123',
        productCount: 1,
        operations: [{ productId: '11111111-1111-1111-1111-111111111111', vertical: 'snowboard' }],
      })
    );

    consoleSpy.mockRestore();
    delete process.env.ENABLE_VERTICAL_PACKS;
    await reloadSpecIngestion();
  });
});

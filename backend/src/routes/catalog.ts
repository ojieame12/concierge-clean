import express from 'express';
import { z } from 'zod';

import { config } from '../config';
import { upsertExternalCatalogProducts, applyInventorySnapshot } from '../jobs/upsert-external-catalog';

const router = express.Router();

const catalogApiKeys = new Set(config.catalogSync.apiKeys ?? []);

const requireApiKey: express.RequestHandler = (req, res, next) => {
  if (!catalogApiKeys.size) {
    res.status(403).json({ error: 'Catalog sync not enabled' });
    return;
  }

  const apiKey = req.header('x-catalog-api-key');
  if (!apiKey || !catalogApiKeys.has(apiKey)) {
    res.status(401).json({ error: 'Invalid catalog sync key' });
    return;
  }

  next();
};

const externalProductSchema = z.object({
  externalId: z.string().optional().nullable(),
  handle: z.string().optional().nullable(),
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  productType: z.string().optional().nullable(),
  vendor: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  status: z.string().optional().nullable(),
  imageUrl: z.string().url().optional().nullable(),
  price: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  createdAt: z.string().optional().nullable(),
  updatedAt: z.string().optional().nullable(),
  variants: z
    .array(
      z.object({
        externalId: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
        sku: z.string().optional().nullable(),
        price: z.number().optional().nullable(),
        compareAtPrice: z.number().optional().nullable(),
        currency: z.string().optional().nullable(),
        inventoryQuantity: z.number().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
});

const productPayloadSchema = z.object({
  products: z.array(externalProductSchema).min(1),
});

const inventoryUpdateSchema = z.object({
  updates: z
    .array(
      z.object({
        handle: z.string().min(1),
        sku: z.string().optional().nullable(),
        variantKey: z.string().optional().nullable(),
        quantity: z.number().optional().nullable(),
        price: z.number().optional().nullable(),
        currency: z.string().optional().nullable(),
        title: z.string().optional().nullable(),
      })
    )
    .min(1),
});

router.post('/shops/:shopDomain/products', requireApiKey, async (req, res) => {
  try {
    const payload = productPayloadSchema.parse(req.body ?? {});
    const { shopDomain } = req.params;

    const result = await upsertExternalCatalogProducts({
      shopDomain,
      products: payload.products.map((product) => ({
        ...product,
        tags: product.tags ?? undefined,
        variants: product.variants ?? undefined,
      })),
    });

    res.json({ status: 'ok', ...result });
  } catch (error: any) {
    console.error('[catalog] upsert failed', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payload', details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error?.message ?? 'Catalog upsert failed' });
  }
});

router.post('/shops/:shopDomain/inventory', requireApiKey, async (req, res) => {
  try {
    const payload = inventoryUpdateSchema.parse(req.body ?? {});
    const { shopDomain } = req.params;

    const result = await applyInventorySnapshot({
      shopDomain,
      updates: payload.updates.map((update) => ({
        ...update,
        quantity: update.quantity ?? null,
        price: update.price ?? null,
      })),
    });

    res.json({ status: 'ok', ...result });
  } catch (error: any) {
    console.error('[catalog] inventory update failed', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid payload', details: error.flatten() });
      return;
    }
    res.status(500).json({ error: error?.message ?? 'Inventory update failed' });
  }
});

export const catalogRouter = router;

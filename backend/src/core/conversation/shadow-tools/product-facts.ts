import { config } from '../../../config';
import type { Product } from '../types';
import { logShadowFactUsage } from '../../logging/shadow-log';

const logPrefix = '[shadow-tools/product-facts]';

interface FactSheetResponse {
  facts: Array<{
    id: string;
    specs?: Record<string, unknown>;
    derived?: Record<string, unknown>;
  }>;
}

export const fetchProductFactsShadow = async (
  shopId: string,
  products: Product[],
  sessionId?: string,
  abortSignal?: AbortSignal
): Promise<void> => {
  if (!config.featureFlags?.verticalPacks) return;
  if (!products.length) return;

  const baseUrl = config.tools?.baseUrl ?? process.env.TOOLS_BASE_URL ?? '';
  if (!baseUrl) {
    console.warn(`${logPrefix} no tools base URL configured`);
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`${baseUrl}/api/tools/product-facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, productIds: products.slice(0, 5).map((product) => product.id) }),
      signal: abortSignal ?? controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      console.warn(`${logPrefix} request failed`, response.status);
      return;
    }

    const data = (await response.json()) as FactSheetResponse;
    if (sessionId) {
      await logShadowFactUsage(shopId, sessionId, {
        product_ids: data.facts.map((fact) => fact.id),
        sample: data.facts.slice(0, 3),
      });
    }
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.debug(`${logPrefix} aborted`);
      return;
    }
    console.warn(`${logPrefix} error`, error);
  }
};

import { config } from '../../../config';

export interface ProductFactSheet {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  summary: string | null;
  specs: Record<string, string | number | null>;
  derived: Record<string, number | null>;
  evidence: Array<{ key: string; snippet?: string | null; confidence?: number | null }>;
}

interface FactSheetResponse {
  facts: ProductFactSheet[];
}

const logPrefix = '[tool/product-facts]';

export const fetchProductFacts = async (
  shopId: string,
  productIds: string[],
  signal?: AbortSignal
): Promise<ProductFactSheet[] | null> => {
  if (!productIds.length) return [];

  const baseUrl = config.tools?.baseUrl ?? process.env.TOOLS_BASE_URL ?? '';
  if (!baseUrl) {
    console.warn(`${logPrefix} missing TOOLS_BASE_URL`);
    return null;
  }

  try {
    const response = await fetch(`${baseUrl}/api/tools/product-facts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shopId, productIds }),
      signal,
    });

    if (!response.ok) {
      console.warn(`${logPrefix} request failed`, response.status);
      return null;
    }

    const data = (await response.json()) as FactSheetResponse;
    return data.facts ?? [];
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.warn(`${logPrefix} aborted`);
      return null;
    }
    console.warn(`${logPrefix} error`, error);
    return null;
  }
};

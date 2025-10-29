import { config } from '../../config';
import { deriveSpecsStub } from '../../jobs/derive-specs';
import { detectVerticalForProduct, type VerticalDetectionInput, type VerticalPackId } from './vertical-registry';

export interface SpecIngestionCandidate extends VerticalDetectionInput {
  productId: string;
}

export interface SpecIngestionRequest {
  shopId: string;
  products: SpecIngestionCandidate[];
}

const isEnabled = () => config.featureFlags?.verticalPacks === true;

const logPrefix = '[knowledge]';

export type PlannedSpecOperation = {
  productId: string;
  vertical: VerticalPackId;
};

export const planSpecIngestion = (products: SpecIngestionCandidate[]): PlannedSpecOperation[] => {
  const operations: PlannedSpecOperation[] = [];

  for (const candidate of products) {
    const vertical = detectVerticalForProduct(candidate);
    if (vertical) {
      operations.push({ productId: candidate.productId, vertical });
    }
  }

  return operations;
};

export async function ensureSpecPlaceholders({ shopId, products }: SpecIngestionRequest): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  const operations = planSpecIngestion(products);

  if (!operations.length) {
    return;
  }

  console.debug(`${logPrefix} planned spec ingestion`, {
    shopId,
    productCount: products.length,
    operations,
  });

  await deriveSpecsStub({
    shopId,
    candidates: products,
  });
}

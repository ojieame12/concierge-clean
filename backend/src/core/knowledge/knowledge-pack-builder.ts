import type { KnowledgePack, UnitRule } from './types';
import { normalizeValue } from './unit-normalizer';
import { toAttributeId } from './utils';

interface SpecEvidenceRow {
  productId: string;
  specKey: string;
  snippet: string | null;
  confidence: number | null;
}

interface ProductSummaryRow {
  productId: string;
  title: string;
  description?: string | null;
  productType?: string | null;
  vendor?: string | null;
  keyFeatures?: string[] | null;
  bestFor?: string[] | null;
}

interface BuildKnowledgePackParams {
  products: ProductSummaryRow[];
  specEvidence: SpecEvidenceRow[];
  unitRules: UnitRule[];
}

export const buildKnowledgePacks = ({ products, specEvidence, unitRules }: BuildKnowledgePackParams): KnowledgePack[] => {
  const evidenceByProduct = new Map<string, SpecEvidenceRow[]>();
  specEvidence.forEach((row) => {
    if (!evidenceByProduct.has(row.productId)) {
      evidenceByProduct.set(row.productId, []);
    }
    evidenceByProduct.get(row.productId)!.push(row);
  });

  return products.map((product) => {
    const evidence = evidenceByProduct.get(product.productId) ?? [];
    const normalizedSpecs: Record<string, string | number | null> = {};
    const derivedMetrics: Record<string, number | null> = {};
    const seenKeys = new Set<string>();

    evidence.forEach(({ specKey, snippet }) => {
      const id = toAttributeId(specKey);
      if (!id) return;
      seenKeys.add(id);

      const trimmed = snippet?.trim() ?? null;
      if (trimmed) {
        normalizedSpecs[id] = trimmed;
      }

      const normalized = trimmed ? normalizeValue(unitRules, id, trimmed) : null;
      if (normalized != null) {
        derivedMetrics[id] = normalized;
      }
    });

    const reasons: Array<{ text: string; source: string }> = [];

    evidence
      .filter((row) => Boolean(row.snippet))
      .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))
      .slice(0, 3)
      .forEach((row) => {
        if (!row.snippet) return;
        reasons.push({ text: row.snippet.trim(), source: row.specKey });
      });

    if (!reasons.length) {
      const extras = [
        ...(product.keyFeatures ?? []),
        ...(product.bestFor ?? []),
      ].filter(Boolean);
      extras.slice(0, 2).forEach((entry, index) => {
        reasons.push({ text: entry!, source: index === 0 ? 'key_feature' : 'best_for' });
      });
    }

    const evidencePayload = evidence.map((row) => ({
      key: toAttributeId(row.specKey),
      snippet: row.snippet,
      confidence: row.confidence,
    }));

    return {
      productId: product.productId,
      normalizedSpecs,
      derivedMetrics,
      whyReasons: reasons,
      evidence: evidencePayload,
    } satisfies KnowledgePack;
  });
};

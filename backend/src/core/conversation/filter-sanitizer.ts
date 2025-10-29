import type { ClarifierOption } from './clarifier-config';
import type { RetrievalSet } from './conversation-policy';
import { bucketizePrice } from './conversation-policy';

export interface SanitizeFiltersParams {
  activeFilters: Record<string, string>;
  canonicalClarifiers: Record<string, ClarifierOption[]>;
  retrieval: RetrievalSet;
  defaultChoices: Record<string, ClarifierOption[]>;
}

export interface SanitizeFiltersResult {
  filters: Record<string, string>;
  removed: Array<{ facet: string; value: string }>;
}

export const sanitizeFilters = ({
  activeFilters,
  canonicalClarifiers,
  retrieval,
  defaultChoices,
}: SanitizeFiltersParams): SanitizeFiltersResult => {
  const sanitized: Record<string, string> = { ...activeFilters };
  const removed: Array<{ facet: string; value: string }> = [];

  const facetEntries = Object.entries(activeFilters);
  if (!facetEntries.length) {
    return { filters: sanitized, removed };
  }

  facetEntries.forEach(([facet, rawValue]) => {
    const canonicalValue = canonicaliseFilterValue(facet, rawValue);
    const allowed = buildAllowedValues({
      facet,
      canonicalClarifiers,
      retrieval,
      defaultChoices,
    });

    if (allowed.size > 0 && !allowed.has(canonicalValue)) {
      delete sanitized[facet];
      removed.push({ facet, value: rawValue });
    }
  });

  return { filters: sanitized, removed };
};

const buildAllowedValues = ({
  facet,
  canonicalClarifiers,
  retrieval,
  defaultChoices,
}: {
  facet: string;
  canonicalClarifiers: Record<string, ClarifierOption[]>;
  retrieval: RetrievalSet;
  defaultChoices: Record<string, ClarifierOption[]>;
}): Set<string> => {
  const allowed = new Set<string>();

  const canonical = canonicalClarifiers[facet] ?? [];
  canonical.forEach((option) => allowed.add(canonicaliseFilterValue(facet, option.value)));

  const defaultOptions = defaultChoices[facet] ?? [];
  defaultOptions.forEach((option) => allowed.add(canonicaliseFilterValue(facet, option.value)));

  const facetValues = retrieval.facets.get(facet);
  if (facetValues) {
    facetValues.forEach((value) => allowed.add(canonicaliseFilterValue(facet, value)));
  }

  retrieval.products.forEach((product) => {
    switch (facet) {
      case 'vendor':
        if (product.vendor) allowed.add(canonicaliseFilterValue(facet, product.vendor));
        break;
      case 'product_type':
        if (product.product_type) allowed.add(canonicaliseFilterValue(facet, product.product_type));
        break;
      case 'price_bucket': {
        const bucket = bucketizePrice(product.price ?? null);
        if (bucket) allowed.add(canonicaliseFilterValue(facet, bucket));
        break;
      }
      case 'tag':
        (product.tags ?? []).forEach((tag) => allowed.add(canonicaliseFilterValue(facet, tag)));
        break;
      default:
        break;
    }
  });

  return allowed;
};

export const canonicaliseFilterValue = (facet: string, raw: string): string => {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  switch (facet) {
    case 'price_bucket':
    case 'vendor':
      return trimmed;
    default:
      return trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
        .replace(/\s+/g, '_');
  }
};

import { DateTime } from 'luxon';
import type { OntologyAttribute, OntologyDefinition } from './types';
import { toAttributeId } from './utils';

interface BuildOntologyParams {
  shopId: string;
  categories: string[];
  facets: Array<{ facet: string; value: string }>; // canonical facets from DB
  specKeys: Array<{ key: string; sample: string | null }>;
}

const guessType = (values: string[]): 'number' | 'enum' | 'string' => {
  let numericCount = 0;
  const enumerated = new Set<string>();

  values.forEach((raw) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    const num = Number(trimmed.replace(/[, ]+/g, '').replace(/[^0-9.-]/g, ''));
    if (!Number.isNaN(num) && /^(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)$/.test(trimmed.replace(/[, ]/g, ''))) {
      numericCount += 1;
      return;
    }
    enumerated.add(trimmed.toLowerCase());
  });

  if (!values.length) return 'string';
  if (numericCount / values.length > 0.6) {
    return 'number';
  }

  if (enumerated.size <= Math.min(12, Math.max(3, values.length / 2))) {
    return 'enum';
  }

  return 'string';
};

const collectSynonyms = (values: string[]): string[] => {
  const synonyms = new Set<string>();
  values.forEach((value) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    synonyms.add(cleaned.toLowerCase());
  });
  return Array.from(synonyms).slice(0, 8);
};

const facetOrder = (categories: string[], facets: Array<{ facet: string; value: string }>) => {
  const priority = new Map<string, number>();

  facets.forEach(({ facet }) => {
    const current = priority.get(facet) ?? 0;
    priority.set(facet, current + 1);
  });

  const defaultOrder = Array.from(priority.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([facet]) => facet)
    .slice(0, 8);

  const perCategory: Record<string, string[]> = {};
  categories.forEach((category) => {
    perCategory[toAttributeId(category) || 'uncategorized'] = defaultOrder;
  });

  return perCategory;
};

export const buildOntologyDefinition = ({ shopId: _shopId, categories, facets, specKeys }: BuildOntologyParams): OntologyDefinition => {
  const attributeMap = new Map<string, { label: string; samples: string[] }>();

  facets.forEach(({ facet, value }) => {
    const id = toAttributeId(facet);
    if (!id) return;
    if (!attributeMap.has(id)) {
      attributeMap.set(id, { label: facet, samples: [] });
    }
    if (attributeMap.get(id)!.samples.length < 40) {
      attributeMap.get(id)!.samples.push(value);
    }
  });

  specKeys.forEach(({ key, sample }) => {
    const id = toAttributeId(key);
    if (!id) return;
    if (!attributeMap.has(id)) {
      attributeMap.set(id, { label: key, samples: [] });
    }
    if (sample && attributeMap.get(id)!.samples.length < 40) {
      attributeMap.get(id)!.samples.push(sample);
    }
  });

  const attributes: OntologyAttribute[] = Array.from(attributeMap.entries()).map(([id, { label, samples }]) => {
    const type = guessType(samples);
    const attr: OntologyAttribute = {
      id,
      label,
      type,
    };

    if (type === 'enum') {
      attr.allowedValues = Array.from(new Set(samples.map((value) => value.trim()).filter(Boolean))).slice(0, 12);
      attr.synonyms = collectSynonyms(samples);
    }
    return attr;
  });

  const versionTimestamp = DateTime.utc().toISO({ suppressMilliseconds: true });
  const version = `${DateTime.utc().toFormat('yyyyLLddHHmmss')}`;

  return {
    version,
    generatedAt: versionTimestamp ?? new Date().toISOString(),
    attributes,
    facetOrderByCategory: facetOrder(categories, facets),
    normalizers: {},
  } satisfies OntologyDefinition;
};

export type { BuildOntologyParams };

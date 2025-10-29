import type { QuickReply, Segment } from '@insite/shared-types';

import type { ClarifierOption } from '../clarifier-config';
import type { RetrievalSet } from '../conversation-policy';
import { DEFAULT_CLARIFIER_CHOICES, FALLBACK_FACET_PRIORITY } from '../clarifier-config';
import { runHybridSearch } from '../../search/hybrid-search';
import type { Product } from '../types';

export type RelaxationStep = {
  facet: string;
  previousValue?: string;
  description: string;
  undo?: QuickReply;
};

export type RelaxationOutcome = {
  retrieval: RetrievalSet;
  filters: Record<string, string>;
  steps: RelaxationStep[];
  notes: Segment[];
  undoOptions: QuickReply[];
};

const RELAXATION_PRIORITY: Array<{
  facet: string;
  label: (value?: string | null) => string;
  description: (value?: string | null) => string;
}> = [
  {
    facet: 'price_bucket',
    label: (value) => (value ? `Keep under ${value}` : 'Reset budget'),
    description: (value) => (value
      ? `No stock under ${value}. I widened the price range so you still see beginner-friendly picks.`
      : 'No stock in that price range. I widened the budget slightly to surface close matches.'),
  },
  {
    facet: 'style',
    label: (value) => (value ? `Stay with ${humanizeFacetValue(value)}` : 'Keep current style'),
    description: (value) => (value
      ? `That exact style is tight right now. I broadened to nearby styles so you still get a similar ride.`
      : 'I loosened the style filter so you can see adjacent options.'),
  },
  {
    facet: 'use_case',
    label: (value) => (value ? `Keep ${humanizeFacetValue(value)}` : 'Keep use case'),
    description: () => 'I relaxed the activity filter so you can compare close matches.',
  },
  {
    facet: 'vendor',
    label: (value) => (value ? `Only ${humanizeFacetValue(value)}` : 'Keep brand'),
    description: (value) => (value
      ? `That brand is low on stock. I included similar brands so you still get the same spec.`
      : 'I opened the brand filter to show comparable options.'),
  },
];

const humanizeFacetValue = (value: string) =>
  value
    .split(/[_-]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const canonicaliseFacetValue = (facet: string, raw: string) => {
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

export async function applyRelaxation({
  retrieval,
  filters,
  deps,
  shopId,
  lexicalQuery,
  embedding,
  limit,
}: {
  retrieval: RetrievalSet;
  filters: Record<string, string>;
  deps: { supabaseAdmin: any };
  shopId: string;
  lexicalQuery: string;
  embedding: number[];
  limit: number;
}): Promise<RelaxationOutcome> {
  const steps: RelaxationStep[] = [];
  const notes: Segment[] = [];
  const undoOptions: QuickReply[] = [];
  let workingRetrieval = retrieval;
  const workingFilters = { ...filters };

  for (const rule of RELAXATION_PRIORITY) {
    if (workingRetrieval.products.length > 0) break;
    if (!Object.prototype.hasOwnProperty.call(workingFilters, rule.facet)) continue;

    const previousValue = workingFilters[rule.facet];
    delete workingFilters[rule.facet];

    const relaxedRetrieval = await runHybridSearch(
      { supabaseAdmin: deps.supabaseAdmin },
      {
        shopId,
        lexicalQuery,
        embedding,
        limit,
        activeFilters: workingFilters,
      }
    );

    workingRetrieval = relaxedRetrieval;

    const undo = previousValue
      ? { id: `undo_${rule.facet}`, label: rule.label(previousValue), value: previousValue }
      : undefined;

    steps.push({
      facet: rule.facet,
      previousValue,
      description: rule.description(previousValue),
      undo,
    });

    notes.push({
      type: 'note',
      tone: 'info',
      variant: 'relaxation',
      text: rule.description(previousValue),
    });

    if (undo) {
      undoOptions.push(undo);
    }
  }

  return {
    retrieval: workingRetrieval,
    filters: workingFilters,
    steps,
    notes,
    undoOptions,
  };
}

export const selectCandidateProducts = (retrieval: RetrievalSet): Product[] => retrieval.products.slice(0, 17);

export const computeFacetValues = (
  facet: string,
  retrieval: RetrievalSet,
  canonicalOptions: Record<string, ClarifierOption[]>
): string[] => {
  const canonical = canonicalOptions[facet];
  if (canonical?.length) {
    return canonical.map((option) => option.value);
  }

  let values = Array.from(retrieval.facets.get(facet) ?? []);
  if (!values.length && facet === 'style') {
    values = Array.from(retrieval.facets.get('product_type') ?? []);
  }

  if (!values.length) {
    values = (DEFAULT_CLARIFIER_CHOICES[facet] ?? []).map((option) => option.value);
  }

  const normalised = values
    .map((value) => canonicaliseFacetValue(facet, value))
    .filter(Boolean);

  return Array.from(new Set(normalised));
};

type HybridSearchDependenciesSubset = {
  supabaseAdmin: any;
};

export async function loadCategoryClarifierConfig(
  deps: HybridSearchDependenciesSubset,
  shopId: string,
  categoryKeys: string[],
): Promise<{ facetPriority: string[]; canonicalClarifiers: Record<string, ClarifierOption[]> }> {
  if (!categoryKeys.length) {
    return {
      facetPriority: FALLBACK_FACET_PRIORITY,
      canonicalClarifiers: {},
    };
  }

  const { data, error } = await deps.supabaseAdmin
    .from('category_taxonomy')
    .select('category_key, facet_priority, canonical_clarifiers')
    .eq('shop_id', shopId)
    .in('category_key', categoryKeys);

  if (error || !data?.length) {
    if (error) {
      console.warn('[conversation] failed to load category clarifiers', error.message);
    }
    return {
      facetPriority: FALLBACK_FACET_PRIORITY,
      canonicalClarifiers: {},
    };
  }

  const byKey = new Map<string, (typeof data)[number]>();
  data.forEach((item: any) => {
    byKey.set(item.category_key, item);
  });

  for (const key of categoryKeys) {
    if (byKey.has(key)) {
      const row = byKey.get(key)!;
      return {
        facetPriority: row.facet_priority?.length ? row.facet_priority : FALLBACK_FACET_PRIORITY,
        canonicalClarifiers: (row.canonical_clarifiers ?? {}) as Record<string, ClarifierOption[]>,
      };
    }
  }

  const first = data[0];
  return {
    facetPriority: first.facet_priority?.length ? first.facet_priority : FALLBACK_FACET_PRIORITY,
    canonicalClarifiers: (first.canonical_clarifiers ?? {}) as Record<string, ClarifierOption[]>,
  };
}

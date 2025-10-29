import type { SupabaseClient } from '@supabase/supabase-js';

import type { Product, ProductVariant } from '../conversation/types';
import { bucketizePrice, type RetrievalSet } from '../conversation/conversation-policy';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'from', 'with', 'this', 'that', 'have', 'your', 'about', 'there', 'what', 'when',
  'where', 'want', 'need', 'looking', 'like', 'just', 'really', 'very', 'into', 'some', 'more', 'than',
  'good', 'best', 'over', 'under', 'help', 'find', 'show', 'tell'
]);

export const buildLexicalQuery = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
    .slice(0, 10)
    .join(' ');

const buildFacetMap = (products: Product[]): Map<string, Set<string>> => {
  const facets = new Map<string, Set<string>>();

  const addFacet = (key: string, value: string | null | undefined) => {
    if (!value) return;
    if (!facets.has(key)) facets.set(key, new Set());
    facets.get(key)!.add(value);
  };

  products.forEach((product) => {
    addFacet('product_type', product.product_type);
    addFacet('vendor', product.vendor);
    addFacet('price_bucket', bucketizePrice(product.price ?? null));
    (product.tags ?? []).slice(0, 5).forEach((tag) => addFacet('tag', tag));
    product.summary?.styleDescriptors?.forEach((style) => addFacet('style', style));
    if (product.summary?.category) addFacet('style', product.summary.category);
  });

  return facets;
};

export interface HybridSearchDependencies {
  supabaseAdmin: SupabaseClient;
}

export interface HybridSearchParams {
  shopId: string;
  lexicalQuery: string;
  embedding: number[];
  limit?: number;
  activeFilters?: Record<string, string>;
}

const normalise = (value: string | null | undefined) => value?.toLowerCase().trim() ?? '';

const parsePriceBucket = (
  bucket: string | null | undefined
): { min: number | null; max: number | null } => {
  if (!bucket) return { min: null, max: null };

  const trimmed = bucket.trim();
  if (!trimmed) return { min: null, max: null };

  const lower = trimmed.toLowerCase();
  const numbers = (trimmed.match(/\d+(?:\.\d+)?/g) ?? [])
    .map((value) => Number.parseFloat(value))
    .filter((value) => !Number.isNaN(value));

  if (lower.includes('under') || lower.includes('less') || lower.includes('below')) {
    return {
      min: null,
      max: numbers[0] ?? null,
    };
  }

  if (lower.includes('over') || lower.includes('above') || lower.includes('+') || lower.includes('more than') || lower.includes('greater')) {
    return {
      min: numbers[numbers.length - 1] ?? null,
      max: null,
    };
  }

  if (numbers.length >= 2) {
    const [first, second] = numbers;
    return {
      min: Math.min(first, second),
      max: Math.max(first, second),
    };
  }

  if (numbers.length === 1) {
    const value = numbers[0];
    return { min: value, max: value };
  }

  return { min: null, max: null };
};

const matchesFilters = (product: Product, filters: Record<string, string>): boolean =>
  Object.entries(filters).every(([facet, rawValue]) => {
    const value = normalise(rawValue);
    if (!value) return true;

    switch (facet) {
      case 'price_bucket':
        return normalise(bucketizePrice(product.price ?? null)) === value;
      case 'product_type':
        return normalise(product.product_type) === value;
      case 'vendor':
        return normalise(product.vendor) === value;
      case 'tag':
        return (product.tags ?? []).some((tag) => normalise(tag) === value);
      case 'style': {
        const summary = product.summary;
        const target = value.replace(/[_-]+/g, ' ').toLowerCase().trim();
        const toComparable = (input: string | null | undefined) =>
          input ? input.toLowerCase().replace(/[_-]+/g, ' ').trim() : '';

        const matchesDescriptors = summary?.styleDescriptors?.some((item) => toComparable(item) === target);
        const matchesCategory = summary?.category ? toComparable(summary.category) === target : false;
        const matchesUseCases = summary?.useCases?.some((item) => toComparable(item) === target);
        const matchesTags = (product.tags ?? []).some((tag) => toComparable(tag) === target);
        const matchesProductType = toComparable(product.product_type) === target;
        return matchesDescriptors || matchesCategory || matchesUseCases || matchesTags || matchesProductType;
      }
      case 'use_case': {
        const summary = product.summary;
        const target = value.replace(/[_-]+/g, ' ').toLowerCase().trim();
        const toComparable = (input: string | null | undefined) =>
          input ? input.toLowerCase().replace(/[_-]+/g, ' ').trim() : '';

        const matchesUseCases = summary?.useCases?.some((item) => toComparable(item) === target);
        const matchesBestFor = summary?.bestFor?.some((item) => toComparable(item) === target);
        const matchesTags = (product.tags ?? []).some((tag) => toComparable(tag) === target);

        return matchesUseCases || matchesBestFor || matchesTags;
      }
      default:
        return true;
    }
  });

export const runHybridSearch = async (
  { supabaseAdmin }: HybridSearchDependencies,
  { shopId, lexicalQuery, embedding, limit = 12, activeFilters = {} }: HybridSearchParams
): Promise<RetrievalSet> => {
  const priceRange = parsePriceBucket(activeFilters.price_bucket);

  const { data, error } = await supabaseAdmin.rpc('search_products_hybrid', {
    p_shop: shopId,
    q_vec: JSON.stringify(embedding),
    q_lex: lexicalQuery,
    p_limit: limit,
    p_min_price: priceRange.min,
    p_max_price: priceRange.max,
  });

  if (error) {
    throw error;
  }

  const products = (data ?? []).map((item: any) => ({
    id: item.product_id ?? item.id,
    title: item.title,
    description: item.description,
    price: item.price,
    currency: item.currency,
    image_url: item.image_url,
    handle: item.handle,
    vendor: item.vendor,
    product_type: item.product_type,
    tags: item.tags ?? [],
    combined_score: item.combined_score ?? item.similarity ?? null,
    summary: item.summary ?? null,
  })) as Product[];

  // Trust the database's hybrid search scoring completely
  // The search_products_hybrid RPC already does sophisticated lexical + semantic ranking
  // Don't second-guess it with arbitrary thresholds - let the routing logic decide
  // if results are good enough based on groundability scoring

  const filteredProducts = products.filter((product) => matchesFilters(product, activeFilters));
  const finalProducts = filteredProducts;

  let variantsByProduct = new Map<string, ProductVariant[]>();
  const productIds = finalProducts.map((product) => product.id);

  if (productIds.length) {
    const { data: variantRows, error: variantError } = await supabaseAdmin
      .from('product_variants')
      .select('product_id, shopify_variant_id, title, price, compare_at_price, sku, inventory_quantity')
      .in('product_id', productIds);

    if (variantError) {
      console.warn('[search] failed to load variants', variantError.message);
    } else if (variantRows) {
      variantsByProduct = variantRows.reduce((acc, row) => {
        const list = acc.get(row.product_id) ?? [];
        list.push({
          id: row.shopify_variant_id?.toString(),
          title: row.title ?? null,
          price: row.price ?? null,
          compare_at_price: row.compare_at_price ?? null,
          sku: row.sku ?? null,
          option_values: (row.title ?? '')
            .split('/')
            .map((segment: string) => segment.trim())
            .filter(Boolean),
          inventory_quantity: row.inventory_quantity ?? null,
          available: row.inventory_quantity == null ? null : row.inventory_quantity > 0,
        });
        acc.set(row.product_id, list);
        return acc;
      }, new Map<string, ProductVariant[]>());
    }
  }

  const enrichedProducts = finalProducts.map((product) => ({
    ...product,
    variants: variantsByProduct.get(product.id) ?? product.variants ?? [],
  }));

  return {
    products: enrichedProducts,
    facets: buildFacetMap(enrichedProducts),
  };
};

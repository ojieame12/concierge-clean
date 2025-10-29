import type { SupabaseClient } from '@supabase/supabase-js';
import type { CanonShard, KnowledgePack, UnitRule } from './types';
import { toAttributeId } from './utils';

const vectorSimilarity = (a: number[], b: number[]) => {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
};

export const fetchActiveOntologyVersion = async (supabase: SupabaseClient, shopId: string) => {
  const { data, error } = await supabase
    .from('shop_active_ontology')
    .select('version')
    .eq('shop_id', shopId)
    .single();

  if (error || !data) return null;
  return data.version as string;
};

export const fetchOntologyDefinition = async (supabase: SupabaseClient, shopId: string, version: string) => {
  const { data, error } = await supabase
    .from('shop_ontologies')
    .select('ontology')
    .eq('shop_id', shopId)
    .eq('version', version)
    .single();

  if (error || !data) return null;
  return data.ontology as any;
};

export const fetchUnitRules = async (supabase: SupabaseClient, shopId: string, version: string): Promise<UnitRule[]> => {
  const { data, error } = await supabase
    .from('shop_unit_rules')
    .select('attribute_id, source_unit, target_unit, multiplier, offset_value, precision')
    .eq('shop_id', shopId)
    .eq('ontology_version', version);

  if (error || !data) return [];
  return (data ?? []).map((row) => ({
    attributeId: toAttributeId(row.attribute_id),
    sourceUnit: row.source_unit,
    targetUnit: row.target_unit,
    multiplier: Number(row.multiplier),
    offset: row.offset_value == null ? 0 : Number(row.offset_value),
    precision: row.precision == null ? undefined : Number(row.precision),
  }));
};

export const fetchKnowledgePacksByProducts = async (
  supabase: SupabaseClient,
  shopId: string,
  productIds: string[],
  version: string
): Promise<KnowledgePack[]> => {
  if (!productIds.length) return [];

  const { data, error } = await supabase
    .from('product_knowledge_packs')
    .select('product_id, normalized_specs, derived_metrics, why_reasons, evidence')
    .eq('shop_id', shopId)
    .eq('ontology_version', version)
    .in('product_id', productIds);

  if (error || !data) return [];
  return (data ?? []).map((row) => ({
    productId: row.product_id,
    normalizedSpecs: row.normalized_specs ?? {},
    derivedMetrics: row.derived_metrics ?? {},
    whyReasons: row.why_reasons ?? [],
    evidence: row.evidence ?? [],
  }));
};

export const fetchCanonCandidates = async (
  supabase: SupabaseClient,
  shopId: string,
  version: string,
  limit = 60
): Promise<CanonShard[]> => {
  const { data, error } = await supabase
    .from('shop_canon_shards')
    .select('topic, tags, assertions, caveats, citation, embedding')
    .eq('shop_id', shopId)
    .eq('ontology_version', version)
    .limit(limit);

  if (error || !data) return [];
  return (data ?? []).map((row) => ({
    topic: row.topic,
    tags: row.tags ?? [],
    assertions: row.assertions ?? [],
    caveats: row.caveats ?? [],
    citation: row.citation ?? undefined,
    embedding: row.embedding ?? undefined,
  }));
};

export const rankCanonShards = (candidates: CanonShard[], queryEmbedding: number[], maxResults = 4) => {
  return candidates
    .map((shard) => ({
      shard,
      score: shard.embedding && queryEmbedding.length ? vectorSimilarity(shard.embedding, queryEmbedding) : 0,
    }))
    .filter((entry) => entry.shard.assertions.length)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
    .map((entry) => ({ ...entry.shard, score: entry.score }));
};

export const fetchCalculatorRegistry = async (supabase: SupabaseClient, shopId: string) => {
  const { data, error } = await supabase
    .from('shop_calculator_registry')
    .select('calculator_id, config, ontology_version')
    .eq('shop_id', shopId);

  if (error || !data) return [];
  return data ?? [];
};

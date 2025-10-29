import { jsonrepair } from 'jsonrepair';

import { chatModel, generateEmbedding } from '../../infra/llm/gemini';
import type { CanonShard } from './types';

interface ShopDocumentRow {
  id: string;
  title?: string | null;
  content: string;
  docType: string;
  metadata?: Record<string, unknown>;
}

interface BuildCanonParams {
  shopId: string;
  ontologyVersion: string;
  documents: ShopDocumentRow[];
  maxShards?: number;
}

const CANON_PROMPT = `You are distilling trustworthy industry knowledge from merchant reference material.
Split the provided document into atomic knowledge shards. Each shard must:
- Focus on one idea (definition, comparison, safety rule, sizing guidance, best practice)
- Stay under 120 words
- Include any necessary caveats
- Reference the source title when available

Respond in JSON with {"shards": [{"topic": string, "assertions": string[], "caveats": string[], "tags": string[], "citation": string}] }.
Tags should be lowercase keywords (<=5) that map to product facets or use cases when possible.
If the document is not relevant to commerce guidance, return an empty array.`;

export const generateCanonShards = async ({ shopId: _shopId, ontologyVersion: _ontologyVersion, documents, maxShards = 40 }: BuildCanonParams): Promise<CanonShard[]> => {
  const shards: CanonShard[] = [];

  for (const doc of documents.slice(0, maxShards)) {
    const prompt = `${CANON_PROMPT}\n\nTITLE: ${doc.title ?? doc.docType}\nCONTENT:\n${doc.content.slice(0, 4000)}`;
    try {
      const response = await chatModel.generateContent({
        contents: [
          { role: 'user', parts: [{ text: prompt }] },
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 800,
        },
      });

      const text = response.response.text();
      if (!text) continue;
      let payload = text.trim();
      if (/^```/u.test(payload)) {
        payload = payload.replace(/^```json\s*/iu, '').replace(/^```\s*/iu, '').replace(/```$/u, '').trim();
      }
      let parsed: { shards?: Array<{ topic: string; assertions: string[]; caveats?: string[]; tags?: string[]; citation?: string }> } | null = null;
      try {
        parsed = JSON.parse(payload);
      } catch {
        try {
          parsed = JSON.parse(jsonrepair(payload));
        } catch (repairError) {
          console.warn('[canon-builder] invalid JSON from model', (repairError as Error).message, text);
          continue;
        }
      }
      if (!parsed) continue;
      (parsed.shards ?? []).forEach((entry) => {
        const assertions = (entry.assertions ?? []).map((line) => line.trim()).filter(Boolean);
        if (!assertions.length) return;
        shards.push({
          topic: entry.topic ?? doc.title ?? doc.docType,
          tags: entry.tags ?? [],
          assertions,
          caveats: entry.caveats ?? [],
          citation: entry.citation ?? doc.title ?? doc.docType,
        });
      });
    } catch (error) {
      console.warn('[canon-builder] failed to generate shard', (error as Error).message);
    }
  }

  for (const shard of shards) {
    try {
      shard.embedding = await generateEmbedding(`${shard.topic}. ${shard.assertions.join(' ')}`);
    } catch (error) {
      console.warn('[canon-builder] embedding failed', (error as Error).message);
    }
  }

  return shards;
};

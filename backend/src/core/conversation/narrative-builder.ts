import { clampWords } from './text-utils';
import { selectPhrase, type ToneStyle } from './phrase-bank';
import { generateNaturalOpener } from './narrative-generator';
import type { Product } from './types';
import type { ProductFactSheet } from './tools/product-facts';
import type { ToneConfig } from './tone-manager';

interface NarrativeInput {
  tone: ToneStyle;
  userMessage: string;
  products: Product[];
  config: ToneConfig;
  sessionId: string;
  factSheets?: ProductFactSheet[];
}

export const buildNarrativeSegments = async ({
  tone,
  userMessage,
  products,
  config,
  sessionId,
  factSheets,
}: NarrativeInput) => {
  const segments: Array<{ type: 'narrative'; text: string }> = [];

  if (tone === 'concise') {
    const quickOpener = selectPhrase('opener', tone, sessionId, { count: products.length });
    if (quickOpener) {
      segments.push({ type: 'narrative', text: clampWords(quickOpener, config.maxPreviewWords) });
    }
  } else {
    const opener = await generateNaturalOpener(
      userMessage,
      products.length,
      tone
    );
    segments.push({ type: 'narrative', text: clampWords(opener, config.maxPreviewWords) });
  }

  if (factSheets?.length) {
    const signals = factSheets
      .flatMap((fact) => fact.evidence?.map((entry) => entry.snippet ?? entry.key) ?? [])
      .filter(Boolean)
      .slice(0, 2);

    if (signals.length) {
      segments.push({
        type: 'narrative',
        text: clampWords(signals.join(' • '), config.maxPreviewWords),
      });
    }
  }

  return segments;
};

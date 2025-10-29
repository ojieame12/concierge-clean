import type { ProductFactSheet } from './tools/product-facts';

interface PromptInput {
  system: string;
  factSheets?: ProductFactSheet[];
  brandDocs?: Record<string, string | undefined>;
  recentNarrative?: string;
}

export const buildPromptSections = ({ system, factSheets = [], brandDocs = {}, recentNarrative }: PromptInput) => {
  const lines: string[] = [];
  lines.push(system.trim());

  const docs = Object.entries(brandDocs).filter(([_, value]) => Boolean(value));
  if (docs.length) {
    lines.push('\nBRAND_DOCS:');
    docs.forEach(([key, value]) => {
      lines.push(`- ${key}: ${value}`);
    });
  }

  if (factSheets.length) {
    lines.push('\nPRODUCT_FACTS:');
    factSheets.slice(0, 5).forEach((fact, index) => {
      lines.push(`${index + 1}. ${fact.title} (id=${fact.id})`);
      lines.push(`   - price: ${formatPrice(fact)}`);
      const specKeys = Object.keys(fact.specs ?? {}).slice(0, 6);
      if (specKeys.length) {
        lines.push(`   - specs: ${specKeys.map((key) => `${key}=${fact.specs?.[key] ?? 'n/a'}`).join(', ')}`);
      }
      const derivedKeys = Object.keys(fact.derived ?? {}).filter((key) => fact.derived?.[key] != null);
      if (derivedKeys.length) {
        lines.push(`   - derived: ${derivedKeys.map((key) => `${key}=${fact.derived?.[key]}`).join(', ')}`);
      }
      const evidence = fact.evidence?.slice(0, 3) ?? [];
      if (evidence.length) {
        lines.push(`   - evidence: ${evidence.map((entry) => `"${entry.snippet ?? entry.key}"`).join('; ')}`);
      }
    });
  }

  if (recentNarrative) {
    lines.push('\nRECENT_SUMMARY:');
    lines.push(recentNarrative.trim());
  }

  return lines.join('\n');
};

const formatPrice = (fact: ProductFactSheet) => {
  if (fact.price == null) return 'n/a';
  const currency = fact.currency ?? 'USD';
  return `${fact.price} ${currency}`;
};

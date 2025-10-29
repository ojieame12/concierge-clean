import type { UnitRule } from './types';
import { toAttributeId } from './utils';

interface SourceValue {
  attributeId: string;
  value: string;
}

const UNIT_PATTERNS: Array<{ pattern: RegExp; unit: string; multiplier: number; offset?: number }> = [
  { pattern: /\b(mm|millimet(?:er|re)s?)\b/i, unit: 'mm', multiplier: 1 },
  { pattern: /\b(cm|centimet(?:er|re)s?)\b/i, unit: 'mm', multiplier: 10 },
  { pattern: /\b(m|met(?:er|re)s?)\b/i, unit: 'mm', multiplier: 1000 },
  { pattern: /\b(in|inch(?:es)?)\b/i, unit: 'mm', multiplier: 25.4 },
  { pattern: /\b(ft|foot|feet)\b/i, unit: 'mm', multiplier: 304.8 },
  { pattern: /\bpsi\b/i, unit: 'psi', multiplier: 1 },
  { pattern: /\bbar\b/i, unit: 'psi', multiplier: 14.5038 },
  { pattern: /\bpa\b/i, unit: 'psi', multiplier: 0.000145038 },
  { pattern: /°c\b|deg(?:ree)?c\b/i, unit: 'celsius', multiplier: 1 },
  { pattern: /°f\b|deg(?:ree)?f\b/i, unit: 'celsius', multiplier: 5 / 9, offset: -32 },
  { pattern: /\bgpm\b/i, unit: 'gpm', multiplier: 1 },
  { pattern: /\blpm\b/i, unit: 'gpm', multiplier: 0.264172 },
  { pattern: /\bl\/min\b/i, unit: 'gpm', multiplier: 0.264172 },
  { pattern: /\bkg\b/i, unit: 'kg', multiplier: 1 },
  { pattern: /\blb|pound\b/i, unit: 'kg', multiplier: 0.453592 },
];

const extractNumeric = (value: string) => {
  const match = value.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return Number.parseFloat(match[0]);
};

export const discoverUnitRules = (values: SourceValue[]): UnitRule[] => {
  const rules: UnitRule[] = [];
  const seen = new Set<string>();

  values.forEach(({ attributeId, value }) => {
    const numeric = extractNumeric(value);
    if (numeric == null) return;

    const unitPattern = UNIT_PATTERNS.find(({ pattern }) => pattern.test(value));
    if (!unitPattern) return;

    const key = `${toAttributeId(attributeId)}:${unitPattern.unit}:${unitPattern.pattern.source}`;
    if (seen.has(key)) return;
    seen.add(key);

    const { unit: targetUnit, multiplier, offset = 0 } = unitPattern;
    const sourceMatch = value.match(unitPattern.pattern);
    const sourceUnit = sourceMatch ? sourceMatch[0].toLowerCase() : unitPattern.unit;

    rules.push({
      attributeId: toAttributeId(attributeId),
      sourceUnit,
      targetUnit,
      multiplier,
      offset,
    });
  });

  return rules;
};

export const normalizeValue = (rules: UnitRule[], attributeId: string, rawValue: string) => {
  const id = toAttributeId(attributeId);
  const rule = rules.find((candidate) => candidate.attributeId === id && rawValue.toLowerCase().includes(candidate.sourceUnit));
  if (!rule) return null;
  const numeric = extractNumeric(rawValue);
  if (numeric == null) return null;
  const converted = (numeric + (rule.offset ?? 0)) * rule.multiplier;
  const precision = rule.precision ?? 4;
  return Number(converted.toFixed(precision));
};

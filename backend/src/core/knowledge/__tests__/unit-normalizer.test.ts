import { describe, it, expect } from 'vitest';

import { discoverUnitRules, normalizeValue } from '../unit-normalizer';

describe('discoverUnitRules', () => {
  it('identifies unit conversions from samples', () => {
    const rules = discoverUnitRules([
      { attributeId: 'length', value: '25 mm' },
      { attributeId: 'length', value: '1 in' },
      { attributeId: 'pressure', value: '150 psi' },
      { attributeId: 'pressure', value: '10 bar' },
    ]);

    const mmRule = rules.find((rule) => rule.attributeId === 'length' && rule.sourceUnit.includes('in'));
    expect(mmRule).toBeDefined();
    expect(mmRule?.targetUnit).toBe('mm');
    expect(mmRule?.multiplier).toBeCloseTo(25.4, 4);

    const pressureRule = rules.find((rule) => rule.attributeId === 'pressure' && rule.sourceUnit.includes('bar'));
    expect(pressureRule).toBeDefined();
    expect(pressureRule?.targetUnit).toBe('psi');
  });
});

describe('normalizeValue', () => {
  it('converts source units using discovered rules', () => {
    const rules = discoverUnitRules([
      { attributeId: 'temperature', value: '100 °F' },
      { attributeId: 'temperature', value: '30 °C' },
    ]);

    const normalized = normalizeValue(rules, 'temperature', '100 °F');
    expect(normalized).toBeCloseTo(37.7778, 4);
  });
});

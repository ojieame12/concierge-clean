import { describe, it, expect } from 'vitest';

import { buildKnowledgePacks } from '../knowledge-pack-builder';
import { discoverUnitRules } from '../unit-normalizer';

describe('buildKnowledgePacks', () => {
  it('produces knowledge packs with normalized specs and reasons', () => {
    const unitRules = discoverUnitRules([
      { attributeId: 'flow_rate', value: '12 GPM' },
    ]);

    const packs = buildKnowledgePacks({
      products: [
        {
          productId: 'prod_1',
          title: 'Pump',
          keyFeatures: ['Compact footprint'],
          bestFor: ['Irrigation'],
        },
      ],
      specEvidence: [
        {
          productId: 'prod_1',
          specKey: 'Flow Rate',
          snippet: 'Rated for 12 GPM at nominal head.',
          confidence: 0.9,
        },
      ],
      unitRules,
    });

    expect(packs).toHaveLength(1);
    const pack = packs[0];
    expect(pack.normalizedSpecs.flow_rate).toContain('12');
    expect(pack.derivedMetrics.flow_rate).toBeCloseTo(12, 3);
    expect(pack.whyReasons.length).toBeGreaterThan(0);
  });
});

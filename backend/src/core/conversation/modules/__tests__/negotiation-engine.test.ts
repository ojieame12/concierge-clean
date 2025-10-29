import { describe, expect, it } from 'vitest';

import type { NegotiationRule, NegotiationState } from '@insite/shared-types';

import type { Product } from '../../types';
import { buildNegotiationSegments, isPriceObjection } from '../negotiation-engine';

const baseProduct: Product = {
  id: 'prod-1',
  title: 'All-Mountain Board',
  handle: 'all-mountain-board',
  price: 299,
  summary: {
    productId: 'prod-1',
    keyFeatures: ['Lightweight core'],
  },
};

describe('isPriceObjection', () => {
  it('detects common pricing pushbacks', () => {
    expect(isPriceObjection('Can you do better on the price?')).toBe(true);
    expect(isPriceObjection('This feels too expensive for me')).toBe(true);
    expect(isPriceObjection('I love the blue color')).toBe(false);
  });
});

describe('buildNegotiationSegments', () => {
  const rule: NegotiationRule = {
    anchor_copy: 'Built with premium components.',
    sweetener_copy: 'I can include edge tuning for free.',
    discount_steps: [7, 3],
    risk_copy: 'Free 30-day returns.',
  };

  it('progresses through anchor, sweetener, and discount stages', () => {
    const anchorOutcome = buildNegotiationSegments(rule, baseProduct, null);
    expect(anchorOutcome).not.toBeNull();
    expect(anchorOutcome?.segments[0]).toMatchObject({ style: 'anchor' });
    expect(anchorOutcome?.nextState).toMatchObject({ stage: 'anchor', concessionIndex: 0 });

    const sweetenerState: NegotiationState | null = anchorOutcome?.nextState ?? null;
    const sweetenerOutcome = buildNegotiationSegments(rule, baseProduct, sweetenerState);
    expect(sweetenerOutcome).not.toBeNull();
    expect(sweetenerOutcome?.segments[0]).toMatchObject({ style: 'sweetener' });
    expect(sweetenerOutcome?.nextState).toMatchObject({ stage: 'sweetener', concessionIndex: 0 });

    const firstDiscountState: NegotiationState | null = sweetenerOutcome?.nextState ?? null;
    const firstDiscount = buildNegotiationSegments(rule, baseProduct, firstDiscountState);
    expect(firstDiscount).not.toBeNull();
    expect(firstDiscount?.segments[0]).toMatchObject({ style: 'discount' });
    expect(firstDiscount?.segments[0]).toHaveProperty('meta.discount_pct', 7);
    expect(firstDiscount?.nextState).toMatchObject({ stage: 'discount', concessionIndex: 1 });

    const secondDiscountState: NegotiationState | null = firstDiscount?.nextState ?? null;
    const secondDiscount = buildNegotiationSegments(rule, baseProduct, secondDiscountState);
    expect(secondDiscount).not.toBeNull();
    expect(secondDiscount?.segments[0]).toMatchObject({ style: 'discount' });
    expect(secondDiscount?.segments[0]).toHaveProperty('meta.discount_pct', 3);
    expect(secondDiscount?.nextState).toMatchObject({ stage: 'discount', concessionIndex: 2 });

    const exhaustedState: NegotiationState | null = secondDiscount?.nextState ?? null;
    const exhausted = buildNegotiationSegments(rule, baseProduct, exhaustedState);
    expect(exhausted).toBeNull();
  });
});

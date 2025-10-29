import { describe, expect, it } from 'vitest';

import type { QuickReply } from '@insite/shared-types';

import type { Product } from '../../types';
import { buildPolicyOfferSegments, buildThresholdSegments } from '../offer-engine';

const makeProduct = (overrides: Partial<Product> = {}): Product => ({
  id: 'prod_1',
  title: 'Example Product',
  handle: 'example-product',
  price: 45,
  currency: 'USD',
  summary: null,
  ...overrides,
});

describe('buildThresholdSegments', () => {
  it('returns a threshold notice and quick replies when close to free shipping', () => {
    const quickReplies: QuickReply[] = [
      { id: 'addon_1', label: 'Add socks', value: 'Socks' },
      { id: 'addon_2', label: 'Add wax', value: 'Wax' },
    ];

    const segments = buildThresholdSegments(50, makeProduct({ price: 45 }), quickReplies);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      type: 'note',
      variant: 'threshold',
    });
    if (segments[0].type !== 'note') {
      throw new Error('Expected a note segment for threshold reminder');
    }
    expect(segments[0].text).toContain('Add $5.00 more');
    expect(segments[1]).toMatchObject({
      type: 'options',
      style: 'quick_replies',
    });
  });

  it('returns an empty array when no meaningful gap remains', () => {
    expect(buildThresholdSegments(null, makeProduct(), [])).toEqual([]);
    expect(buildThresholdSegments(50, makeProduct({ price: 80 }), [])).toEqual([]);
    expect(buildThresholdSegments(50, makeProduct({ price: 10 }), [])).toEqual([]);
  });
});

describe('buildPolicyOfferSegments', () => {
  it('builds offer cards from brand policies', () => {
    const segments = buildPolicyOfferSegments({
      policies: {
        paymentOptions: ['Shop Pay', 'Afterpay'],
        guarantees: 'Lifetime tuning included.',
        returns: 'Free 30-day returns.',
      },
    });

    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ type: 'offer', style: 'sweetener' });
    expect(segments[1]).toMatchObject({ type: 'offer', style: 'anchor' });
    expect(segments[2]).toMatchObject({ type: 'offer', style: 'risk' });
  });

  it('falls back to shipping copy when only shipping policy is provided', () => {
    const segments = buildPolicyOfferSegments({
      policies: {
        shipping: 'Free overnight shipping.',
      },
    });

    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ type: 'offer', style: 'sweetener' });
  });
});

import type { Segment, QuickReply } from '@insite/shared-types';
import type { NegotiationRule, NegotiationState } from '@insite/shared-types';

import type { Product } from '../types';

const PRICE_OBJECTION_PATTERNS = [
  'too expensive',
  'over budget',
  'out of my budget',
  'cheaper',
  'lower price',
  'cost too much',
  'pricey',
  'discount',
  'can you do better',
  'any deal',
  'better price',
  'less expensive',
  'price range',
];

export const isPriceObjection = (input: string): boolean => {
  const text = input.toLowerCase();
  return PRICE_OBJECTION_PATTERNS.some((pattern) => text.includes(pattern));
};

export const fetchNegotiationRule = async (
  supabaseAdmin: any,
  shopId: string,
  productId: string
): Promise<NegotiationRule | null> => {
  const { data, error } = await supabaseAdmin
    .from('negotiation_rules')
    .select('anchor_copy, sweetener_copy, discount_steps, risk_copy, payment_options')
    .eq('shop_id', shopId)
    .eq('product_id', productId)
    .maybeSingle();

  if (error) {
    console.warn('[conversation] failed to load negotiation rules', error.message);
    return null;
  }

  if (!data) return null;

  return {
    anchor_copy: data.anchor_copy ?? undefined,
    sweetener_copy: data.sweetener_copy ?? undefined,
    discount_steps: ((data.discount_steps ?? []) as Array<number | string | null>)
      .map((value) => (value == null ? NaN : Number(value)))
      .filter((value) => Number.isFinite(value) && value > 0) as number[],
    risk_copy: data.risk_copy ?? undefined,
    payment_options: data.payment_options ?? undefined,
  };
};

export type NegotiationOutcome = {
  segments: Segment[];
  quickReplies: QuickReply[];
  nextState: NegotiationState;
  offers: string[];
};

const buildQuickReplies = (): QuickReply[] => [
  { id: 'accept_offer', label: 'Sounds good', value: 'accept offer' },
  { id: 'show_cheaper', label: 'Show cheaper options', value: 'show cheaper options' },
  { id: 'no_thanks', label: 'Maybe later', value: 'maybe later' },
];

type NegotiationStage = 'anchor' | 'sweetener' | 'discount';

export const buildNegotiationSegments = (
  rule: NegotiationRule,
  product: Product,
  currentState: NegotiationState | null,
): NegotiationOutcome | null => {
  const baseState: NegotiationState = currentState && currentState.productId === product.id
    ? currentState
    : { productId: product.id, stage: 'anchor', concessionIndex: 0 };

  const determineNextStage = (): NegotiationStage => {
    if (!currentState || currentState.productId !== product.id) return 'anchor';
    if (currentState.stage === 'anchor') return rule.sweetener_copy ? 'sweetener' : 'discount';
    if (currentState.stage === 'sweetener') return 'discount';
    return 'discount';
  };

  const nextStage = determineNextStage();
  const quickReplies = buildQuickReplies();
  const offers: string[] = [];
  const segments: Segment[] = [];
  const currentPrice = product.price ?? null;

  if (nextStage === 'anchor') {
    const text = rule.anchor_copy
      ? rule.anchor_copy
      : currentPrice
        ? `This build is $${currentPrice.toFixed(0)} thanks to the ${product.summary?.keyFeatures?.[0] ?? 'premium components'}.`
        : 'This configuration is priced to match the premium components it includes.';

    segments.push({
      type: 'offer',
      style: 'anchor',
      title: 'Why this price?',
      text,
    });
    offers.push('negotiation_anchor');

    return {
      segments,
      quickReplies,
      nextState: { productId: product.id, stage: 'anchor', concessionIndex: 0 },
      offers,
    };
  }

  if (nextStage === 'sweetener' && rule.sweetener_copy) {
    segments.push({
      type: 'offer',
      style: 'sweetener',
      title: 'I can add this for you',
      text: rule.sweetener_copy,
    });
    offers.push('negotiation_sweetener');

    return {
      segments,
      quickReplies,
      nextState: { productId: product.id, stage: 'sweetener', concessionIndex: baseState.concessionIndex },
      offers,
    };
  }

  const discountSteps = rule.discount_steps ?? [];
  if (discountSteps.length) {
    const index = baseState.concessionIndex;
    if (index >= discountSteps.length) {
      return null;
    }

    const pct = discountSteps[index];
    const discountText = currentPrice
      ? `I can take ${pct}% off, bringing it to $${(currentPrice * (1 - pct / 100)).toFixed(0)}.`
      : `I can take ${pct}% off.`;

    segments.push({
      type: 'offer',
      style: 'discount',
      title: 'Here’s the best I can do',
      text: discountText,
      meta: { discount_pct: pct },
    });
    offers.push(`negotiation_discount_${pct}`);

    if (rule.risk_copy) {
      segments.push({
        type: 'offer',
        style: 'risk',
        title: 'Risk-free assurance',
        text: rule.risk_copy,
      });
    }

    return {
      segments,
      quickReplies,
      nextState: { productId: product.id, stage: 'discount', concessionIndex: index + 1 },
      offers,
    };
  }

  return null;
};

import type { QuickReply, Segment } from '@insite/shared-types';

import type { Product } from '../types';

export type CrossSellResult = {
  segments: Segment[];
  quickReplies: QuickReply[];
};

export async function buildCrossSellSegments(
  supabaseAdmin: any,
  shopId: string,
  primary: Product | undefined,
): Promise<CrossSellResult> {
  if (!primary?.summary?.crossSell?.length) {
    return { segments: [], quickReplies: [] };
  }

  const handles = Array.from(new Set(
    primary.summary.crossSell
      .map((entry: any) => entry?.relatedProductHandle)
      .filter((value: string | undefined) => Boolean(value))
  ));

  if (!handles.length) return { segments: [], quickReplies: [] };

  const products = await fetchProductsByHandles(supabaseAdmin, shopId, handles);
  if (!products.length) return { segments: [], quickReplies: [] };

  const reasonByHandle = new Map<string, string>();
  primary.summary.crossSell.forEach((entry: any) => {
    if (entry?.relatedProductHandle && entry?.reason) {
      reasonByHandle.set(entry.relatedProductHandle, entry.reason);
    }
  });

  const cards = products.slice(0, 3).map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price ?? 0,
    currency: product.currency ?? 'USD',
    image: product.image_url ?? null,
    badges: product.tags?.slice(0, 2),
    reason: reasonByHandle.get(product.handle) ?? 'Pairs well with your pick',
    handle: product.handle,
    variant_id: null,
    similarity: null,
  }));

  if (!cards.length) {
    return { segments: [], quickReplies: [] };
  }

  const quickReplies: QuickReply[] = cards.slice(0, 3).map((card, index) => ({
    id: card.id ?? `addon_${index}`,
    label: card.title.length > 22 ? `${card.title.slice(0, 19)}…` : card.title,
    value: card.title,
  }));

  return {
    segments: [
      {
        type: 'note',
        tone: 'info',
        variant: 'info',
        text: 'Most shoppers add these to complete the setup:',
      },
      {
        type: 'products',
        items: cards,
      },
    ],
    quickReplies,
  };
}

export async function buildBundleSegments(
  supabaseAdmin: any,
  shopId: string,
  primary: Product | undefined,
): Promise<Segment[]> {
  const upsell = primary?.summary?.upsell;
  if (!upsell || upsell.length === 0) {
    return [];
  }

  const handles = Array.from(new Set(
    upsell
      .map((entry: any) => entry?.relatedProductHandle)
      .filter((value: string | undefined) => Boolean(value))
  ));

  if (!handles.length) return [];

  const products = await fetchProductsByHandles(supabaseAdmin, shopId, handles);
  if (!products.length) return [];

  const reasonByHandle = new Map<string, string>();
  upsell.forEach((entry: any) => {
    if (entry?.relatedProductHandle && entry?.reason) {
      reasonByHandle.set(entry.relatedProductHandle, entry.reason);
    }
  });

  const cards = products.slice(0, 3).map((product) => ({
    id: product.id,
    title: product.title,
    price: product.price ?? 0,
    currency: product.currency ?? 'USD',
    image: product.image_url ?? null,
    badges: product.tags?.slice(0, 2),
    reason: reasonByHandle.get(product.handle) ?? 'Pairs nicely as an upgrade',
    handle: product.handle,
    variant_id: null,
    similarity: null,
    layout: 'cross_sell',
  }));

  if (!cards.length) {
    return [];
  }

  return [
    {
      type: 'note',
      tone: 'info',
      variant: 'info',
      text: 'Bundle it with these upgrades to round out your setup:',
    },
    {
      type: 'products',
      items: cards,
      layout: 'cross_sell',
    },
  ];
}

export const buildThresholdSegments = (
  threshold: number | null | undefined,
  primary: Product | undefined,
  addOnReplies: QuickReply[],
): Segment[] => {
  if (!threshold || !primary?.price) return [];

  const gap = Number(threshold) - (primary.price ?? 0);
  if (!Number.isFinite(gap) || gap <= 0 || gap > Math.max(25, threshold * 0.2)) {
    return [];
  }

  const formattedGap = gap >= 1 ? `$${gap.toFixed(2)}` : `${Math.round(gap * 100)}¢`;
  const segments: Segment[] = [
    {
      type: 'note',
      tone: 'info',
      variant: 'threshold',
      text: `Add ${formattedGap} more to unlock free shipping today.`,
    },
  ];

  if (addOnReplies.length) {
    segments.push({
      type: 'options',
      style: 'quick_replies',
      items: addOnReplies.slice(0, 3),
    });
  }

  return segments;
};

export const buildPolicyOfferSegments = (brandProfile: any): Segment[] => {
  if (!brandProfile?.policies) return [];

  const segments: Segment[] = [];
  const paymentOptions: string[] | undefined = brandProfile.policies.paymentOptions;
  if (paymentOptions?.length) {
    segments.push({
      type: 'offer',
      style: 'sweetener',
      title: 'Flexible ways to pay',
      text: `We support ${paymentOptions.slice(0, 3).join(', ')}${paymentOptions.length > 3 ? ' and more' : ''}.`,
    });
  }

  if (brandProfile.policies.guarantees) {
    segments.push({
      type: 'offer',
      style: 'anchor',
      title: 'Why this model stands out',
      text: brandProfile.policies.guarantees,
    });
  }

  if (brandProfile.policies.returns) {
    segments.push({
      type: 'offer',
      style: 'risk',
      title: 'Risk-free assurance',
      text: brandProfile.policies.returns,
    });
  }

  if (!segments.length && brandProfile.policies.shipping) {
    segments.push({
      type: 'offer',
      style: 'sweetener',
      text: brandProfile.policies.shipping,
    });
  }

  return segments;
};

const fetchProductsByHandles = async (
  supabaseAdmin: any,
  shopId: string,
  handles: string[]
): Promise<Product[]> => {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('id,title,description,price,currency,image_url,handle,vendor,product_type,tags,product_summaries(summary)')
    .eq('shop_id', shopId)
    .in('handle', handles);

  if (error) {
    console.warn('[conversation] failed to fetch cross-sell products', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    currency: row.currency,
    image_url: row.image_url,
    handle: row.handle,
    vendor: row.vendor,
    product_type: row.product_type,
    tags: row.tags ?? [],
    combined_score: null,
    variants: [],
    summary: Array.isArray(row.product_summaries)
      ? row.product_summaries[0]?.summary ?? null
      : row.product_summaries?.summary ?? null,
  }));
};

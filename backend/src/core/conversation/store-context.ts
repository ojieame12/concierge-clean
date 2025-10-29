import type { Product } from './types';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StoreContext {
  primaryCategory: string;
  categories: Array<{ name: string; count: number }>;
  topBrands: string[];
  priceRange: { min: number; max: number; median: number };
  storeType: string;
  totalProducts: number;
  factualSummary: string;
  policies?: StoreFacts['policies'];
  samplePrompts: string[];
}

export interface StoreFacts {
  whatWeSell: string;
  priceBands: Record<string, { min: number; max: number; median: number }>;
  valueProps: string[];
  policies: {
    shipping?: string;
    returns?: string;
    warranty?: string;
  };
  primaryCategory?: string;
  storeType?: string;
  topBrands?: string[];
  totalProducts?: number;
  samplePrompts?: string[];
  brandName?: string;
  greeting?: string;
}

/**
 * Extract store context from product catalog
 */
export function extractStoreContext(products: Product[]): StoreContext {
  if (!products.length) {
    return {
      primaryCategory: 'general merchandise',
      categories: [],
      topBrands: [],
      priceRange: { min: 0, max: 0, median: 0 },
      storeType: 'retail store',
      totalProducts: 0,
      factualSummary: 'A curated selection of products.',
      samplePrompts: [
        'Show me popular picks',
        'Help me find something within my budget',
        'What’s new this week?',
      ],
    };
  }

  // Count categories
  const categoryCount = new Map<string, number>();
  const brandCount = new Map<string, number>();
  const prices: number[] = [];

  products.forEach((product) => {
    // Category analysis
    const category = product.product_type || product.summary?.category || 'other';
    categoryCount.set(category, (categoryCount.get(category) || 0) + 1);

    // Brand analysis
    if (product.vendor) {
      brandCount.set(product.vendor, (brandCount.get(product.vendor) || 0) + 1);
    }

    // Price analysis
    if (product.price != null && product.price > 0) {
      prices.push(product.price);
    }
  });

  // Sort and get top categories
  const categories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  const primaryCategory = categories[0]?.name || 'products';

  // Get top brands (at least 2 products each)
  const topBrands = Array.from(brandCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([brand]) => brand);

  // Calculate price stats
  prices.sort((a, b) => a - b);
  const priceRange = {
    min: prices[0] || 0,
    max: prices[prices.length - 1] || 0,
    median: prices[Math.floor(prices.length / 2)] || 0,
  };

  // Determine store type based on primary category
  const storeType = inferStoreType(primaryCategory, categories);

  // Build factual summary
  const factualSummary = buildFactualSummary(
    primaryCategory,
    categories.slice(0, 4),
    topBrands.slice(0, 3),
    priceRange,
    products.length
  );

  const context: StoreContext = {
    primaryCategory,
    categories: categories.slice(0, 8),
    topBrands,
    priceRange,
    storeType,
    totalProducts: products.length,
    factualSummary,
    policies: {},
    samplePrompts: [],
  };

  context.samplePrompts = buildSamplePrompts(context);
  return context;
}

/**
 * Infer store type from categories
 */
function inferStoreType(primary: string, categories: Array<{ name: string; count: number }>): string {
  const lowerPrimary = primary.toLowerCase();

  // Check for specific store types
  if (lowerPrimary.includes('snowboard') || lowerPrimary.includes('ski')) {
    return 'winter sports equipment retailer';
  }
  if (lowerPrimary.includes('bike') || lowerPrimary.includes('bicycle')) {
    return 'cycling equipment store';
  }
  if (lowerPrimary.includes('clothing') || lowerPrimary.includes('apparel')) {
    return 'fashion and apparel retailer';
  }
  if (lowerPrimary.includes('electronics') || lowerPrimary.includes('computer')) {
    return 'electronics and technology store';
  }
  if (lowerPrimary.includes('furniture') || lowerPrimary.includes('home')) {
    return 'home and furniture store';
  }
  if (lowerPrimary.includes('jewelry') || lowerPrimary.includes('watch')) {
    return 'jewelry and accessories boutique';
  }
  if (lowerPrimary.includes('book') || lowerPrimary.includes('media')) {
    return 'books and media store';
  }
  if (lowerPrimary.includes('toy') || lowerPrimary.includes('game')) {
    return 'toys and games retailer';
  }
  if (lowerPrimary.includes('sport') || lowerPrimary.includes('fitness')) {
    return 'sporting goods store';
  }
  if (lowerPrimary.includes('beauty') || lowerPrimary.includes('cosmetic')) {
    return 'beauty and cosmetics store';
  }

  // Check if multi-category
  if (categories.length > 5) {
    return 'multi-category retail store';
  }

  return 'specialty retail store';
}

/**
 * Build a factual one-line summary of what the store sells
 */
function buildFactualSummary(
  primary: string,
  topCategories: Array<{ name: string; count: number }>,
  topBrands: string[],
  priceRange: { min: number; max: number },
  totalProducts: number
): string {
  const categoryList = topCategories
    .map((cat) => `${cat.name} (${cat.count})`)
    .join(', ');

  const brandPhrase = topBrands.length
    ? ` featuring ${topBrands.join(', ')}`
    : '';

  const pricePhrase = priceRange.min && priceRange.max
    ? ` from $${Math.round(priceRange.min)} to $${Math.round(priceRange.max)}`
    : '';

  return `We carry ${totalProducts} products across ${categoryList}${brandPhrase}${pricePhrase}.`;
}

const buildSamplePrompts = (context: Pick<StoreContext, 'primaryCategory' | 'priceRange' | 'topBrands'>): string[] => {
  const prompts = new Set<string>();
  const primary = context.primaryCategory && context.primaryCategory !== 'products'
    ? context.primaryCategory.toLowerCase()
    : 'products';

  prompts.add(`Show me popular ${primary}`);

  if (context.priceRange?.min && context.priceRange?.max && context.priceRange.max > context.priceRange.min) {
    const min = Math.round(context.priceRange.min);
    const max = Math.round(context.priceRange.max);
    prompts.add(`I’m shopping around $${min}–$${max}`);
  }

  if (context.topBrands?.length) {
    const brand = context.topBrands[0];
    prompts.add(`Do you carry ${brand} ${primary}?`);
  }

  prompts.add('Help me compare a couple of options');

  return Array.from(prompts).slice(0, 4);
};

/**
 * Fetch pre-computed store facts from database
 */
export async function fetchStoreFacts(
  supabaseAdmin: SupabaseClient,
  shopId: string
): Promise<StoreFacts | null> {
  const { data, error } = await supabaseAdmin
    .from('shops')
    .select('brand_profile')
    .eq('id', shopId)
    .single();

  if (error || !data?.brand_profile) {
    return null;
  }

  const profile = data.brand_profile as Record<string, any>;

  return {
    whatWeSell: profile.catalog_summary || 'A curated selection of quality products.',
    priceBands: profile.price_bands || {},
    valueProps: profile.value_props || [],
    policies: {
      shipping: profile.policies?.shipping,
      returns: profile.policies?.returns,
      warranty: profile.policies?.warranty,
    },
    primaryCategory: profile.primary_category,
    storeType: profile.store_type,
    topBrands: profile.top_brands,
    totalProducts: profile.total_products,
    samplePrompts: profile.sample_prompts,
    brandName: profile.brand_name,
    greeting: profile.brand_greeting,
  };
}

/**
 * Compute store facts on-demand from products
 */
async function computeStoreFactsLive(
  supabaseAdmin: SupabaseClient,
  shopId: string
): Promise<StoreFacts> {
  // Get a sample of products for quick computation
  const { data: products, count } = await supabaseAdmin
    .from('products')
    .select('product_type, vendor, price, tags', { count: 'exact' })
    .eq('shop_id', shopId)
    .limit(100);

  if (!products || products.length === 0) {
    return {
      whatWeSell: 'Quality products across multiple categories',
      priceBands: {},
      valueProps: [],
      policies: {},
      primaryCategory: undefined,
      storeType: 'retail store',
      topBrands: [],
      totalProducts: undefined, // undefined, not 0!
    };
  }

  // Quick computation from sample
  const categoryCount = new Map<string, number>();
  const vendorSet = new Set<string>();
  const prices: number[] = [];

  products.forEach((product: any) => {
    if (product.product_type) {
      categoryCount.set(product.product_type, (categoryCount.get(product.product_type) || 0) + 1);
    }
    if (product.vendor) {
      vendorSet.add(product.vendor);
    }
    if (product.price != null && product.price > 0) {
      prices.push(product.price);
    }
  });

  const categoryTuples = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1]);
  const categories = categoryTuples.map(([name, count]) => ({ name, count }));

  const primaryCategory = categoryTuples[0]?.[0];
  const topBrands = Array.from(vendorSet).slice(0, 5);

  prices.sort((a, b) => a - b);
  const priceMin = prices.length ? prices[0] : undefined;
  const priceMax = prices.length ? prices[prices.length - 1] : undefined;

  // Build factual summary WITHOUT counts if we don't have full data
  const parts: string[] = [];

  if (categories.length > 0) {
    const catList = categories.slice(0, 3).map(({ name }) => name).join(', ');
    parts.push(`We specialize in ${catList}`);
  }

  if (topBrands.length > 0) {
    parts.push(`featuring brands like ${topBrands.slice(0, 3).join(', ')}`);
  }

  if (typeof priceMin === 'number' && typeof priceMax === 'number') {
    parts.push(`with prices from $${Math.round(priceMin)} to $${Math.round(priceMax)}`);
  }

  return {
    whatWeSell: parts.join(', ') || 'A variety of quality products',
    priceBands: {},
    valueProps: [],
    policies: {},
    primaryCategory,
    storeType: inferStoreType(primaryCategory || '', categories),
    topBrands,
    totalProducts: count || undefined, // Use actual count or undefined
    samplePrompts: buildSamplePrompts({
      primaryCategory: primaryCategory || 'products',
      priceRange: {
        min: typeof priceMin === 'number' ? priceMin : 0,
        max: typeof priceMax === 'number' ? priceMax : 0,
        median: typeof priceMin === 'number' && typeof priceMax === 'number'
          ? Math.round((priceMin + priceMax) / 2)
          : 0,
      },
      topBrands,
    }),
  };
}

/**
 * Get store context with fallback to on-demand computation
 */
export async function getStoreContextSafe(
  supabaseAdmin: SupabaseClient,
  shopId: string,
  retrievedProducts?: Product[]
): Promise<StoreContext> {
  // If we have retrieved products, use them
  if (retrievedProducts && retrievedProducts.length > 0) {
    return extractStoreContext(retrievedProducts);
  }

  // Try to get stored facts
  const facts = await fetchStoreFacts(supabaseAdmin, shopId);

  // If we have good stored facts, use them
  if (facts && facts.totalProducts && facts.totalProducts > 0) {
    return {
      primaryCategory: facts.primaryCategory || 'products',
      categories: [],
      topBrands: facts.topBrands || [],
      priceRange: { min: 0, max: 0, median: 0 },
      storeType: facts.storeType || 'retail store',
      totalProducts: facts.totalProducts,
      factualSummary: facts.whatWeSell,
      policies: facts.policies,
      samplePrompts: facts.samplePrompts && facts.samplePrompts.length
        ? facts.samplePrompts
        : buildSamplePrompts({
            primaryCategory: facts.primaryCategory || 'products',
            priceRange: { min: 0, max: 0, median: 0 },
            topBrands: facts.topBrands || [],
          }),
    };
  }

  // Compute on-demand if stored facts are missing or empty
  const liveFacts = await computeStoreFactsLive(supabaseAdmin, shopId);

  return {
    primaryCategory: liveFacts.primaryCategory || 'products',
    categories: [],
    topBrands: liveFacts.topBrands || [],
    priceRange: { min: 0, max: 0, median: 0 },
    storeType: liveFacts.storeType || 'retail store',
    totalProducts: liveFacts.totalProducts ?? 0,
    factualSummary: liveFacts.whatWeSell,
    policies: liveFacts.policies,
    samplePrompts: liveFacts.samplePrompts && liveFacts.samplePrompts.length
      ? liveFacts.samplePrompts
      : buildSamplePrompts({
          primaryCategory: liveFacts.primaryCategory || 'products',
          priceRange: { min: 0, max: 0, median: 0 },
          topBrands: liveFacts.topBrands || [],
        }),
  };
}

/**
 * Pre-compute and store facts about the shop
 */
export async function computeAndStoreStoreFacts(
  supabaseAdmin: SupabaseClient,
  shopId: string,
  products: Product[]
): Promise<void> {
  const context = extractStoreContext(products);

  const samplePrompts = buildSamplePrompts(context);

  // Build price bands by category
  const priceBands: Record<string, { min: number; max: number; median: number }> = {};
  const categoryProducts = new Map<string, number[]>();

  products.forEach((product) => {
    if (product.price != null && product.price > 0) {
      const category = product.product_type || 'other';
      if (!categoryProducts.has(category)) {
        categoryProducts.set(category, []);
      }
      categoryProducts.get(category)!.push(product.price);
    }
  });

  categoryProducts.forEach((prices, category) => {
    prices.sort((a, b) => a - b);
    priceBands[category] = {
      min: Math.round(prices[0]),
      max: Math.round(prices[prices.length - 1]),
      median: Math.round(prices[Math.floor(prices.length / 2)]),
    };
  });

  // Update brand profile with computed facts
  const { error } = await supabaseAdmin
    .from('shops')
    .update({
      brand_profile: {
        catalog_summary: context.factualSummary,
        store_type: context.storeType,
        primary_category: context.primaryCategory,
        top_brands: context.topBrands,
        price_bands: priceBands,
        total_products: context.totalProducts,
        sample_prompts: samplePrompts,
        computed_at: new Date().toISOString(),
      },
    })
    .eq('id', shopId);

  if (error) {
    console.error('[store-context] Failed to store facts:', error);
  }
}

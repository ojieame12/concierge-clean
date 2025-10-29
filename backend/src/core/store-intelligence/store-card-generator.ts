/**
 * Store Card Generator
 * 
 * Generates condensed store profiles using Gemini to analyze
 * the store's catalog, brand profile, and positioning.
 */

import type { StoreCard, StoreCardGenerationContext } from './types';
import { generateText } from '../../infra/llm/gemini';

const STORE_CARD_GENERATION_PROMPT = `You are a retail intelligence analyst. Analyze the provided store information and generate a comprehensive Store Card.

**Store Information:**
- Store Name: {{store_name}}
- Domain: {{shop_domain}}
- Brand Profile: {{brand_profile}}

**Product Sample ({{product_count}} products):**
{{product_sample}}

**Task:** Generate a Store Card with the following information:

1. **Brand Voice & Tone:**
   - Personality (3-5 adjectives)
   - Tone (warm/neutral/professional/casual)
   - Formality level
   - Expertise level

2. **Mission & Positioning:**
   - Mission statement (1-2 sentences)
   - Target customer profile
   - Unique value proposition

3. **Policies:**
   - Returns (window, conditions, fees)
   - Shipping (free threshold, timing, options)
   - Warranty (standard coverage, extended options)
   - Price matching (if available)

4. **Merchandising:**
   - Preferred brands (from product sample)
   - Price positioning (budget/mid-range/premium/luxury)
   - Quality focus (value/balanced/premium)
   - Sustainability focus (yes/no)

5. **Categories:**
   - Primary product categories
   - Expertise areas (categories with deep selection)

6. **Customer Support:**
   - Hours of operation
   - Available channels
   - Expected response time

7. **FAQs (5-8 common questions):**
   - Shipping questions
   - Return questions
   - Warranty questions
   - General questions

**Output Format:** JSON matching the StoreCard schema.

**Guidelines:**
- Be specific and accurate
- Use the product sample to infer merchandising priorities
- Keep descriptions concise (1-2 sentences)
- Base policies on common e-commerce standards if not specified
- Ensure tone matches the brand profile`;

/**
 * Generate a Store Card from store context
 */
export async function generateStoreCard(
  context: StoreCardGenerationContext
): Promise<StoreCard> {
  // Prepare product sample summary
  const productSummary = context.product_sample
    .slice(0, 50) // Limit to 50 products
    .map(p => `- ${p.title} by ${p.vendor} ($${p.price}) [${p.product_type}]`)
    .join('\n');

  // Prepare prompt
  const prompt = STORE_CARD_GENERATION_PROMPT
    .replace('{{store_name}}', context.store_name)
    .replace('{{shop_domain}}', context.shop_domain)
    .replace('{{brand_profile}}', JSON.stringify(context.brand_profile || {}, null, 2))
    .replace('{{product_count}}', context.product_sample.length.toString())
    .replace('{{product_sample}}', productSummary);

  // Generate with Gemini
  const response = await generateText({
    prompt,
    temperature: 0.3, // Low temperature for consistency
    maxTokens: 2000,
  });

  // Parse JSON response
  let cardData: any;
  try {
    // Extract JSON from markdown code blocks if present
    const jsonMatch = response.match(/```json\n([\s\S]+?)\n```/);
    const jsonText = jsonMatch ? jsonMatch[1] : response;
    cardData = JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse Store Card JSON:', error);
    throw new Error('Failed to generate Store Card: Invalid JSON response');
  }

  // Construct Store Card with defaults
  const storeCard: StoreCard = {
    store_id: context.store_id,
    store_name: context.store_name,
    shop_domain: context.shop_domain,
    
    brand_voice: {
      personality: cardData.brand_voice?.personality || 'Helpful, professional',
      tone: cardData.brand_voice?.tone || 'neutral',
      formality: cardData.brand_voice?.formality || 'conversational',
      expertise_level: cardData.brand_voice?.expertise_level || 'intermediate',
    },
    
    mission: cardData.mission || `${context.store_name} provides quality products with excellent customer service.`,
    target_customer: cardData.target_customer || 'General consumers',
    unique_value_prop: cardData.unique_value_prop || 'Quality products at competitive prices',
    
    policies: {
      returns: {
        window_days: cardData.policies?.returns?.window_days || 30,
        conditions: cardData.policies?.returns?.conditions || 'Items must be in like-new condition',
        restocking_fee: cardData.policies?.returns?.restocking_fee || false,
        restocking_fee_amount: cardData.policies?.returns?.restocking_fee_amount,
      },
      shipping: {
        free_threshold: cardData.policies?.shipping?.free_threshold || 50,
        free_threshold_currency: cardData.policies?.shipping?.free_threshold_currency || 'USD',
        standard_time: cardData.policies?.shipping?.standard_time || '3-5 business days',
        expedited_available: cardData.policies?.shipping?.expedited_available ?? true,
        international: cardData.policies?.shipping?.international ?? false,
      },
      warranty: {
        standard: cardData.policies?.warranty?.standard || '1 year manufacturer warranty',
        extended_available: cardData.policies?.warranty?.extended_available ?? false,
      },
      price_match: {
        available: cardData.policies?.price_match?.available ?? false,
        conditions: cardData.policies?.price_match?.conditions,
      },
    },
    
    merchandising: {
      preferred_brands: cardData.merchandising?.preferred_brands || extractTopBrands(context.product_sample),
      price_positioning: cardData.merchandising?.price_positioning || inferPricePositioning(context.product_sample),
      quality_focus: cardData.merchandising?.quality_focus || 'balanced',
      sustainability_focus: cardData.merchandising?.sustainability_focus ?? false,
    },
    
    categories: {
      primary: cardData.categories?.primary || extractCategories(context.product_sample),
      expertise_areas: cardData.categories?.expertise_areas || [],
    },
    
    support: {
      hours: cardData.support?.hours || 'Mon-Fri 9am-6pm',
      channels: cardData.support?.channels || ['email', 'chat'],
      response_time: cardData.support?.response_time || 'Within 24 hours',
    },
    
    loyalty: cardData.loyalty,
    
    faqs: cardData.faqs || generateDefaultFAQs(context),
    
    generated_at: new Date().toISOString(),
    version: '1.0',
    ttl_days: 7, // Cache for 7 days
  };

  return storeCard;
}

/**
 * Extract top brands from product sample
 */
function extractTopBrands(products: StoreCardGenerationContext['product_sample']): string[] {
  const brandCounts = new Map<string, number>();
  
  for (const product of products) {
    const brand = product.vendor;
    brandCounts.set(brand, (brandCounts.get(brand) || 0) + 1);
  }
  
  return Array.from(brandCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([brand]) => brand);
}

/**
 * Infer price positioning from product sample
 */
function inferPricePositioning(
  products: StoreCardGenerationContext['product_sample']
): 'budget' | 'mid-range' | 'premium' | 'luxury' {
  if (products.length === 0) return 'mid-range';
  
  const avgPrice = products.reduce((sum, p) => sum + p.price, 0) / products.length;
  
  if (avgPrice < 50) return 'budget';
  if (avgPrice < 200) return 'mid-range';
  if (avgPrice < 1000) return 'premium';
  return 'luxury';
}

/**
 * Extract categories from product sample
 */
function extractCategories(products: StoreCardGenerationContext['product_sample']): string[] {
  const categories = new Set<string>();
  
  for (const product of products) {
    if (product.product_type) {
      categories.add(product.product_type);
    }
  }
  
  return Array.from(categories).slice(0, 10);
}

/**
 * Generate default FAQs
 */
function generateDefaultFAQs(context: StoreCardGenerationContext): StoreCard['faqs'] {
  return [
    {
      question: 'What is your return policy?',
      answer: 'Items can be returned within 30 days in like-new condition. No restocking fees apply.',
      category: 'returns',
    },
    {
      question: 'Do you offer free shipping?',
      answer: 'Yes, we offer free standard shipping on orders over $50.',
      category: 'shipping',
    },
    {
      question: 'How long does shipping take?',
      answer: 'Standard shipping typically takes 3-5 business days.',
      category: 'shipping',
    },
    {
      question: 'What warranty do products come with?',
      answer: 'All products come with a 1-year manufacturer warranty.',
      category: 'warranty',
    },
    {
      question: 'How can I contact customer support?',
      answer: 'You can reach us via email or live chat Monday-Friday, 9am-6pm. We respond within 24 hours.',
      category: 'general',
    },
  ];
}

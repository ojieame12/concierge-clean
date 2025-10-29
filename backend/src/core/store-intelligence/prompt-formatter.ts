/**
 * Store Card Prompt Formatter
 * 
 * Formats Store Card data for inclusion in Gemini system prompts.
 */

import type { StoreCard } from './types';

/**
 * Format Store Card for Gemini system prompt
 * 
 * Creates a concise, structured representation of the store
 * that fits within the system prompt context.
 */
export function formatStoreCardForPrompt(card: StoreCard): string {
  const sections: string[] = [];

  // Store identity and mission
  sections.push(`**Store: ${card.store_name}**`);
  sections.push(`Mission: ${card.mission}`);
  sections.push(`Target Customer: ${card.target_customer}`);
  sections.push(`Value Proposition: ${card.unique_value_prop}`);
  sections.push('');

  // Brand voice
  sections.push(`**Brand Voice:**`);
  sections.push(`- Personality: ${card.brand_voice.personality}`);
  sections.push(`- Tone: ${card.brand_voice.tone}, ${card.brand_voice.formality}`);
  sections.push(`- Expertise: ${card.brand_voice.expertise_level}`);
  sections.push('');

  // Policies
  sections.push(`**Policies:**`);
  sections.push(`Returns: ${card.policies.returns.window_days} days, ${card.policies.returns.conditions}${card.policies.returns.restocking_fee ? `, restocking fee: ${card.policies.returns.restocking_fee_amount}` : ', no restocking fee'}`);
  
  const shippingThreshold = card.policies.shipping.free_threshold
    ? `Free shipping over $${card.policies.shipping.free_threshold}`
    : 'Paid shipping';
  sections.push(`Shipping: ${shippingThreshold}, ${card.policies.shipping.standard_time}`);
  
  sections.push(`Warranty: ${card.policies.warranty.standard}`);
  
  if (card.policies.price_match.available) {
    sections.push(`Price Match: Available${card.policies.price_match.conditions ? ` (${card.policies.price_match.conditions})` : ''}`);
  }
  sections.push('');

  // Merchandising priorities
  sections.push(`**Merchandising:**`);
  sections.push(`- Price Positioning: ${card.merchandising.price_positioning}`);
  sections.push(`- Quality Focus: ${card.merchandising.quality_focus}`);
  if (card.merchandising.preferred_brands.length > 0) {
    sections.push(`- Preferred Brands: ${card.merchandising.preferred_brands.slice(0, 5).join(', ')}`);
  }
  if (card.merchandising.sustainability_focus) {
    sections.push(`- Sustainability: Emphasized`);
  }
  sections.push('');

  // Categories
  if (card.categories.primary.length > 0) {
    sections.push(`**Primary Categories:** ${card.categories.primary.slice(0, 8).join(', ')}`);
  }
  if (card.categories.expertise_areas.length > 0) {
    sections.push(`**Expertise Areas:** ${card.categories.expertise_areas.join(', ')}`);
  }
  sections.push('');

  // Support
  sections.push(`**Customer Support:**`);
  sections.push(`- Hours: ${card.support.hours}`);
  sections.push(`- Channels: ${card.support.channels.join(', ')}`);
  sections.push(`- Response Time: ${card.support.response_time}`);
  sections.push('');

  // Loyalty program
  if (card.loyalty) {
    sections.push(`**Loyalty Program: ${card.loyalty.program_name}**`);
    sections.push(`Benefits: ${card.loyalty.benefits.join(', ')}`);
    sections.push('');
  }

  // FAQs (top 5)
  if (card.faqs.length > 0) {
    sections.push(`**Common Questions:**`);
    card.faqs.slice(0, 5).forEach(faq => {
      sections.push(`Q: ${faq.question}`);
      sections.push(`A: ${faq.answer}`);
      sections.push('');
    });
  }

  return sections.join('\n');
}

/**
 * Format Store Card for conversation context (shorter version)
 */
export function formatStoreCardForContext(card: StoreCard): string {
  const sections: string[] = [];

  sections.push(`Store: ${card.store_name}`);
  sections.push(`Voice: ${card.brand_voice.personality} (${card.brand_voice.tone})`);
  sections.push(`Returns: ${card.policies.returns.window_days} days`);
  
  const shippingThreshold = card.policies.shipping.free_threshold
    ? `Free over $${card.policies.shipping.free_threshold}`
    : 'Paid';
  sections.push(`Shipping: ${shippingThreshold}`);
  
  if (card.merchandising.preferred_brands.length > 0) {
    sections.push(`Priority Brands: ${card.merchandising.preferred_brands.slice(0, 3).join(', ')}`);
  }

  return sections.join(' | ');
}

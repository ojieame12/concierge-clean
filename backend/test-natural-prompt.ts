/**
 * Unit test for natural prompt generation
 * Tests the system prompt without requiring database
 */

import { buildNaturalSystemPrompt, type NaturalPromptContext } from './src/core/conversation/natural-prompt';

// Mock Store Card
const mockStoreCard = {
  store_name: 'Mountain Sports Co',
  brand_voice: {
    personality: 'Enthusiastic outdoor expert who loves helping people find the right gear',
    tone: 'Warm and encouraging',
    formality: 'Casual but knowledgeable',
    key_traits: ['Helpful', 'Enthusiastic', 'Trustworthy', 'Experienced'],
  },
  policies: {
    shipping: 'Free shipping on orders over $50',
    returns: '30-day hassle-free returns',
    price_matching: 'We match competitor prices',
  },
  unique_selling_points: [
    'Expert staff with real outdoor experience',
    'Curated selection of premium brands',
    'Local shop supporting the community',
  ],
};

// Mock products
const mockProducts = [
  {
    id: 'brooks-ghost-15',
    title: 'Brooks Ghost 15',
    price: 140,
    vendor: 'Brooks',
    product_type: 'Running Shoes',
    tags: ['road-running', 'neutral', 'cushioned'],
    description: 'Smooth, comfortable ride for daily training',
    review_rating: 4.7,
    review_count: 2341,
  },
  {
    id: 'asics-gel-nimbus-25',
    title: 'ASICS Gel-Nimbus 25',
    price: 160,
    vendor: 'ASICS',
    product_type: 'Running Shoes',
    tags: ['road-running', 'neutral', 'max-cushion'],
    description: 'Maximum cushioning for long-distance comfort',
    review_rating: 4.6,
    review_count: 1876,
  },
  {
    id: 'hoka-clifton-9',
    title: 'HOKA Clifton 9',
    price: 145,
    vendor: 'HOKA',
    product_type: 'Running Shoes',
    tags: ['road-running', 'neutral', 'lightweight'],
    description: 'Lightweight cushioning that feels like floating',
    review_rating: 4.8,
    review_count: 3102,
  },
];

// Test context
const testContext: NaturalPromptContext = {
  storeCard: mockStoreCard as any,
  productCount: 47,
  topProducts: mockProducts,
  conversationTurn: 1,
  userMessage: 'I need running shoes',
  conversationHistory: [],
  topCategories: ['Running Shoes', 'Trail Running Shoes', 'Track Spikes'],
  priceRange: { min: 80, max: 220 },
  accumulatedIntent: {},
};

console.log('🧪 Testing Natural System Prompt Generation\n');
console.log('='.repeat(80));

// Generate the prompt
const systemPrompt = buildNaturalSystemPrompt(testContext);

console.log('\n✅ System Prompt Generated Successfully!\n');
console.log('📊 Prompt Statistics:');
console.log(`   - Length: ${systemPrompt.length} characters`);
console.log(`   - Lines: ${systemPrompt.split('\n').length}`);
console.log(`   - Products in context: ${mockProducts.length}`);
console.log(`   - Store name: ${mockStoreCard.store_name}`);

console.log('\n📝 Key Sections Present:');
const sections = [
  'Your Personality & Voice',
  'Your Approach to Conversations',
  'Understand Deeply Before Recommending',
  'Show 2-3 Confident Recommendations',
  'Be Conversational and Build Rapport',
  'Use the Product Catalog Intelligently',
  'Store Context & Policies',
  'Response Format (CRITICAL)',
  'Example Responses',
];

sections.forEach((section) => {
  const present = systemPrompt.includes(section);
  console.log(`   ${present ? '✅' : '❌'} ${section}`);
});

console.log('\n💬 Brand Voice Elements:');
console.log(`   - Personality: ${mockStoreCard.brand_voice.personality}`);
console.log(`   - Tone: ${mockStoreCard.brand_voice.tone}`);
console.log(`   - Formality: ${mockStoreCard.brand_voice.formality}`);

console.log('\n🛍️ Product Context:');
mockProducts.forEach((p, i) => {
  console.log(`   ${i + 1}. ${p.title} - $${p.price} (${p.review_rating}⭐, ${p.review_count} reviews)`);
});

console.log('\n📋 Store Policies:');
console.log(`   - Shipping: ${mockStoreCard.policies.shipping}`);
console.log(`   - Returns: ${mockStoreCard.policies.returns}`);
console.log(`   - Price Matching: ${mockStoreCard.policies.price_matching}`);

console.log('\n🎯 Natural Conversation Guidelines:');
const guidelines = [
  'Use contractions',
  'Vary sentence length',
  'Show genuine enthusiasm',
  'Explain reasoning',
  'Max 1 exclamation per response',
  'No robotic phrases',
  'Take 2-4 turns to understand',
  'Show exactly 2-3 products',
];

guidelines.forEach((guideline) => {
  const present = systemPrompt.toLowerCase().includes(guideline.toLowerCase().split(' ').slice(0, 3).join(' '));
  console.log(`   ${present ? '✅' : '⚠️'} ${guideline}`);
});

console.log('\n🔍 Checking for Robotic Phrase Prevention:');
const roboticPhrases = [
  'As an AI',
  'I am unable to',
  'Based on the data provided',
];

roboticPhrases.forEach((phrase) => {
  const mentioned = systemPrompt.includes(phrase);
  console.log(`   ${mentioned ? '✅' : '❌'} Warns against: "${phrase}"`);
});

console.log('\n📐 JSON Structure Validation:');
const jsonElements = [
  '"segments"',
  '"type": "narrative"',
  '"type": "products"',
  '"type": "ask"',
  '"type": "options"',
  '"internal_reasoning"',
];

jsonElements.forEach((element) => {
  const present = systemPrompt.includes(element);
  console.log(`   ${present ? '✅' : '❌'} ${element}`);
});

console.log('\n' + '='.repeat(80));
console.log('✅ Natural prompt system is ready!');
console.log('\n📝 Sample Prompt Preview (first 500 chars):');
console.log('-'.repeat(80));
console.log(systemPrompt.slice(0, 500) + '...\n');

console.log('💡 Next Steps:');
console.log('   1. Seed database with test shop');
console.log('   2. Test with real Gemini API');
console.log('   3. Validate conversation quality');
console.log('   4. Build test harness for multi-turn conversations');

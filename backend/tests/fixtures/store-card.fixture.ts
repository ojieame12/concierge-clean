/**
 * Store Card Test Fixtures
 */

import type { StoreCard } from '../../src/core/store-intelligence/types';

export const mockStoreCard: StoreCard = {
  store_name: 'Test Outdoor Gear',
  domain: 'test-outdoor-gear.com',
  brand_voice: {
    personality: 'Friendly, knowledgeable, adventurous',
    tone: 'casual',
    formality: 'medium',
    expertise_level: 'expert',
  },
  mission: 'Equipping adventurers with high-quality outdoor gear for every expedition',
  positioning: 'Premium outdoor equipment for serious adventurers',
  policies: {
    returns: {
      window_days: 30,
      conditions: 'Unused items in original packaging',
      exceptions: ['Safety equipment', 'Personalized items'],
    },
    shipping: {
      free_threshold: 75,
      standard_cost: 8.99,
      standard_days: '5-7',
      expedited_available: true,
      expedited_cost: 19.99,
      expedited_days: '2-3',
    },
    warranty: {
      standard_months: 12,
      lifetime_categories: ['Backpacks', 'Tents'],
    },
    price_matching: {
      enabled: true,
      conditions: 'Within 14 days of purchase, authorized retailers only',
    },
  },
  merchandising: {
    priority_brands: ['Patagonia', 'The North Face', 'Arc\'teryx', 'Black Diamond'],
    price_positioning: 'premium',
    quality_focus: 'durability',
    sustainability_focus: true,
  },
  categories: {
    primary: ['Camping', 'Hiking', 'Climbing', 'Backpacking'],
    secondary: ['Trail Running', 'Winter Sports', 'Water Sports'],
  },
  expertise_areas: [
    'High-altitude mountaineering',
    'Multi-day backpacking',
    'Technical climbing',
    'Ultralight gear',
  ],
  customer_support: {
    hours: 'Mon-Fri 9am-6pm EST',
    channels: ['phone', 'email', 'live_chat'],
    response_time: 'Within 2 hours during business hours',
  },
  faqs: [
    {
      question: 'What is your return policy?',
      answer: 'We accept returns within 30 days for unused items in original packaging. Safety equipment and personalized items cannot be returned.',
    },
    {
      question: 'Do you offer free shipping?',
      answer: 'Yes, we offer free standard shipping on orders over $75. Standard shipping takes 5-7 business days.',
    },
    {
      question: 'What brands do you carry?',
      answer: 'We carry premium outdoor brands including Patagonia, The North Face, Arc\'teryx, and Black Diamond, among others.',
    },
    {
      question: 'Do you have a warranty?',
      answer: 'All products come with a 12-month warranty. Backpacks and tents have a lifetime warranty.',
    },
    {
      question: 'Can I get expert advice on gear selection?',
      answer: 'Absolutely! Our team has extensive experience in mountaineering, backpacking, and climbing. Contact us for personalized recommendations.',
    },
  ],
};

export const mockStoreCardMinimal: StoreCard = {
  store_name: 'Test Store',
  domain: 'test-store.com',
  brand_voice: {
    personality: 'Professional, helpful',
    tone: 'professional',
    formality: 'high',
    expertise_level: 'intermediate',
  },
  mission: 'Providing quality products',
  positioning: 'Mid-range retailer',
  policies: {
    returns: {
      window_days: 30,
      conditions: 'Standard return policy',
    },
    shipping: {
      free_threshold: 50,
      standard_cost: 5.99,
      standard_days: '3-5',
    },
  },
  merchandising: {
    priority_brands: [],
    price_positioning: 'mid-range',
    quality_focus: 'value',
  },
  categories: {
    primary: ['General Merchandise'],
  },
  expertise_areas: [],
  customer_support: {
    hours: 'Mon-Fri 9am-5pm',
    channels: ['email'],
    response_time: 'Within 24 hours',
  },
  faqs: [],
};

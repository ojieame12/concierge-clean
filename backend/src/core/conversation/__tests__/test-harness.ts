/**
 * Hermetic Test Harness
 *
 * Provides fully-stubbed dependencies for testing the conversation pipeline
 * without requiring live Supabase, Gemini, or other external services.
 *
 * Key principles:
 * - NO live API calls
 * - Deterministic outputs
 * - Fast execution (<100ms per test)
 * - Realistic data structure
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ChatTurn, Segment } from '@insite/shared-types';
import { runConversationPipeline } from '../pipeline';
import type { ConversationMessage } from '../../../types/conversation';
import type { SessionMetadata } from '../../session/session-store';

/**
 * Realistic product catalog for testing
 */
const SNOWBOARD_CATALOG = [
  {
    id: 'sb_001',
    title: 'The Powder Pro',
    description: 'All-mountain freestyle board with medium flex',
    price: 549.95,
    currency: 'USD',
    vendor: 'Burton',
    product_type: 'snowboard',
    tags: ['all-mountain', 'intermediate', 'freestyle'],
    handle: 'powder-pro',
    image_url: 'https://example.com/powder-pro.jpg',
    combined_score: 0.92,
    summary: {
      category: 'all-mountain',
      styleDescriptors: ['versatile', 'playful'],
      useCases: ['groomers', 'park'],
      bestFor: ['intermediate', 'all-mountain']
    }
  },
  {
    id: 'sb_002',
    title: 'The Carver Elite',
    description: 'Directional board for aggressive carving',
    price: 679.95,
    currency: 'USD',
    vendor: 'Lib Tech',
    product_type: 'snowboard',
    tags: ['all-mountain', 'advanced', 'carving'],
    handle: 'carver-elite',
    image_url: 'https://example.com/carver.jpg',
    combined_score: 0.89,
    summary: {
      category: 'all-mountain',
      styleDescriptors: ['aggressive', 'responsive'],
      useCases: ['carving', 'groomers'],
      bestFor: ['advanced', 'carving']
    }
  },
  {
    id: 'sb_003',
    title: 'The Beginner Basic',
    description: 'Forgiving twin-tip for new riders',
    price: 329.95,
    currency: 'USD',
    vendor: 'Burton',
    product_type: 'snowboard',
    tags: ['all-mountain', 'beginner', 'twin-tip'],
    handle: 'beginner-basic',
    image_url: 'https://example.com/basic.jpg',
    combined_score: 0.85,
    summary: {
      category: 'all-mountain',
      styleDescriptors: ['forgiving', 'stable'],
      useCases: ['learning', 'groomers'],
      bestFor: ['beginner', 'all-mountain']
    }
  },
  {
    id: 'sb_004',
    title: 'The Park Master',
    description: 'True freestyle board for rails and jumps',
    price: 449.95,
    currency: 'USD',
    vendor: 'Ride',
    product_type: 'snowboard',
    tags: ['freestyle', 'intermediate', 'park'],
    handle: 'park-master',
    image_url: 'https://example.com/park.jpg',
    combined_score: 0.82,
    summary: {
      category: 'freestyle',
      styleDescriptors: ['playful', 'poppy'],
      useCases: ['park', 'rails'],
      bestFor: ['intermediate', 'freestyle']
    }
  },
];

/**
 * Stub Supabase client with realistic responses
 */
export function createSupabaseStub(): SupabaseClient {
  const rpc = async (fnName: string, params?: any) => {
    if (fnName === 'search_products_hybrid') {
      // Return filtered results based on params
      let results = [...SNOWBOARD_CATALOG];

      // Apply price filter
      if (params?.p_min_price) {
        results = results.filter(p => p.price >= params.p_min_price);
      }
      if (params?.p_max_price) {
        results = results.filter(p => p.price <= params.p_max_price);
      }

      // Limit results
      const limit = params?.p_limit || 12;
      results = results.slice(0, limit);

      return { data: results, error: null };
    }

    return { data: [], error: null };
  };

  const from = (table: string) => {
    switch (table) {
      case 'shops':
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: {
                  id: 'test_shop',
                  shop_domain: 'test-shop.myshopify.com',
                  access_token: 'test-token',
                  brand_profile: {
                    catalog_summary: 'We carry 17 products across snowboard (14), Other (1), giftcard (1)',
                    store_type: 'winter sports equipment retailer',
                    primary_category: 'snowboard',
                    top_brands: ['Burton', 'Lib Tech', 'Ride'],
                    price_bands: {
                      snowboard: { min: 329, max: 679, median: 499 }
                    },
                    total_products: 17,
                    policies: {
                      shipping: 'Free shipping over $99 with 1-2 business day dispatch.',
                      returns: '30-day returns on unused gear and exchanges in 14 days.',
                      warranty: 'Manufacturer warranty varies by brand; most boards carry a 1-year warranty.',
                    },
                    computed_at: new Date().toISOString()
                  }
                },
                error: null
              })
            })
          })
        };

      case 'product_variants':
        return {
          select: () => ({
            in: async () => ({
              data: [],
              error: null
            })
          })
        };

      case 'sessions':
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null, error: null })
            })
          }),
          upsert: async () => ({ error: null })
        };

      default:
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [], error: null }),
              single: async () => ({ data: null, error: null })
            }),
            in: async () => ({ data: [], error: null })
          }),
          insert: async () => ({ data: null, error: null }),
          upsert: async () => ({ data: null, error: null })
        };
    }
  };

  return { rpc, from } as unknown as SupabaseClient;
}

/**
 * Mock Gemini client with canned responses
 */
export function createGeminiStub() {
  return {
    generateContent: async (params: any) => {
      const prompt = params?.contents?.[0]?.parts?.[0]?.text || '';

      // Return appropriate canned response based on prompt
      if (prompt.includes('definition') || prompt.includes('what are')) {
        return {
          response: {
            text: () => JSON.stringify({
              lead: 'Snowboards are specialized boards designed for gliding down snow-covered slopes.',
              detail: 'They feature bindings that secure your boots to the board, allowing you to carve turns and perform tricks.'
            })
          }
        };
      }

      if (prompt.includes('store') || prompt.includes('sell')) {
        return {
          response: {
            text: () => JSON.stringify({
              lead: 'We\'re a winter sports equipment retailer specializing in snowboards.',
              detail: 'Our curated collection features top brands like Burton, Lib Tech, and Ride with expert guidance to help you find the perfect setup.'
            })
          }
        };
      }

      // Default consultative response
      return {
        response: {
          text: () => JSON.stringify({
            lead: 'I can help you find the perfect snowboard for your riding style.',
            detail: 'Let me ask you a few questions to narrow down the options and find your ideal match.'
          })
        }
      };
    }
  };
}

/**
 * Create fully-stubbed pipeline dependencies
 */
export function createTestDependencies() {
  return {
    supabaseAdmin: createSupabaseStub(),
    generateEmbedding: async () => new Array(1536).fill(0.1),
  };
}

/**
 * Base session metadata for tests
 */
export const BASE_SESSION: SessionMetadata = {
  askedSlots: [],
  clarifierHistory: {},
  zeroResultStreak: 0,
  turnCount: 0,
  lastTone: 'neutral',
  activeFilters: {},
  pendingClarifier: null,
  manualClarifier: null,
  negotiationState: null,
  accumulatedIntent: {},
  rejectedProductIds: [],
  acceptedProductIds: [],
};

/**
 * Helper to build message history
 */
export function buildMessages(texts: string[]): ConversationMessage[] {
  return texts.map((text, i) => ({
    id: `msg_${i}`,
    role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: text,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Hermetic test pipeline runner
 */
export async function runTestPipeline(
  userMessages: string[],
  sessionOverride?: Partial<SessionMetadata>,
  resultLimit: number = 3  // CONCIERGE DEFAULT
) {
  const deps = createTestDependencies();

  return runConversationPipeline(
    deps as any,
    {
      shopId: 'test_shop',
      sessionId: `test_${Date.now()}`,
      messages: buildMessages(userMessages),
      sessionMetadata: { ...BASE_SESSION, ...sessionOverride },
      brandProfile: {
        tone: 'warm, consultative',
        persona: 'expert concierge',
        policies: {
          freeShippingThreshold: 99,
          shippingPolicy: 'Free shipping on orders over $99',
          returnsPolicy: '30-day returns on unopened items'
        }
      },
      resultLimit
    }
  );
}

/**
 * Validation helpers
 */
export function expectFullSentence(text: string, minWords: number = 6) {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  expect(words).toBeGreaterThanOrEqual(minWords);
  expect(/[.!?]$/.test(text.trim())).toBe(true);
  expect(text).not.toMatch(/^(Great!|Perfect!|Awesome!|Sure!|Yes!|No!)$/);
}

export function expectMaxThreeProducts(segments: Segment[]) {
  const productSegments = segments.filter(s => s.type === 'products');

  productSegments.forEach(segment => {
    if ('items' in segment) {
      expect((segment as any).items.length).toBeLessThanOrEqual(3);
    }
  });
}

export function expectClarifyBeforeProducts(segments: Segment[], clarifierHistory: Record<string, number>) {
  const hasProducts = segments.some(s => s.type === 'products');
  const hasAsk = segments.some(s => s.type === 'ask');

  // If showing products, must have either:
  // 1. A clarifying question in this turn (show-then-ask)
  // 2. OR answered clarifiers in history (already clarified)
  if (hasProducts) {
    const hasAnsweredClarifiers = Object.keys(clarifierHistory).length > 0;
    expect(hasAsk || hasAnsweredClarifiers).toBe(true);
  }
}

export function expectConsultativeLanguage(text: string) {
  const lower = text.toLowerCase();

  // Must use You/We language
  const hasYouLanguage = /\b(you|your|we|our|us)\b/.test(lower);
  expect(hasYouLanguage).toBe(true);

  // Should avoid promotional hype
  expect(text).not.toMatch(/\b(amazing|incredible|unbelievable|revolutionary)\b/i);

  // Should not use I/My excessively
  const iCount = (lower.match(/\b(i|my|me)\b/g) || []).length;
  const youCount = (lower.match(/\b(you|your|we|our)\b/g) || []).length;
  expect(youCount).toBeGreaterThan(iCount);
}

// Make expect available
declare const expect: any;

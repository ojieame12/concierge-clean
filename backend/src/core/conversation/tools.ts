/**
 * Tool Implementations for Gemini Orchestrator
 * 
 * These wrap existing search, store, and inventory systems
 * so Gemini can call them as functions.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { runHybridSearch } from '../search/hybrid-search';
import type {
  SearchProductsArgs,
  GetDetailsArgs,
  CheckInventoryArgs,
  GetStoreInfoArgs,
  GetPolicyArgs,
  ToolImplementations,
} from './orchestrator';

export function createTools(
  supabaseAdmin: SupabaseClient,
  generateEmbedding: (text: string) => Promise<number[]>,
  shopId: string
): ToolImplementations {
  return {
    // ========================================================================
    // Product Search
    // ========================================================================
    async searchProducts(args: SearchProductsArgs) {
      try {
        const { query = '', constraints = {}, limit = 6 } = args;
        
        // Generate embedding for semantic search
        const embedding = query ? await generateEmbedding(query) : null;

        // Run hybrid search
        const results = await runHybridSearch(
          { supabaseAdmin },
          {
            shopId,
            embedding,
            lexicalQuery: query,
            filters: {
              minPrice: constraints.priceMin,
              maxPrice: constraints.priceMax,
            },
            limit,
          }
        );

        // Return simplified product list
        return {
          products: results.products.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            vendor: p.vendor,
            price: p.price,
            image: p.image_url,
            available: p.available,
          })),
          count: results.products.length,
        };
      } catch (error) {
        console.error('searchProducts error:', error);
        return { products: [], count: 0, error: 'Search failed' };
      }
    },

    // ========================================================================
    // Product Details
    // ========================================================================
    async getProductDetails(args: GetDetailsArgs) {
      try {
        const { ids } = args;

        const { data: products, error } = await supabaseAdmin
          .from('products')
          .select(`
            id,
            title,
            description,
            vendor,
            product_type,
            tags,
            product_variants (
              id,
              title,
              price,
              compare_at_price,
              inventory_quantity,
              available
            )
          `)
          .in('id', ids)
          .eq('shop_id', shopId);

        if (error) throw error;

        return {
          products: products?.map(p => ({
            id: p.id,
            title: p.title,
            description: p.description,
            vendor: p.vendor,
            type: p.product_type,
            tags: p.tags,
            variants: p.product_variants,
          })) || [],
        };
      } catch (error) {
        console.error('getProductDetails error:', error);
        return { products: [], error: 'Failed to get details' };
      }
    },

    // ========================================================================
    // Inventory Check
    // ========================================================================
    async checkInventory(args: CheckInventoryArgs) {
      try {
        const { ids } = args;

        const { data: variants, error } = await supabaseAdmin
          .from('product_variants')
          .select('product_id, inventory_quantity, available')
          .in('product_id', ids);

        if (error) throw error;

        // Aggregate by product
        const inventory = ids.map(id => {
          const productVariants = variants?.filter(v => v.product_id === id) || [];
          const totalStock = productVariants.reduce((sum, v) => sum + (v.inventory_quantity || 0), 0);
          const anyAvailable = productVariants.some(v => v.available);

          return {
            productId: id,
            inStock: anyAvailable,
            quantity: totalStock,
            status: anyAvailable ? 'available' : 'out_of_stock',
          };
        });

        return { inventory };
      } catch (error) {
        console.error('checkInventory error:', error);
        return { inventory: [], error: 'Failed to check inventory' };
      }
    },

    // ========================================================================
    // Store Info
    // ========================================================================
    async getStoreInfo(args: GetStoreInfoArgs) {
      try {
        // Fetch store card
        const { fetchStoreCard } = await import('../store-intelligence');
        const storeCard = await fetchStoreCard(shopId);

        return {
          name: storeCard.store_name,
          description: storeCard.store_description,
          brandVoice: storeCard.brand_voice,
          specialties: storeCard.specialties,
        };
      } catch (error) {
        console.error('getStoreInfo error:', error);
        return {
          name: 'Store',
          description: 'B2B commerce platform',
          error: 'Store info unavailable',
        };
      }
    },

    // ========================================================================
    // Policy Info
    // ========================================================================
    async getPolicy(args: GetPolicyArgs) {
      try {
        const { topic } = args;

        // Fetch store card for policy info
        const { fetchStoreCard } = await import('../store-intelligence');
        const storeCard = await fetchStoreCard(shopId);

        const policies = storeCard.policies || {};

        switch (topic) {
          case 'returns':
            return {
              topic: 'returns',
              policy: policies.returns || 'Contact us for return policy details.',
            };
          case 'shipping':
            return {
              topic: 'shipping',
              policy: policies.shipping || 'Standard shipping available.',
            };
          case 'warranty':
            return {
              topic: 'warranty',
              policy: policies.warranty || 'Manufacturer warranty applies.',
            };
          default:
            return {
              topic,
              policy: 'Policy information not available.',
            };
        }
      } catch (error) {
        console.error('getPolicy error:', error);
        return {
          topic: args.topic,
          policy: 'Policy information unavailable.',
          error: 'Failed to fetch policy',
        };
      }
    },
  };
}

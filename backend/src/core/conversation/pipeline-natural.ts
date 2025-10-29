/**
 * Natural Conversation Pipeline
 * 
 * A simplified, Gemini-first conversation pipeline that trusts the LLM's intelligence
 * to control conversation flow while maintaining structured output.
 * 
 * Key differences from original pipeline:
 * - No mechanical conversation policy (entropy, facet selection)
 * - No template-based copy generation
 * - Gemini decides when to ask vs show
 * - Gemini generates segment structure directly
 * - Focus on natural, human-like conversation
 */

import type { ChatTurn, Segment, QuickReply, ProductCard } from '@insite/shared-types';
import { chatModel } from '../../infra/llm/gemini';
import { buildNaturalSystemPrompt, buildInfoModePrompt, type NaturalPromptContext } from './natural-prompt';
import { extractIntent, type AccumulatedIntent } from './intent-extractor';
import { classifyTopic, type TurnTopic } from './routing-gates';
import { runHybridSearch, type HybridSearchDependencies } from '../search/hybrid-search';
import { rerankProducts, type RankingContext } from '../ranking/reranker';
import type { ConversationMessage } from '../../types/conversation';
import type { SessionMetadata } from '../session/session-store';

export interface NaturalPipelineInput {
  shopId: string;
  sessionId: string;
  messages: ConversationMessage[];
  sessionMetadata: SessionMetadata;
  brandProfile?: any;
  resultLimit?: number;
}

export interface NaturalPipelineResult {
  pepTurn: ChatTurn;
  userMessage: string;
  accumulatedIntent: AccumulatedIntent;
  conversationTurn: number;
}

/**
 * Validate and parse Gemini's JSON response
 */
function parseGeminiResponse(rawText: string): { segments: Segment[] } {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonText = rawText.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      throw new Error('Response missing segments array');
    }

    // Validate segment types
    const validTypes = ['narrative', 'products', 'ask', 'options', 'evidence', 'note', 'chips', 'comparison', 'offer'];
    for (const segment of parsed.segments) {
      if (!validTypes.includes(segment.type)) {
        console.warn(`Unknown segment type: ${segment.type}`);
      }
    }

    return { segments: parsed.segments };
  } catch (error) {
    console.error('Failed to parse Gemini response:', error);
    console.error('Raw response:', rawText);

    // Fallback: treat as plain text narrative
    return {
      segments: [
        {
          type: 'narrative',
          text: rawText || 'I apologize, but I encountered an error. Could you rephrase your question?',
        },
      ],
    };
  }
}

/**
 * Enrich product segments with full product data
 */
async function enrichProductSegments(
  segments: Segment[],
  productMap: Map<string, any>
): Promise<Segment[]> {
  return segments.map((segment) => {
    if (segment.type === 'products' && segment.items) {
      const enrichedItems = segment.items.map((item: any) => {
        const fullProduct = productMap.get(item.id);
        if (!fullProduct) {
          console.warn(`Product ${item.id} not found in search results`);
          return item;
        }

        return {
          id: fullProduct.id,
          title: fullProduct.title,
          price: fullProduct.price,
          currency: fullProduct.currency,
          image: fullProduct.image_url,
          handle: fullProduct.handle,
          vendor: fullProduct.vendor,
          reason: item.reason || undefined,
          badges: fullProduct.badges,
          review_rating: fullProduct.review_rating,
          review_count: fullProduct.review_count,
        } as ProductCard;
      });

      return {
        ...segment,
        items: enrichedItems,
      };
    }
    return segment;
  });
}

/**
 * Run the natural conversation pipeline
 */
export async function runNaturalPipeline(
  input: NaturalPipelineInput,
  deps: HybridSearchDependencies & { generateEmbedding: (text: string) => Promise<number[]> }
): Promise<NaturalPipelineResult> {
  const { shopId, sessionId, messages, sessionMetadata, resultLimit = 30 } = input;
  const userMessage = messages[messages.length - 1];

  if (!userMessage || userMessage.role !== 'user') {
    throw new Error('Natural pipeline requires a trailing user message');
  }

  // Load Store Card
  let storeCard: any = null;
  try {
    const { fetchStoreCard } = await import('../store-intelligence');
    storeCard = await fetchStoreCard(shopId);
    console.log(`[Natural Pipeline] Store Card loaded for ${shopId}`);
  } catch (error) {
    console.warn(`[Natural Pipeline] Failed to fetch Store Card:`, error);
    // Create minimal fallback
    storeCard = {
      store_name: 'Our Store',
      brand_voice: {
        personality: 'Friendly and helpful',
        tone: 'Warm',
        formality: 'Casual',
      },
      policies: {},
    };
  }

  // Classify topic
  const topic: TurnTopic = classifyTopic(userMessage.content);
  const isInfoMode = topic === 'store_info' || topic === 'policy_info' || topic === 'rapport';
  const conversationTurn = messages.filter((m) => m.role === 'user').length;

  // Extract accumulated intent
  let accumulatedIntent: AccumulatedIntent = sessionMetadata.accumulatedIntent ?? {};
  messages.forEach((msg) => {
    if (msg.role === 'user') {
      accumulatedIntent = extractIntent(msg.content, accumulatedIntent);
    }
  });

  console.log(`[Natural Pipeline] Turn ${conversationTurn}, Topic: ${topic}, Intent:`, accumulatedIntent);

  // If info/rapport mode, use simplified prompt
  if (isInfoMode) {
    const promptContext: NaturalPromptContext = {
      storeCard,
      productCount: 0,
      topProducts: [],
      conversationTurn,
      userMessage: userMessage.content,
      conversationHistory: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    };

    const systemPrompt = buildInfoModePrompt(promptContext);

    const response = await chatModel.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: 'I understand. I will respond warmly and naturally in JSON format.' }] },
        { role: 'user', parts: [{ text: userMessage.content }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
      },
    });

    const rawResponse = response.response.text();
    const { segments } = parseGeminiResponse(rawResponse);

    return {
      pepTurn: {
        segments,
        metadata: {},
      },
      userMessage: userMessage.content,
      accumulatedIntent,
      conversationTurn,
    };
  }

  // Commerce mode: search products
  const embedding = await deps.generateEmbedding(userMessage.content);

  const searchResults = await runHybridSearch({
    shopId,
    embedding,
    lexicalQuery: userMessage.content,
    filters: sessionMetadata.activeFilters || {},
    limit: resultLimit,
    deps,
  });

  console.log(`[Natural Pipeline] Found ${searchResults.products.length} products`);

  // Apply multi-factor re-ranking
  let rankedProducts = searchResults.products;
  if (rankedProducts.length > 0) {
    try {
      const category = accumulatedIntent.category || rankedProducts[0]?.product_type || 'general';
      const rankingContext: RankingContext = {
        query: userMessage.content,
        category,
        userPreferences: accumulatedIntent.preferences || [],
      };
      rankedProducts = rerankProducts(rankedProducts, rankingContext);
      console.log(`[Natural Pipeline] Re-ranked ${rankedProducts.length} products`);
    } catch (error) {
      console.warn('[Natural Pipeline] Re-ranking failed, using search order:', error);
    }
  }

  // Take top 30 for Gemini context
  const topProducts = rankedProducts.slice(0, 30).map((p) => ({
    id: p.id,
    title: p.title,
    price: p.price,
    vendor: p.vendor,
    product_type: p.product_type,
    tags: p.tags,
    description: p.description,
    review_rating: p.review_rating,
    review_count: p.review_count,
  }));

  // Build product map for enrichment
  const productMap = new Map(rankedProducts.map((p) => [p.id, p]));

  // Extract top categories and price range
  const categoryCount = new Map<string, number>();
  let minPrice = Infinity;
  let maxPrice = -Infinity;

  for (const product of rankedProducts) {
    if (product.product_type) {
      categoryCount.set(product.product_type, (categoryCount.get(product.product_type) || 0) + 1);
    }
    if (product.price > 0) {
      minPrice = Math.min(minPrice, product.price);
      maxPrice = Math.max(maxPrice, product.price);
    }
  }

  const topCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map((e) => e[0]);

  const priceRange =
    minPrice !== Infinity && maxPrice !== -Infinity ? { min: minPrice, max: maxPrice } : undefined;

  // Build natural prompt context
  const promptContext: NaturalPromptContext = {
    storeCard,
    productCount: searchResults.total || rankedProducts.length,
    topProducts,
    conversationTurn,
    userMessage: userMessage.content,
    conversationHistory: messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    })),
    topCategories,
    priceRange,
    accumulatedIntent,
  };

  const systemPrompt = buildNaturalSystemPrompt(promptContext);

  // Call Gemini with natural prompt
  console.log(`[Natural Pipeline] Calling Gemini with ${topProducts.length} products in context`);

  const response = await chatModel.generateContent({
    contents: [
      { role: 'user', parts: [{ text: systemPrompt }] },
      {
        role: 'model',
        parts: [
          {
            text: 'I understand. I will act as a natural, conversational shopping concierge and respond with structured JSON containing segments. I will take my time to understand their needs, ask thoughtful questions, and show 2-3 confident recommendations when ready.',
          },
        ],
      },
      { role: 'user', parts: [{ text: `Customer says: "${userMessage.content}"` }] },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 2048,
    },
  });

  const rawResponse = response.response.text();
  console.log('[Natural Pipeline] Gemini response received');

  // Parse and validate response
  const { segments: rawSegments } = parseGeminiResponse(rawResponse);

  // Enrich product segments with full data
  const segments = await enrichProductSegments(rawSegments, productMap);

  console.log(`[Natural Pipeline] Generated ${segments.length} segments`);

  return {
    pepTurn: {
      segments,
      metadata: {
        productCount: searchResults.total,
        conversationTurn,
        topic,
      },
    },
    userMessage: userMessage.content,
    accumulatedIntent,
    conversationTurn,
  };
}

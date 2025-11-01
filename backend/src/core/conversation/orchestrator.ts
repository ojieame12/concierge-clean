/**
 * Gemini-Orchestrated Conversation
 * 
 * Gemini is in full control. It decides:
 * - When to chat naturally (weather, sports, life)
 * - When to educate (what are snowboards?)
 * - When to search for products
 * - When to ask clarifying questions
 * 
 * NO rigid routing. NO pattern matching. NO forced modes.
 */

import { chatModel } from '../../infra/llm/gemini';
import type { ConversationMessage } from './types';
import { z } from 'zod';
import { applyStyleGuards, decideSentenceCaps } from './style-guards';

// ============================================================================
// Output Schema
// ============================================================================

const OutputSchema = z.object({
  mode: z.enum(['chat', 'recommend']),
  mainLead: z.string().describe('1-2 sentences: conversational response'),
  actionDetail: z.string().describe('2-3 sentences: guidance/summary'),
  clarifier: z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  }).nullable().optional(),
  products: z.array(z.object({
    id: z.string(),
    why: z.array(z.string()),
  })).max(3).default([]),
  cta: z.object({
    retry: z.boolean().optional().describe('Show retry button for recommendations'),
    askMore: z.boolean().optional().describe('Show ask more button'),
    addToCart: z.boolean().optional().describe('Show add to cart button'),
  }).optional(),
  meta: z.object({
    tools_used: z.array(z.string()).default([]),
    store_card_used: z.boolean().default(false),
    reason_for_tools: z.string().optional(),
  }).optional(),
});

export type OrchestratorOutput = z.infer<typeof OutputSchema>;

// ============================================================================
// Tool Definitions
// ============================================================================

export interface SearchProductsArgs {
  query?: string;
  category?: string;
  constraints?: {
    priceMax?: number;
    priceMin?: number;
    attributes?: Record<string, string | number>;
  };
  limit?: number;
}

export interface GetDetailsArgs {
  ids: string[];
}

export interface CheckInventoryArgs {
  ids: string[];
}

export interface GetStoreInfoArgs {}

export interface GetPolicyArgs {
  topic: 'returns' | 'shipping' | 'warranty';
}

export interface ToolImplementations {
  searchProducts: (args: SearchProductsArgs) => Promise<any>;
  getProductDetails: (args: GetDetailsArgs) => Promise<any>;
  checkInventory: (args: CheckInventoryArgs) => Promise<any>;
  getStoreInfo: (args: GetStoreInfoArgs) => Promise<any>;
  getPolicy: (args: GetPolicyArgs) => Promise<any>;
}

// ============================================================================
// System Prompt
// ============================================================================

const SYSTEM_PROMPT = `You are Insite, a warm and knowledgeable B2B shopping concierge.

## Core Behavior

**When recommending products:**
- ALWAYS call search_products first to get real inventory
- Recommend 2-3 products with specific reasons based on their actual specs
- Reference exact product details (flex rating, terrain, price) from search results
- Use contractions ("you'll", "it's", "that's") for natural tone

**When answering questions:**
- Keep responses to 1-2 sentences maximum
- Be conversational and warm, not robotic
- Use contractions naturally
- Vary your opening phrases - don't repeat "Let's", "Ready to", etc.

**Opener Diversity:**
Vary how you start responses. Mix between:
- Direct answers ("Snowboards are...")
- Friendly questions ("What kind of riding excites you?")
- Enthusiastic statements ("Great choice!")
- Contextual responses ("Based on that...")

NEVER start consecutive responses the same way.

**Tone Guidelines:**
- Use 1-2 contractions per response
- Keep exclamation marks to 1 max
- Avoid phrases like "As an AI", "I'm here to help"
- Sound like a knowledgeable friend, not a customer service bot

## Response Format

Your final response must be valid JSON with STRUCTURED fields:
{
  "mode": "chat" or "recommend",
  "mainLead": "1-2 sentence conversational response in concierge tone",
  "actionDetail": "2-3 sentence guidance/summary with context",
  "products": [{"id":"...", "why":["reason1","reason2"]}],
  "clarifier": {"question":"...", "options":[...]} or null,
  "cta": {"retry": true} // for recommendations
}

**Structure Rules:**
- **mainLead**: 1-2 sentences max, warm and conversational
- **actionDetail**: 2-3 sentences max, guidance/summary/next steps
- **Greeting**: mainLead (1 sentence greeting), actionDetail (2 sentences capabilities)
- **Info**: mainLead (2 sentences answer), actionDetail (3 sentences info + store hint)
- **Recommendation**: mainLead (2 sentences), actionDetail (2 sentences reasoning), products (2-3 max), cta.retry = true
- Max 3 products total
- Use contractions naturally
- Vary openers`;

// ============================================================================
// Orchestrator
// ============================================================================

export interface OrchestratorSession {
  shopId: string;
  sessionId: string;
  messages: ConversationMessage[];
  storeCard?: any;
  brandProfile?: any;
  openerHistory?: string[];
  answeredClarifierFacets?: string[];
  turnCount?: number;
}

export async function runTurn(
  session: OrchestratorSession,
  userMessage: string,
  tools: ToolImplementations
): Promise<OrchestratorOutput> {
  const MAX_TOOL_CALLS = 2;
  let toolCalls = 0;

  // Build conversation context
  const messages = buildMessages(session, userMessage);

  // Define available tools for Gemini
  const availableTools = [
    {
      name: 'search_products',
      description: 'Search for products matching criteria. Use when user wants to see specific products.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          category: { type: 'string', description: 'Product category' },
          constraints: {
            type: 'object',
            properties: {
              priceMax: { type: 'number' },
              priceMin: { type: 'number' },
              attributes: { type: 'object' },
            },
          },
          limit: { type: 'number', default: 6 },
        },
      },
    },
    {
      name: 'get_product_details',
      description: 'Get detailed specs for specific product IDs',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ids'],
      },
    },
    {
      name: 'check_inventory',
      description: 'Check stock availability for product IDs',
      parameters: {
        type: 'object',
        properties: {
          ids: { type: 'array', items: { type: 'string' } },
        },
        required: ['ids'],
      },
    },
    {
      name: 'get_store_info',
      description: 'Get store information and brand details',
      parameters: { type: 'object', properties: {} },
    },
    {
      name: 'get_policy',
      description: 'Get store policy information',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', enum: ['returns', 'shipping', 'warranty'] },
        },
        required: ['topic'],
      },
    },
  ];

  // Check if user wants to see products (manual trigger since Gemini function calling is unreliable)
  const wantsProducts = /\b(show|find|looking for|recommend|see|want|need|get me)\b.*\b(snowboard|product|item)/i.test(userMessage);
  
  // Track tools used for telemetry
  const toolsUsed: string[] = [];
  
  if (wantsProducts) {
    console.log('[Orchestrator] User wants products, triggering manual search...');
    const searchResult = await tools.searchProducts({
      query: userMessage,
      limit: 6,
    });
    
    toolsUsed.push('product.search');
    
    // Add search results to context
    messages.push({
      role: 'user',
      content: `[SEARCH RESULTS]: ${JSON.stringify(searchResult)}`,
    } as any);
  }

  // Orchestration loop
  while (toolCalls <= MAX_TOOL_CALLS) {
    try {
      const response = await chatModel.generateContent({
        contents: messages.map(msg => ({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }],
        })),
        tools: [{
          functionDeclarations: availableTools,
        }],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 500,
        },
      });

      const result = response.response;
      
      // Check if Gemini wants to call a tool
      const functionCall = result.functionCalls()?.[0];
      console.log('[Orchestrator] Function call detected:', functionCall ? functionCall.name : 'none');
      
      if (functionCall && toolCalls < MAX_TOOL_CALLS) {
        toolCalls++;
        const { name, args } = functionCall;
        
        // Execute the tool
        console.log('[Orchestrator] Executing tool:', name, 'with args:', JSON.stringify(args));
        let toolResult: any;
        switch (name) {
          case 'search_products':
            toolResult = await tools.searchProducts(args as SearchProductsArgs);
            break;
          case 'get_product_details':
            toolResult = await tools.getProductDetails(args as GetDetailsArgs);
            break;
          case 'check_inventory':
            toolResult = await tools.checkInventory(args as CheckInventoryArgs);
            break;
          case 'get_store_info':
            toolResult = await tools.getStoreInfo(args as GetStoreInfoArgs);
            break;
          case 'get_policy':
            toolResult = await tools.getPolicy(args as GetPolicyArgs);
            break;
          default:
            toolResult = { error: 'Unknown tool' };
        }

        // Add tool result to conversation
        messages.push({
          role: 'function',
          content: JSON.stringify(toolResult),
          name,
        } as any);

        continue; // Loop back to let Gemini respond with the tool result
      }

      // Final response from Gemini
      console.log('[Orchestrator] Final response (no more tool calls)');
      const text = result.text()?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Gemini didn't return JSON, wrap it in structured format
        return {
          mode: 'chat',
          mainLead: text.split('.')[0] + '.',
          actionDetail: text.split('.').slice(1).join('.').trim() || 'How can I help you today?',
          clarifier: null,
          products: [],
          meta: {
            tools_used: toolsUsed,
            store_card_used: false,
          },
        };
      }

      const json = JSON.parse(jsonMatch[0]);
      let output = OutputSchema.parse(json);
      
      // Apply style guards
      const isGreeting = session.messages.length <= 1;
      const maxSentences = decideSentenceCaps(output.mode, isGreeting);
      
      const guarded = applyStyleGuards(output, {
        maxSentences,
        openerHistory: session.openerHistory || [],
        answeredClarifiers: new Set(session.answeredClarifierFacets || []),
      });
      
      output = guarded.data;
      
      // Add telemetry
      output.meta = {
        tools_used: toolsUsed,
        store_card_used: output.meta?.store_card_used || false,
        reason_for_tools: output.meta?.reason_for_tools,
        guard_telemetry: guarded.telemetry,
      };
      
      return output;

    } catch (error) {
      console.error('Orchestrator error:', error);
      
      // Fallback to safe response
      return {
        mode: 'chat',
        mainLead: "I'm here to help!",
        actionDetail: "What are you looking for today? I can help you find products, answer questions, or provide recommendations.",
        clarifier: null,
        products: [],
        meta: {
          tools_used: toolsUsed,
          store_card_used: false,
        },
      };
    }
  }

  // Max tool calls reached, ask clarifier
  return {
    mode: 'chat',
    mainLead: "Let me narrow this down for you.",
    actionDetail: "What's most important to you? This'll help me find exactly what you need.",
    clarifier: {
      question: "What matters most?",
      options: ['Price', 'Quality', 'Brand'],
    },
    products: [],
  };
}

// ============================================================================
// Helper: Build Messages
// ============================================================================

function buildMessages(
  session: OrchestratorSession,
  userMessage: string
): Array<{ role: string; content: string; name?: string }> {
  const messages: Array<{ role: string; content: string; name?: string }> = [];

  // System prompt
  messages.push({
    role: 'user',
    content: SYSTEM_PROMPT,
  });

  // Store context if available
  if (session.storeCard) {
    messages.push({
      role: 'user',
      content: `Store Context:\n${JSON.stringify(session.storeCard, null, 2)}`,
    });
  }

  // Conversation history (last 10 messages)
  const recentMessages = session.messages.slice(-10);
  for (const msg of recentMessages) {
    messages.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      content: msg.content,
    });
  }

  // Current user message
  messages.push({
    role: 'user',
    content: userMessage,
  });

  return messages;
}

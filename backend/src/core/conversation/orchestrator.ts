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

// ============================================================================
// Output Schema
// ============================================================================

const OutputSchema = z.object({
  mode: z.enum(['chat', 'recommend']),
  message: z.string(),
  clarifier: z.object({
    question: z.string(),
    options: z.array(z.string()).optional(),
  }).nullable().optional(),
  products: z.array(z.object({
    id: z.string(),
    why: z.array(z.string()),
  })).max(3).default([]),
  actions: z.array(z.enum(['notify_me', 'adjust_filters', 'compare'])).default([]),
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

const SYSTEM_PROMPT = `You are Insite, a warm, smart B2B concierge. You can chat naturally about anything
(weather, sports, what snowboards are), educate, and—when useful—recommend products.

Core behaviors:
- Be brief, friendly, and specific. Use contractions.
- Off-topic: reply with ONE warm sentence, then (if helpful) pivot back with ONE sentence.
- Ask at most ONE clarifier when it reduces uncertainty.
- When you recommend: show 2–3 products, clear "why this" reasons, and a confident final pick.
- Dead ends: empathize briefly; propose sibling/nearest; tasteful upsell (≤20% over) only if it clearly improves ≥2 drivers; offer "Notify me" or "Adjust filters".
- Policies: only state what is known from the Store Card.

Tools:
- You may call tools if—and only if—they meaningfully help the user now.
- Don't narrate tool usage. Just use results.

Output schema:
Return a single JSON object matching:
{
  "mode": "chat" | "recommend",
  "message": "string",            // your natural reply
  "clarifier": {"question":"string", "options":["A","B"]} | null,
  "products": [
    {"id":"string","why":["reason1","reason2"]} // ≤3
  ],
  "actions": ["notify_me","adjust_filters","compare"] | []
}

Constraints:
- Never output more than 3 products.
- Avoid boilerplate ("As an AI…"). Max 1 exclamation mark.
- If no products are shown, explain why in one short sentence or ask a single clarifier.`;

// ============================================================================
// Orchestrator
// ============================================================================

export interface OrchestratorSession {
  shopId: string;
  sessionId: string;
  messages: ConversationMessage[];
  storeCard?: any;
  brandProfile?: any;
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
      
      if (functionCall && toolCalls < MAX_TOOL_CALLS) {
        toolCalls++;
        const { name, args } = functionCall;
        
        // Execute the tool
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
      const text = result.text()?.trim();
      if (!text) {
        throw new Error('Empty response from Gemini');
      }

      // Parse JSON response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // Gemini didn't return JSON, wrap it
        return {
          mode: 'chat',
          message: text,
          clarifier: null,
          products: [],
          actions: [],
        };
      }

      const json = JSON.parse(jsonMatch[0]);
      const output = OutputSchema.parse(json);
      
      return output;

    } catch (error) {
      console.error('Orchestrator error:', error);
      
      // Fallback to safe response
      return {
        mode: 'chat',
        message: "I'm here to help! What are you looking for today?",
        clarifier: null,
        products: [],
        actions: [],
      };
    }
  }

  // Max tool calls reached, ask clarifier
  return {
    mode: 'chat',
    message: "Let me narrow this down—what's most important to you?",
    clarifier: {
      question: "What matters most?",
      options: ['Price', 'Quality', 'Brand'],
    },
    products: [],
    actions: [],
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

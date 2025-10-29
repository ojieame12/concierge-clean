/**
 * Conversation Test Harness
 * 
 * Utilities for testing multi-turn conversations with the natural chat endpoint.
 * Provides a simple API for simulating conversations and extracting results.
 */

// Segment type definition
export interface Segment {
  type: string;
  [key: string]: any;
}

export interface ConversationSession {
  id: string;
  shopDomain: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  persona?: string;
}

export interface ConversationResponse {
  segments: Segment[];
  metadata?: Record<string, any>;
  
  // Extracted for easy testing
  text: string;                    // All narrative text combined
  clarifiers: string[];            // All ask segments
  shortlist: ProductItem[];        // Products shown
  finalPick?: ProductItem;         // If one product is clearly recommended
  options: QuickReplyOption[];     // Quick reply options
  cta?: string;                    // Call to action if present
}

export interface ProductItem {
  id: string;
  title?: string;
  price?: number;
  reason?: string;
  why?: string[];  // why_chips if present
}

export interface QuickReplyOption {
  id: string;
  label: string;
  value?: string;
}

const API_URL = process.env.CHAT_API_URL || 'http://localhost:4000/api/chat-natural';
const CLIENT_KEY = process.env.CLIENT_KEY || process.env.CLIENT_API_KEYS?.split(',')[0] || 'dev-client-key-123';

/**
 * Start a new conversation session
 */
export async function startSession(opts: {
  persona?: string;
  shopDomain?: string;
}): Promise<ConversationSession> {
  return {
    id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    shopDomain: opts.shopDomain || 'boardriders.myshopify.com',
    messages: [],
    persona: opts.persona || 'friendly_expert',
  };
}

/**
 * Send a message in a conversation and get response
 */
export async function send(
  session: ConversationSession,
  text: string
): Promise<ConversationResponse> {
  // Add user message to history
  session.messages.push({
    role: 'user',
    content: text,
  });

  // Call API
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-concierge-client-key': CLIENT_KEY,
    },
    body: JSON.stringify({
      messages: session.messages,
      shopDomain: session.shopDomain,
      sessionId: session.id,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const result = await response.json();

  // Add assistant response to history
  const narrativeText = extractNarrativeText(result.segments);
  if (narrativeText) {
    session.messages.push({
      role: 'assistant',
      content: narrativeText,
    });
  }

  // Parse and return structured response
  return parseResponse(result);
}

/**
 * Extract narrative text from segments
 */
function extractNarrativeText(segments: Segment[]): string {
  return segments
    .filter((s) => s.type === 'narrative')
    .map((s: any) => s.text)
    .join('\n\n');
}

/**
 * Parse API response into structured format for testing
 */
function parseResponse(result: any): ConversationResponse {
  const segments: Segment[] = result.segments || [];

  // Extract narrative text
  const narratives = segments
    .filter((s) => s.type === 'narrative')
    .map((s: any) => s.text);
  const text = narratives.join('\n\n');

  // Extract clarifying questions
  const clarifiers = segments
    .filter((s) => s.type === 'ask')
    .map((s: any) => s.text);

  // Extract products
  const productSegments = segments.filter((s) => s.type === 'products');
  const shortlist: ProductItem[] = [];
  
  for (const seg of productSegments) {
    const items = (seg as any).items || [];
    for (const item of items) {
      shortlist.push({
        id: item.id,
        title: item.title,
        price: item.price,
        reason: item.reason,
        why: item.why_chips || [],
      });
    }
  }

  // Detect final pick (if narrative mentions "top pick" or "recommend" with one product)
  let finalPick: ProductItem | undefined;
  if (shortlist.length === 1) {
    finalPick = shortlist[0];
  } else if (shortlist.length > 1) {
    // Check if narrative clearly recommends one
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes('top pick') ||
      lowerText.includes('#1') ||
      lowerText.includes('best bet') ||
      lowerText.includes('recommend')
    ) {
      // First product is likely the recommendation
      finalPick = shortlist[0];
    }
  }

  // Extract quick reply options
  const optionSegments = segments.filter((s) => s.type === 'options');
  const options: QuickReplyOption[] = [];
  
  for (const seg of optionSegments) {
    const items = (seg as any).items || [];
    for (const item of items) {
      options.push({
        id: item.id,
        label: item.label,
        value: item.value,
      });
    }
  }

  // Extract CTA (look for action words in last narrative)
  let cta: string | undefined;
  if (narratives.length > 0) {
    const lastNarrative = narratives[narratives.length - 1].toLowerCase();
    if (
      lastNarrative.includes('add to cart') ||
      lastNarrative.includes('view details') ||
      lastNarrative.includes('compare') ||
      lastNarrative.includes('want to know')
    ) {
      cta = lastNarrative;
    }
  }

  return {
    segments,
    metadata: result.metadata,
    text,
    clarifiers,
    shortlist,
    finalPick,
    options,
    cta,
  };
}

/**
 * Helper: Run a multi-turn conversation from a script
 */
export async function runConversation(
  script: Array<{ user: string; expect?: (response: ConversationResponse) => void }>,
  opts?: { persona?: string; shopDomain?: string }
): Promise<ConversationResponse[]> {
  const session = await startSession(opts || {});
  const responses: ConversationResponse[] = [];

  for (const turn of script) {
    const response = await send(session, turn.user);
    responses.push(response);

    if (turn.expect) {
      turn.expect(response);
    }
  }

  return responses;
}

/**
 * Helper: Extract all products mentioned across conversation
 */
export function getAllProducts(responses: ConversationResponse[]): ProductItem[] {
  const products: ProductItem[] = [];
  const seen = new Set<string>();

  for (const response of responses) {
    for (const product of response.shortlist) {
      if (!seen.has(product.id)) {
        seen.add(product.id);
        products.push(product);
      }
    }
  }

  return products;
}

/**
 * Helper: Count total clarifying questions asked
 */
export function countClarifiers(responses: ConversationResponse[]): number {
  return responses.reduce((sum, r) => sum + r.clarifiers.length, 0);
}

/**
 * Helper: Get conversation length (user turns)
 */
export function getConversationLength(session: ConversationSession): number {
  return session.messages.filter((m) => m.role === 'user').length;
}

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
  // New structured format
  mainLead?: string;               // 1-2 sentences: conversational response
  actionDetail?: string;           // 2-3 sentences: guidance/summary
  
  // Legacy segment-based format
  segments?: Segment[];
  metadata?: Record<string, any>;
  
  // Extracted for easy testing
  text: string;                    // All narrative text combined (or mainLead + actionDetail)
  clarifiers: string[];            // All ask segments
  shortlist: ProductItem[];        // Products shown
  finalPick?: ProductItem;         // If one product is clearly recommended
  options: QuickReplyOption[];     // Quick reply options
  
  // Clarifier
  clarifier?: {
    question: string;
    options: string[];
  } | null;
  
  // CTAs
  cta?: {
    retry?: boolean;
    askMore?: boolean;
    addToCart?: boolean;
  } | string;                      // string for legacy support
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

const API_URL = process.env.CHAT_API_URL || 'http://localhost:4000/api/chat-natural-v2';
const CLIENT_KEY = process.env.CLIENT_KEY || process.env.CLIENT_API_KEYS?.split(',')[0] || 'dev_client_key';

/**
 * Validate that a shop exists before running tests
 * Call this in beforeAll() to fail fast with clear error messages
 */
export async function validateShopExists(shopDomain: string): Promise<void> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-concierge-client-key': CLIENT_KEY,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: 'test' }],
        shopDomain,
        sessionId: `validation-${Date.now()}`,
      }),
    });

    if (response.status === 404) {
      const error = await response.json();
      throw new Error(
        `Shop validation failed for "${shopDomain}". ` +
        `${error.details || error.error}. ` +
        `Make sure the shop is seeded in the database.`
      );
    }

    // Any other error is fine - we just want to check shop exists
    console.log(`✅ Shop "${shopDomain}" validated successfully`);
  } catch (error: any) {
    if (error.message.includes('Shop validation failed')) {
      throw error;
    }
    // Network errors or other issues - log but don't fail
    console.warn(`⚠️  Shop validation warning: ${error.message}`);
  }
}

/**
 * Parse Server-Sent Events (SSE) streaming response
 */
async function parseSSEResponse(response: Response): Promise<any> {
  const text = await response.text();
  const lines = text.split('\n');
  
  const segments: any[] = [];
  let doneData: any = null;
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const jsonStr = line.slice(6); // Remove 'data: ' prefix
      try {
        const data = JSON.parse(jsonStr);
        
        if (data.type === 'segment') {
          segments.push(data.segment);
        } else if (data.type === 'done') {
          doneData = data;
        }
      } catch (e) {
        // Skip invalid JSON lines
      }
    }
  }
  
  // Combine segments and done data
  return {
    segments,
    mainLead: doneData?.mainLead,
    actionDetail: doneData?.actionDetail,
    clarifier: doneData?.clarifier,
    products: doneData?.products,
    cta: doneData?.cta,
    metadata: doneData?.metadata,
    meta: doneData?.metadata,
  };
}

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

  // Parse SSE streaming response
  const result = await parseSSEResponse(response);

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
  // Check if response has new structured format
  const hasStructuredFormat = result.mainLead !== undefined || result.actionDetail !== undefined;
  
  let mainLead: string | undefined;
  let actionDetail: string | undefined;
  let text: string;
  let narratives: string[] = [];
  
  if (hasStructuredFormat) {
    // New structured format
    mainLead = result.mainLead;
    actionDetail = result.actionDetail;
    text = [mainLead, actionDetail].filter(Boolean).join(' ');
  } else {
    // Legacy segment-based format
    const segments: Segment[] = result.segments || [];
    narratives = segments
      .filter((s) => s.type === 'narrative')
      .map((s: any) => s.text);
    text = narratives.join('\n\n');
  }
  
  const segments: Segment[] = result.segments || [];

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

  // Extract clarifier from structured format
  const clarifier = result.clarifier ? {
    question: result.clarifier.question || '',
    options: result.clarifier.options || [],
  } : null;
  
  // Extract products from structured format
  if (result.products && result.products.length > 0) {
    for (const product of result.products) {
      shortlist.push({
        id: product.id,
        title: product.title,
        price: product.price,
        reason: product.reason,
        why: product.why || [],
      });
    }
  }
  
  // Extract CTA from structured format
  const structuredCta = result.cta;
  
  return {
    mainLead,
    actionDetail,
    segments,
    metadata: result.metadata || result.meta,
    text,
    clarifiers,
    shortlist,
    finalPick,
    options,
    clarifier,
    cta: structuredCta || cta,
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

/**
 * End a conversation session (cleanup)
 */
export async function endSession(session: ConversationSession): Promise<void> {
  // Currently no cleanup needed, but this provides a hook for future needs
  // (e.g., closing connections, saving logs, etc.)
  console.log(`Session ${session.id} ended with ${session.messages.length} messages`);
}

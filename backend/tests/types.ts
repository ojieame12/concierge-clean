/**
 * Test types for conversation testing
 * Based on the production-ready test plan
 */

export type Action =
  | "notify_me"
  | "adjust_filters"
  | "retry"
  | "compare"
  | "add_to_cart"
  | "ask_more_info";

export type Clarifier = {
  label: string;
  value: string;
};

export type ProductCard = {
  id: string;
  title: string;
  price: number;
  image: string;
  badge?: string;
  why: string[]; // 1–3 plain-language reasons
};

export type TurnEnvelope = {
  mode: "chat" | "recommend";
  lead: string;           // "Main Lead" — 1–2 sentences max
  detail: string;         // "Action Detail" — 1–3 short lines
  clarifiers: Clarifier[]; // 0–3 options + "Something else" affordance
  allow_freeform: boolean; // "Something else" toggles inline input
  products: ProductCard[]; // 0–3 (never >3)
  actions: Action[];       // CTA suggestions aligned to the turn
  // --- internal, not shown to user (for tests and observability)
  meta?: {
    tools_used: string[];        // e.g., ["product.search","product.details"]
    store_card_used: boolean;    // did LLM reference store policies/voice?
    reason_for_tools?: string;   // free text from Gemini/tool planner
  };
};

export type ConversationSession = {
  sessionId: string;
  shopDomain: string;
  history: Array<{
    role: "user" | "assistant";
    content: string;
    turn: number;
  }>;
  clarifiersUsed: Set<string>; // Track clarifier values to prevent repeats
};

export type UserInput =
  | string
  | { clarifier: string; value?: string }
  | { action: string; product_id?: string }
  | { tap_product: string };

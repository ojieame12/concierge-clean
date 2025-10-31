/**
 * Assertion helpers for conversation testing
 */

import { TurnEnvelope } from "../types";

export interface EnvelopeConstraints {
  mode?: "chat" | "recommend";
  minProducts?: number;
  maxProducts?: number;
  maxClarifiers?: number;
}

/**
 * Check that response matches UI envelope contract
 */
export function checkUiEnvelope(
  envelope: TurnEnvelope,
  constraints: EnvelopeConstraints = {}
): void {
  // Check mode
  if (constraints.mode) {
    expect(envelope.mode).toBe(constraints.mode);
  }

  // Check product count
  if (constraints.minProducts !== undefined) {
    expect(envelope.products.length).toBeGreaterThanOrEqual(
      constraints.minProducts
    );
  }
  if (constraints.maxProducts !== undefined) {
    expect(envelope.products.length).toBeLessThanOrEqual(
      constraints.maxProducts
    );
  }

  // Check clarifier count
  if (constraints.maxClarifiers !== undefined) {
    expect(envelope.clarifiers.length).toBeLessThanOrEqual(
      constraints.maxClarifiers
    );
  }

  // Always check: never more than 3 products
  expect(envelope.products.length).toBeLessThanOrEqual(3);

  // Always check: never more than 3 clarifiers (excluding "Something else")
  const nonSomethingElse = envelope.clarifiers.filter(
    (c) => c.value !== "_something_else"
  );
  expect(nonSomethingElse.length).toBeLessThanOrEqual(3);

  // Check lead is 1-2 sentences
  const leadSentences = countSentences(envelope.lead);
  expect(leadSentences).toBeGreaterThanOrEqual(1);
  expect(leadSentences).toBeLessThanOrEqual(2);

  // Check detail is 1-3 sentences (if present)
  if (envelope.detail) {
    const detailSentences = countSentences(envelope.detail);
    expect(detailSentences).toBeLessThanOrEqual(3);
  }

  // If recommend mode, must have products
  if (envelope.mode === "recommend") {
    expect(envelope.products.length).toBeGreaterThanOrEqual(2);
    
    // Each product must have "why" reasons
    for (const product of envelope.products) {
      expect(product.why).toBeDefined();
      expect(product.why.length).toBeGreaterThanOrEqual(1);
      expect(product.why.length).toBeLessThanOrEqual(3);
    }
  }
}

/**
 * Count sentences in text
 */
export function countSentences(text: string): number {
  if (!text) return 0;
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  return sentences.length;
}

/**
 * Check that clarifiers don't repeat across conversation
 */
export function noRepeatClarifiers(history: Array<{
  clarifiers?: string[];
}>): boolean {
  const seen = new Set<string>();
  
  for (const turn of history) {
    if (!turn.clarifiers) continue;
    
    for (const clarifier of turn.clarifiers) {
      if (seen.has(clarifier)) {
        return false; // Found a repeat
      }
      seen.add(clarifier);
    }
  }
  
  return true; // No repeats
}

/**
 * Check that text doesn't contain boilerplate phrases
 */
export function hasNoBoilerplate(text: string): boolean {
  const boilerplate = [
    "as an ai",
    "i am unable to",
    "i cannot",
    "i don't have access",
    "i'm just a",
    "as a language model",
  ];
  
  const lower = text.toLowerCase();
  return !boilerplate.some((phrase) => lower.includes(phrase));
}

/**
 * Check that text uses contractions (natural speech)
 */
export function hasContractions(text: string): boolean {
  const contractions = [
    "i'm",
    "you're",
    "we're",
    "they're",
    "it's",
    "that's",
    "what's",
    "i'll",
    "you'll",
    "we'll",
    "can't",
    "won't",
    "don't",
    "doesn't",
    "isn't",
    "aren't",
  ];
  
  const lower = text.toLowerCase();
  return contractions.some((contraction) => lower.includes(contraction));
}

/**
 * Count exclamation marks (should be ≤1 for professional tone)
 */
export function countExclamations(text: string): number {
  return (text.match(/!/g) || []).length;
}

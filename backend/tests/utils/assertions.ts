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

/**
 * Extract bigrams (2-word sequences) from text
 */
function extractBigrams(text: string): string[] {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
}

/**
 * Check that no bigram is repeated more than 2 times
 */
export function checkBigramRepetition(text: string): boolean {
  const bigrams = extractBigrams(text);
  const counts = new Map<string, number>();
  
  for (const bigram of bigrams) {
    counts.set(bigram, (counts.get(bigram) || 0) + 1);
  }
  
  // No bigram should appear more than 2 times
  return ![...counts.values()].some(count => count > 2);
}

/**
 * Calculate Jaccard similarity between two texts
 */
export function calculateJaccardSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const set1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 0));
  const set2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 0));
  
  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);
  
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Opener diversity tracker
 */
export class OpenerTracker {
  private recentOpeners: string[] = [];
  
  addOpener(text: string): void {
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text.split(/[.!?]/)[0];
    this.recentOpeners.push(firstSentence.trim());
    if (this.recentOpeners.length > 5) {
      this.recentOpeners.shift();
    }
  }
  
  isReused(text: string): boolean {
    const firstSentence = text.match(/^[^.!?]+[.!?]/)?.[0] || text.split(/[.!?]/)[0];
    return this.recentOpeners.includes(firstSentence.trim());
  }
  
  getRecentOpeners(): string[] {
    return [...this.recentOpeners];
  }
}

/**
 * Check budget adherence for products
 */
export function checkBudgetAdherence(
  products: Array<{ price: number; why: string[] }>,
  maxPrice: number
): boolean {
  return products.every(p => {
    if (p.price <= maxPrice) return true;
    
    // Upsell rule: ≤20% over & ≥2 drivers improved
    const overPercent = ((p.price - maxPrice) / maxPrice) * 100;
    return overPercent <= 20 && p.why.length >= 2;
  });
}

/**
 * Check if evidence exists in product record
 */
export function evidenceExistsIn(record: any, claim: string): boolean {
  if (!record || !claim) return false;
  
  const claimLower = claim.toLowerCase();
  const recordText = JSON.stringify(record).toLowerCase();
  
  // Check if claim appears in product attributes
  if (recordText.includes(claimLower)) return true;
  
  // Check specific fields
  const checkFields = (obj: any): boolean => {
    if (typeof obj !== 'object' || obj === null) return false;
    
    for (const value of Object.values(obj)) {
      if (typeof value === 'string' && value.toLowerCase().includes(claimLower)) {
        return true;
      }
      if (typeof value === 'object' && checkFields(value)) {
        return true;
      }
    }
    return false;
  };
  
  return checkFields(record);
}

/**
 * Check evidence grounding for all products
 */
export function checkProductGroundedness(
  products: Array<{ id: string; why: string[] }>,
  fetchedProducts: any[]
): boolean {
  const productsById = Object.fromEntries(
    fetchedProducts.map(p => [p.id, p])
  );
  
  return products.every(p => {
    const record = productsById[p.id];
    if (!record) return false;
    
    return p.why.every(reason => evidenceExistsIn(record, reason));
  });
}

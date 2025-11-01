/**
 * Session memory management for style guards
 * 
 * Handles tracking of opener history and answered clarifier facets
 */

import type { SessionMetadata } from './session-store';

const MAX_OPENER_HISTORY = 10;
const CLARIFIER_TTL_TURNS = 10;

/**
 * Update opener history with the latest lead sentence
 */
export function updateOpenerHistory(
  currentHistory: string[] | undefined,
  newOpener: string
): string[] {
  const history = currentHistory ?? [];
  
  // Extract first sentence from the opener
  const firstSentence = newOpener.split(/(?<=[.!?])\s+/)[0]?.trim() ?? newOpener;
  
  // Add to front, keep last N
  return [firstSentence, ...history].slice(0, MAX_OPENER_HISTORY);
}

/**
 * Add a clarifier facet to the answered set
 */
export function addAnsweredClarifier(
  currentAnswered: string[] | undefined,
  facet: string,
  currentTurn: number
): string[] {
  const answered = currentAnswered ?? [];
  
  // Add facet if not already present
  if (!answered.includes(facet)) {
    return [...answered, facet];
  }
  
  return answered;
}

/**
 * Remove stale clarifier facets based on TTL
 * This allows re-asking clarifiers after a certain number of turns
 */
export function pruneStaleClarifiers(
  answeredFacets: string[] | undefined,
  clarifierHistory: Record<string, number> | undefined,
  currentTurn: number
): string[] {
  if (!answeredFacets || !clarifierHistory) {
    return answeredFacets ?? [];
  }
  
  return answeredFacets.filter(facet => {
    const answeredAtTurn = clarifierHistory[facet];
    if (answeredAtTurn === undefined) return true;
    
    // Keep if answered within TTL
    return (currentTurn - answeredAtTurn) < CLARIFIER_TTL_TURNS;
  });
}

/**
 * Get guard memory state from session metadata
 */
export function getGuardMemory(metadata: SessionMetadata): {
  openerHistory: string[];
  answeredClarifierFacets: string[];
  turnCount: number;
} {
  return {
    openerHistory: metadata.openerHistory ?? [],
    answeredClarifierFacets: pruneStaleClarifiers(
      metadata.answeredClarifierFacets,
      metadata.clarifierHistory,
      metadata.turnCount
    ),
    turnCount: metadata.turnCount,
  };
}

/**
 * Update session metadata with guard memory after a turn
 */
export function updateGuardMemory(
  metadata: SessionMetadata,
  updates: {
    newOpener?: string;
    answeredClarifierFacet?: string;
  }
): Partial<SessionMetadata> {
  const patch: Partial<SessionMetadata> = {};
  
  if (updates.newOpener) {
    patch.openerHistory = updateOpenerHistory(metadata.openerHistory, updates.newOpener);
  }
  
  if (updates.answeredClarifierFacet) {
    patch.answeredClarifierFacets = addAnsweredClarifier(
      metadata.answeredClarifierFacets,
      updates.answeredClarifierFacet,
      metadata.turnCount
    );
  }
  
  return patch;
}

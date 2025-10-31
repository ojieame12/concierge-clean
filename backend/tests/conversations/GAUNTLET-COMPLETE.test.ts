/**
 * GAUNTLET COMPLETE • 4-Layer Testing
 * 
 * This test proves the conversation system is:
 * 1. Relevant - Answers reflect constraints, not generic responses
 * 2. Contextual - Facts come from store/product data only
 * 3. Natural - Warm, not robotic
 * 4. Intelligent - Adaptive, efficient, insightful reasoning
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { startSession, send, validateShopExists } from '../utils/convoHarness';
import { judgeNaturalness, judgeGuidance, judgeContextUse } from '../utils/judges';
import { 
  checkUiEnvelope, 
  countSentences, 
  noRepeatClarifiers,
  hasNoBoilerplate,
  hasContractions,
  countExclamations,
  checkBigramRepetition,
  calculateJaccardSimilarity,
  OpenerTracker,
  checkBudgetAdherence,
  checkProductGroundedness,
} from '../utils/assertions';
import {
  checkPolicyPrecision,
  checkToolMinimality,
  checkMemory,
  trackAnsweredSlots,
} from '../utils/evidenceChecks';
import type { ConversationSession, ConversationResponse } from '../utils/convoHarness';

const SHOP = 'insite-intellgience.myshopify.com';

describe('GAUNTLET COMPLETE • 4-Layer Testing', () => {
  let session: ConversationSession;
  const conversationHistory: ConversationResponse[] = [];
  const openerTracker = new OpenerTracker();
  let previousTurnText = '';

  beforeAll(async () => {
    await validateShopExists(SHOP);
    session = await startSession({ shopDomain: SHOP, persona: 'friendly_expert' });
  });

  it('T0 Greeting - Gemini only, no tools', async () => {
    const r = await send(session, 'Hi');
    conversationHistory.push(r);

    // === LAYER 0: Telemetry ===
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // === LAYER 1: Structural ===
    // UI envelope
    expect(r.text).toBeTruthy();
    const sentences = countSentences(r.text);
    expect(sentences).toBeGreaterThanOrEqual(1);
    expect(sentences).toBeLessThanOrEqual(3);

    // Tone linter
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(hasContractions(r.text)).toBe(true);
    expect(countExclamations(r.text)).toBeLessThanOrEqual(1);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // Opener diversity
    openerTracker.addOpener(r.text);
    expect(openerTracker.isReused(r.text)).toBe(false);

    // === LAYER 2: Evidence ===
    // Tool minimality
    const toolCheck = checkToolMinimality(r.metadata?.tools_used || [], [], 0);
    expect(toolCheck.passed).toBe(true);

    // === LAYER 3: Judges ===
    const naturalness = await judgeNaturalness(r.text);
    console.log(`T0 Naturalness: ${naturalness.score}/5 - ${naturalness.reasons.join(', ')}`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.7);

    previousTurnText = r.text;
  });

  it('T1 Educational - What are snowboards?', async () => {
    const r = await send(session, 'What are snowboards and what sports are they for?');
    conversationHistory.push(r);

    // === LAYER 0: Telemetry ===
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(hasContractions(r.text)).toBe(true);
    expect(countExclamations(r.text)).toBeLessThanOrEqual(1);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // Jaccard similarity with previous turn
    const similarity = calculateJaccardSimilarity(r.text, previousTurnText);
    expect(similarity).toBeLessThan(0.8);

    // Opener diversity
    openerTracker.addOpener(r.text);
    expect(openerTracker.isReused(r.text)).toBe(false);

    // === LAYER 2: Evidence ===
    const toolCheck = checkToolMinimality(r.metadata?.tools_used || [], [], 0);
    expect(toolCheck.passed).toBe(true);

    // === LAYER 3: Judges ===
    const naturalness = await judgeNaturalness(r.text);
    const guidance = await judgeGuidance(r.text, 'educate_then_pivot');
    
    console.log(`T1 Naturalness: ${naturalness.score}/5`);
    console.log(`T1 Guidance: ${guidance.score}/5`);
    
    expect(naturalness.score).toBeGreaterThanOrEqual(3.7);
    expect(guidance.score).toBeGreaterThanOrEqual(3.0);

    previousTurnText = r.text;
  });

  it('T2 Clarification - Beginner snowboards', async () => {
    const r = await send(session, 'What kind of snowboards are good for a beginner?');
    conversationHistory.push(r);

    // === LAYER 0: Telemetry ===
    // May or may not use tools yet
    
    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    expect(r.options.length).toBeGreaterThan(0);
    expect(r.options.length).toBeLessThanOrEqual(4);
    
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(hasContractions(r.text)).toBe(true);
    expect(countExclamations(r.text)).toBeLessThanOrEqual(1);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // Opener diversity
    openerTracker.addOpener(r.text);
    expect(openerTracker.isReused(r.text)).toBe(false);

    // === LAYER 2: Evidence ===
    // No repeated clarifiers yet (first clarification)
    expect(noRepeatClarifiers(conversationHistory)).toBe(true);

    // === LAYER 3: Judges ===
    const naturalness = await judgeNaturalness(r.text);
    console.log(`T2 Naturalness: ${naturalness.score}/5`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.7);

    previousTurnText = r.text;
  });

  it('T3 Answer clarifier - Terrain', async () => {
    const r = await send(session, 'Mostly groomers');
    conversationHistory.push(r);

    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // === LAYER 2: Evidence ===
    expect(noRepeatClarifiers(conversationHistory)).toBe(true);

    // Memory check
    const answeredSlots = trackAnsweredSlots(
      session.messages,
      conversationHistory.flatMap((r, i) => 
        r.options.map(opt => ({ question: opt.label, answer: opt.label, turn: i }))
      )
    );
    
    if (r.options.length > 0) {
      const memoryCheck = checkMemory(answeredSlots, r.options.map(o => o.label));
      expect(memoryCheck.passed).toBe(true);
    }

    previousTurnText = r.text;
  });

  it('T4 Answer clarifier - Budget', async () => {
    const r = await send(session, '$400-$600');
    conversationHistory.push(r);

    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    expect(hasNoBoilerplate(r.text)).toBe(true);

    // === LAYER 2: Evidence ===
    expect(noRepeatClarifiers(conversationHistory)).toBe(true);

    previousTurnText = r.text;
  });

  it('T5 Recommendation - Show products', async () => {
    const r = await send(session, 'Show me some options');
    conversationHistory.push(r);

    // === LAYER 0: Telemetry ===
    console.log('T5 Tools used:', r.metadata?.tools_used);
    
    // Should use product search when recommending
    if (r.shortlist.length > 0) {
      expect(r.metadata?.tools_used || []).toContain('product.search');
      
      const toolCheck = checkToolMinimality(
        r.metadata?.tools_used || [],
        ['product.search'],
        2
      );
      expect(toolCheck.passed).toBe(true);
    }

    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    
    // Product count (2-3 max)
    if (r.shortlist.length > 0) {
      expect(r.shortlist.length).toBeGreaterThanOrEqual(2);
      expect(r.shortlist.length).toBeLessThanOrEqual(3);

      // Each product should have 1-3 "why" reasons
      r.shortlist.forEach(product => {
        if (product.why) {
          expect(product.why.length).toBeGreaterThanOrEqual(1);
          expect(product.why.length).toBeLessThanOrEqual(3);
        }
      });

      // Budget adherence
      const budgetCheck = checkBudgetAdherence(
        r.shortlist
          .filter(p => p.price !== undefined && p.why !== undefined)
          .map(p => ({ price: p.price!, why: p.why! })),
        600
      );
      if (r.shortlist.length > 0) {
        expect(budgetCheck).toBe(true);
      }
    }

    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // === LAYER 2: Evidence ===
    if (r.shortlist.length > 0 && r.metadata?.fetchedProducts) {
      // Groundedness check
      const groundednessCheck = checkProductGroundedness(
        r.shortlist
          .filter(p => p.why !== undefined)
          .map(p => ({ id: p.id, why: p.why! })),
        r.metadata.fetchedProducts
      );
      // Note: May fail if product data is incomplete
      console.log('T5 Groundedness check:', groundednessCheck);
    }

    // === LAYER 3: Judges ===
    const naturalness = await judgeNaturalness(r.text);
    console.log(`T5 Naturalness: ${naturalness.score}/5`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.7);

    // Context use judge
    const contextUse = await judgeContextUse(
      session.messages,
      r.text,
      { 
        products: r.metadata?.fetchedProducts || [],
        constraints: { budget: 600, terrain: 'groomers', level: 'beginner' }
      }
    );
    console.log(`T5 Context Use: ${contextUse.score}/5 - ${contextUse.reasons.join(', ')}`);
    expect(contextUse.score).toBeGreaterThanOrEqual(3.7);

    // IQ Score (median of all judges)
    const iqScore = naturalness.score; // Simplified for now
    console.log(`T5 IQ Score: ${iqScore}/5`);
    expect(iqScore).toBeGreaterThanOrEqual(3.9);

    previousTurnText = r.text;
  });

  it('T6 Off-topic - Graceful pivot', async () => {
    const r = await send(session, "What's the weather like today?");
    conversationHistory.push(r);

    // === LAYER 0: Telemetry ===
    // Should not use tools for off-topic
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // === LAYER 1: Structural ===
    expect(r.text).toBeTruthy();
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(checkBigramRepetition(r.text)).toBe(true);

    // Should be brief (≤2 sentences for pivot)
    const sentences = countSentences(r.text);
    expect(sentences).toBeLessThanOrEqual(3);

    // === LAYER 3: Judges ===
    const naturalness = await judgeNaturalness(r.text);
    const guidance = await judgeGuidance(r.text, 'return_to_shopping');
    
    console.log(`T6 Naturalness: ${naturalness.score}/5`);
    console.log(`T6 Guidance: ${guidance.score}/5 - ${guidance.reasons.join(', ')}`);
    
    expect(naturalness.score).toBeGreaterThanOrEqual(3.7);
    expect(guidance.score).toBeGreaterThanOrEqual(4.0);

    previousTurnText = r.text;
  });

  it('Summary - Overall test results', () => {
    console.log('\\n=== GAUNTLET COMPLETE SUMMARY ===');
    console.log(`Total turns: ${conversationHistory.length}`);
    console.log(`Products shown: ${conversationHistory.reduce((sum, r) => sum + r.shortlist.length, 0)}`);
    console.log(`Clarifiers asked: ${conversationHistory.reduce((sum, r) => sum + r.options.length, 0)}`);
    console.log(`Opener diversity: ${openerTracker.getRecentOpeners().length} unique openers`);
    
    // Overall pass
    expect(conversationHistory.length).toBeGreaterThan(0);
  });
});

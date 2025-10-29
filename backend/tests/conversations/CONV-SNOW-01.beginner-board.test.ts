/**
 * Golden Conversation Test: Beginner Snowboard
 * 
 * Tests "fast path" - user provides clear intent upfront.
 * Should show 2-3 products quickly (1-2 turns) since intent is clear.
 * 
 * Expected Flow:
 * 1. User: "beginner snowboard under $400"
 * 2. AI: Shows 2-3 boards immediately (clear intent) OR asks 1 quick clarifier
 */

import { describe, it, expect } from '@jest/globals';
import { startSession, send } from '../utils/convoHarness';
import { assertPersonaChecks } from '../utils/personaLinter';
import { judgeNaturalness, judgeRecommendations } from '../utils/judges';

describe('CONV-SNOW-01: Beginner Snowboard • Fast Path', () => {
  it('shows 2-3 products quickly when intent is clear', async () => {
    const session = await startSession({ persona: 'friendly_expert' });

    // ========================================
    // TURN 1: Clear, specific query
    // ========================================
    console.log('\n📝 Turn 1: "beginner snowboard under $400"');
    
    let response = await send(session, 'beginner snowboard under $400');

    // Persona checks
    assertPersonaChecks(response.text, { allowExclaim: 1 });

    // Check naturalness
    const naturalness = await judgeNaturalness(response.text);
    console.log(`   Naturalness: ${naturalness.score}/5`);
    expect(naturalness.score).toBeGreaterThanOrEqual(4);

    // Should either:
    // A) Show 2-3 products immediately (clear intent)
    // B) Ask 1 quick clarifier then show products next turn

    if (response.shortlist.length > 0) {
      // Path A: Immediate recommendations
      console.log('   ✅ Path A: Immediate recommendations');

      expect(response.shortlist.length).toBeGreaterThanOrEqual(2);
      expect(response.shortlist.length).toBeLessThanOrEqual(3);

      // Each product should have reason
      for (const product of response.shortlist) {
        expect(product.reason).toBeDefined();
        expect(product.reason!.length).toBeGreaterThan(30);
      }

      // Check recommendation quality
      const recommendations = await judgeRecommendations(
        response.text,
        response.shortlist.map((p) => ({ title: p.title || p.id, reason: p.reason }))
      );
      console.log(`   Recommendations: ${recommendations.score}/5`);
      expect(recommendations.score).toBeGreaterThanOrEqual(4);

      // Should mention "beginner" and "$400" in context
      const contextual =
        response.text.toLowerCase().includes('beginner') ||
        response.text.toLowerCase().includes('starting') ||
        response.text.toLowerCase().includes('400') ||
        response.text.toLowerCase().includes('budget');
      expect(contextual).toBe(true);

    } else {
      // Path B: One clarifier first
      console.log('   ✅ Path B: One clarifier first');

      expect(response.clarifiers.length).toBeGreaterThanOrEqual(1);
      expect(response.clarifiers.length).toBeLessThanOrEqual(2);

      // ========================================
      // TURN 2: Answer clarifier
      // ========================================
      console.log('\n📝 Turn 2: Answering clarifier');
      
      response = await send(session, 'all-mountain, just learning');

      // Should show 2-3 products now
      expect(response.shortlist.length).toBeGreaterThanOrEqual(2);
      expect(response.shortlist.length).toBeLessThanOrEqual(3);

      // Check recommendation quality
      const recommendations = await judgeRecommendations(
        response.text,
        response.shortlist.map((p) => ({ title: p.title || p.id, reason: p.reason }))
      );
      console.log(`   Recommendations: ${recommendations.score}/5`);
      expect(recommendations.score).toBeGreaterThanOrEqual(4);
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n📊 Conversation Summary:');
    const turnCount = session.messages.filter((m) => m.role === 'user').length;
    console.log(`   - Total turns: ${turnCount}`);
    console.log(`   - Products shown: ${response.shortlist.length}`);

    // Fast path should complete in 1-2 turns
    expect(turnCount).toBeLessThanOrEqual(2);

  }, 60000);

  it('explains tradeoffs between options', async () => {
    const session = await startSession({ persona: 'friendly_expert' });

    // Get to recommendations
    await send(session, 'beginner snowboard under $400');
    let response = await send(session, 'all-mountain');

    // Should have 2-3 products
    expect(response.shortlist.length).toBeGreaterThanOrEqual(2);

    // Check if tradeoffs are explained
    const fullText = response.text.toLowerCase();
    
    // Look for comparison words
    const hasComparison =
      fullText.includes('but') ||
      fullText.includes('however') ||
      fullText.includes('while') ||
      fullText.includes('whereas') ||
      fullText.includes('more') ||
      fullText.includes('less') ||
      fullText.includes('cheaper') ||
      fullText.includes('lighter') ||
      fullText.includes('heavier');

    expect(hasComparison).toBe(true);

    // Look for specific tradeoffs in reasons
    const reasons = response.shortlist.map((p) => p.reason?.toLowerCase() || '').join(' ');
    
    const hasTradeoffs =
      reasons.includes('but') ||
      reasons.includes('however') ||
      reasons.includes('trade-off') ||
      reasons.includes('tradeoff') ||
      /\$\d+\s+(more|less|cheaper)/.test(reasons);

    expect(hasTradeoffs).toBe(true);

  }, 60000);
});

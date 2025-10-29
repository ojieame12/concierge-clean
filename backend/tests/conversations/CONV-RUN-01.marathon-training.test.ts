/**
 * Golden Conversation Test: Marathon Training Shoes
 * 
 * Tests natural conversation flow for a user training for their first marathon.
 * Validates warmth, progressive clarification, and confident 2-3 product recommendations.
 * 
 * Expected Flow:
 * 1. User: "I need running shoes"
 * 2. AI: Asks about training goal (warm, explains why)
 * 3. User: "Training for a marathon"
 * 4. AI: Asks about road/trail and experience
 * 5. User: "Road, first marathon, 30 miles/week"
 * 6. AI: Shows 2-3 shoes with detailed reasons
 */

import { describe, it, expect } from '@jest/globals';
import { startSession, send } from '../utils/convoHarness';
import { personaChecks } from '../utils/personaLinter';
import { judgeNaturalness, judgeRecommendations, judgeClarification, judgeGuidance } from '../utils/judges';

describe('CONV-RUN-01: Marathon Training • Natural & Progressive', () => {
  it('guides with warm clarifiers → 2-3 shortlist → final pick', async () => {
    const session = await startSession({ persona: 'friendly_expert' });

    // ========================================
    // TURN 1: Initial broad query
    // ========================================
    console.log('\n📝 Turn 1: "I need running shoes"');
    
    let response = await send(session, 'I need running shoes');

    // Persona checks
    const lintResult1 = personaChecks(response.text, { allowExclaim: 1 });
    expect(lintResult1.passed).toBe(true);
    
    // Should ask clarifying question (not show products yet)
    expect(response.clarifiers.length).toBeGreaterThanOrEqual(1);
    expect(response.clarifiers.length).toBeLessThanOrEqual(2);
    expect(response.shortlist.length).toBe(0);

    // Check naturalness
    const naturalness1 = await judgeNaturalness(response.text);
    console.log(`   Naturalness: ${naturalness1.score}/5`);
    naturalness1.reasons.forEach((r) => console.log(`     - ${r}`));
    expect(naturalness1.score).toBeGreaterThanOrEqual(4);

    // Check clarification quality
    const clarification1 = await judgeClarification(response.text, response.clarifiers.length);
    console.log(`   Clarification: ${clarification1.score}/5`);
    clarification1.reasons.forEach((r) => console.log(`     - ${r}`));
    expect(clarification1.score).toBeGreaterThanOrEqual(4);

    // Should explain WHY asking
    const lowerText = response.text.toLowerCase();
    const explainsWhy =
      lowerText.includes('help') ||
      lowerText.includes('find') ||
      lowerText.includes('recommend') ||
      lowerText.includes('point you');
    expect(explainsWhy).toBe(true);

    // ========================================
    // TURN 2: User provides training goal
    // ========================================
    console.log('\n📝 Turn 2: "Training for my first marathon"');
    
    response = await send(session, 'Training for my first marathon');

    // Persona checks
    const lintResult2 = personaChecks(response.text);
    expect(lintResult2.passed).toBe(true);

    // Should ask 1-2 more clarifiers (road vs trail, experience, budget)
    expect(response.clarifiers.length).toBeGreaterThanOrEqual(1);
    expect(response.clarifiers.length).toBeLessThanOrEqual(2);

    // Might show 2-3 preview products, but not required yet
    if (response.shortlist.length > 0) {
      expect(response.shortlist.length).toBeGreaterThanOrEqual(2);
      expect(response.shortlist.length).toBeLessThanOrEqual(3);
    }

    // Should acknowledge and build on previous answer
    const acknowledges =
      response.text.toLowerCase().includes('marathon') ||
      response.text.toLowerCase().includes('training') ||
      response.text.toLowerCase().includes('race');
    expect(acknowledges).toBe(true);

    // Check naturalness
    const naturalness2 = await judgeNaturalness(response.text);
    console.log(`   Naturalness: ${naturalness2.score}/5`);
    expect(naturalness2.score).toBeGreaterThanOrEqual(4);

    // ========================================
    // TURN 3: User provides specifics
    // ========================================
    console.log('\n📝 Turn 3: "Road, first marathon, about 30 miles per week"');
    
    response = await send(session, 'Road, first marathon, about 30 miles per week');

    // Persona checks
    const lintResult3 = personaChecks(response.text);
    expect(lintResult3.passed).toBe(true);

    // Should show 2-3 products now (has enough info)
    expect(response.shortlist.length).toBeGreaterThanOrEqual(2);
    expect(response.shortlist.length).toBeLessThanOrEqual(3);

    // Each product should have detailed reason
    for (const product of response.shortlist) {
      expect(product.reason).toBeDefined();
      expect(product.reason!.length).toBeGreaterThan(50); // Detailed, not generic
      
      // Should cite concrete facts
      const reason = product.reason!.toLowerCase();
      const citesFacts =
        /\$\d+/.test(product.reason!) || // Price
        /\d+/.test(product.reason!) ||   // Numbers (miles, oz, hours)
        reason.includes('review') ||
        reason.includes('customer') ||
        reason.includes('rating');
      
      expect(citesFacts).toBe(true);
    }

    // Check recommendation quality
    const recommendations = await judgeRecommendations(
      response.text,
      response.shortlist.map((p) => ({ title: p.title || p.id, reason: p.reason }))
    );
    console.log(`   Recommendations: ${recommendations.score}/5`);
    recommendations.reasons.forEach((r) => console.log(`     - ${r}`));
    expect(recommendations.score).toBeGreaterThanOrEqual(4);

    // Should have a clear top pick
    expect(response.finalPick).toBeDefined();

    // Should invite follow-up
    const invitesFollowUp =
      response.text.toLowerCase().includes('want to know') ||
      response.text.toLowerCase().includes('questions') ||
      response.text.toLowerCase().includes('anything else') ||
      response.cta !== undefined;
    expect(invitesFollowUp).toBe(true);

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n📊 Conversation Summary:');
    console.log(`   - Total turns: 3`);
    console.log(`   - Total clarifiers: ${response.clarifiers.length}`);
    console.log(`   - Products shown: ${response.shortlist.length}`);
    console.log(`   - Final pick: ${response.finalPick?.title || response.finalPick?.id}`);
    
    // Overall conversation should be efficient (3-4 turns to recommendation)
    expect(session.messages.filter((m) => m.role === 'user').length).toBeLessThanOrEqual(4);

    // Should not ask too many clarifiers total
    const totalClarifiers = response.clarifiers.length;
    expect(totalClarifiers).toBeLessThanOrEqual(6);

  }, 60000); // 60s timeout for API calls

  it('handles off-topic question gracefully', async () => {
    const session = await startSession({ persona: 'friendly_expert' });

    // Build up context
    await send(session, 'I need running shoes');
    await send(session, 'Training for a marathon');

    // ========================================
    // OFF-TOPIC: Ask about weather
    // ========================================
    console.log('\n📝 Off-Topic: "How\'s the weather where you are?"');
    
    const response = await send(session, "How's the weather where you are?");

    // Persona checks
    const lintResult4 = personaChecks(response.text);
    expect(lintResult4.passed).toBe(true);

    // Should acknowledge off-topic warmly (1 sentence)
    // Then return to goal (1 sentence)
    const sentences = response.text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
    expect(sentences.length).toBeGreaterThanOrEqual(2);
    expect(sentences.length).toBeLessThanOrEqual(4);

    // Should still ask a relevant clarifier or show products
    const staysOnTrack =
      response.clarifiers.length > 0 ||
      response.shortlist.length > 0 ||
      response.text.toLowerCase().includes('shoe') ||
      response.text.toLowerCase().includes('marathon') ||
      response.text.toLowerCase().includes('running');
    expect(staysOnTrack).toBe(true);

    // Check guidance quality
    const guidance = await judgeGuidance(response.text, 'marathon training shoes');
    console.log(`   Guidance: ${guidance.score}/5`);
    guidance.reasons.forEach((r) => console.log(`     - ${r}`));
    expect(guidance.score).toBeGreaterThanOrEqual(4);

  }, 60000);
});

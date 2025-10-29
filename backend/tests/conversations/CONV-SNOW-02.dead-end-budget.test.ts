/**
 * CONV-SNOW-02: Dead-End Budget Scenario
 * 
 * Tests graceful handling when budget is too low for available inventory.
 * Should empathetically clarify and offer:
 * 1. Nearest spec match within adjusted budget
 * 2. Optional tasteful upsell with 2+ clear advantages
 * 3. Explanation of value vs. budget tradeoff
 * 
 * Scenario: "4K board under $250" (no exact match)
 * Expected: Clarify needs, suggest ParkPop 148 ($329) + optional upsell
 */

import { startSession, send } from '../utils/convoHarness';
import { personaChecks } from '../utils/personaLinter';
import { judgeNaturalness, judgeRecommendations, judgeClarification } from '../utils/judges';

describe('CONV-SNOW-02: Dead-End Budget Scenario', () => {
  let session: any;

  beforeAll(async () => {
    session = await startSession({
      persona: 'friendly_expert',
      shopDomain: 'snow.local'
    });
  });

  it('should clarify needs when budget is unrealistic', async () => {
    // User asks for impossible budget
    const response1 = await send(session, "I need a 4K snowboard for under $250");

    // Should acknowledge the request
    expect(response1.text.toLowerCase()).toMatch(/board|snowboard/);

    // Should ask clarifying questions (not immediately say "no")
    const clarifiers = response1.clarifiers;
    expect(clarifiers.length).toBeGreaterThanOrEqual(1);

    // Should ask about priorities or use case
    const asksPriority = 
      response1.text.toLowerCase().includes('what') ||
      response1.text.toLowerCase().includes('which') ||
      response1.text.toLowerCase().includes('priority') ||
      response1.text.toLowerCase().includes('important') ||
      response1.text.toLowerCase().includes('looking for');
    
    expect(asksPriority).toBe(true);

    // Should NOT be dismissive or robotic
    const lintResults = personaChecks(response1.text);
    expect(lintResults.violations.filter((v: string) => v.includes('robotic'))).toHaveLength(0);
    
    // Should use contractions
    expect(lintResults.violations.filter((v: string) => v.includes('contraction'))).toHaveLength(0);
  });

  it('should offer nearest match with honest budget discussion', async () => {
    // User clarifies they're a beginner
    const response2 = await send(session, "I'm a beginner, just want something forgiving for learning");

    // Should offer products
    const products = response2.shortlist;
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.length).toBeLessThanOrEqual(3);

    // Should include nearest match (ParkPop 148 at $329 or Snowline Nova at $389)
    const hasAffordableOption = products.some((p: any) => 
      p.price && p.price >= 300 && p.price <= 400
    );
    expect(hasAffordableOption).toBe(true);

    // Should mention budget honestly (not avoid the topic)
    const mentionsBudget = 
      response2.text.toLowerCase().includes('$') ||
      response2.text.toLowerCase().includes('price') ||
      response2.text.toLowerCase().includes('budget') ||
      response2.text.toLowerCase().includes('cost');
    
    expect(mentionsBudget).toBe(true);

    // Should explain VALUE, not just price
    const explainsValue = 
      response2.text.toLowerCase().includes('forgiving') ||
      response2.text.toLowerCase().includes('beginner') ||
      response2.text.toLowerCase().includes('easy') ||
      response2.text.toLowerCase().includes('catch-free') ||
      response2.text.toLowerCase().includes('learn');
    
    expect(explainsValue).toBe(true);
  });

  it('should provide tasteful upsell with clear advantages', async () => {
    const response2 = await send(session, "I'm a beginner, just want something forgiving for learning");

    const products = response2.shortlist;

    // If offering multiple products, should explain tradeoffs
    if (products.length >= 2) {
      // Should mention specific features or advantages
      const mentionsFeatures = 
        response2.text.toLowerCase().includes('flex') ||
        response2.text.toLowerCase().includes('profile') ||
        response2.text.toLowerCase().includes('rocker') ||
        response2.text.toLowerCase().includes('camber') ||
        response2.text.toLowerCase().includes('length') ||
        response2.text.toLowerCase().includes('width');
      
      expect(mentionsFeatures).toBe(true);

      // Should explain WHY one might be better
      const explainsWhy = 
        response2.text.toLowerCase().includes('because') ||
        response2.text.toLowerCase().includes('since') ||
        response2.text.toLowerCase().includes('while') ||
        response2.text.toLowerCase().includes('but') ||
        response2.text.toLowerCase().includes('however');
      
      expect(explainsWhy).toBe(true);
    }

    // Should NOT pressure or use salesy language
    const hasSalesyLanguage = 
      response2.text.toLowerCase().includes('amazing deal') ||
      response2.text.toLowerCase().includes('limited time') ||
      response2.text.toLowerCase().includes('act now') ||
      response2.text.toLowerCase().includes('best seller');
    
    expect(hasSalesyLanguage).toBe(false);
  });

  it('should maintain empathetic tone throughout', async () => {
    // Check all responses for empathy
    const allResponses = session.messages
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => m.content);

    for (const response of allResponses) {
      const lintResults = personaChecks(response);
      
      // Should use contractions (natural, friendly)
      expect(lintResults.violations.filter((v: string) => v.includes('contraction'))).toHaveLength(0);
      
      // Should have sentence variety
      expect(lintResults.violations.filter((v: string) => v.includes('monotonous'))).toHaveLength(0);
      
      // Should not be overly enthusiastic
      const exclamationCount = (response.match(/!/g) || []).length;
      expect(exclamationCount).toBeLessThanOrEqual(1);
    }
  });

  it('should score well on clarification quality', async () => {
    const conversation = session.messages.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // Get first assistant message (should have clarification)
    const firstAssistant = conversation.filter((m: any) => m.role === 'assistant')[0];
    const score = await judgeClarification(firstAssistant?.content || '', 1);
    
    // Should score at least 4.0 on clarification
    expect(score.score).toBeGreaterThanOrEqual(4.0);
    
    console.log('Clarification Score:', score.score);
    console.log('Reasons:', score.reasons);
  });

  it('should score well on naturalness', async () => {
    const conversation = session.messages.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // Get last assistant message
    const lastAssistant = conversation.filter((m: any) => m.role === 'assistant').pop();
    const score = await judgeNaturalness(lastAssistant?.content || '');
    
    // Should score at least 4.0 on naturalness
    expect(score.score).toBeGreaterThanOrEqual(4.0);
    
    console.log('Naturalness Score:', score.score);
    console.log('Reasons:', score.reasons);
  });

  it('should score well on recommendations despite budget constraint', async () => {
    const conversation = session.messages.map((m: any) => ({
      role: m.role,
      content: m.content
    }));

    // Get last response with products
    const lastAssistant = conversation.filter((m: any) => m.role === 'assistant').pop();
    const products = session.messages[session.messages.length - 1]?.shortlist || [];
    
    const score = await judgeRecommendations(lastAssistant?.content || '', products);
    
    // Should score at least 4.0 on recommendations
    expect(score.score).toBeGreaterThanOrEqual(4.0);
    
    console.log('Recommendations Score:', score.score);
    console.log('Reasons:', score.reasons);
  });

  afterAll(() => {
    // Log full conversation for review
    console.log('\n=== Full Conversation ===');
    session.messages.forEach((m: any, i: number) => {
      console.log(`\n[${i + 1}] ${m.role.toUpperCase()}:`);
      console.log(m.content);
    });
  });
});

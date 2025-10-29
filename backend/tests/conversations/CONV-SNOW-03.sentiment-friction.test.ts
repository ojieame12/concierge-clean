/**
 * CONV-SNOW-03: Sentiment & Friction Handling Test
 * 
 * Tests that the system handles mild frustration with empathy and concrete recovery.
 * This is critical for maintaining trust when things go wrong.
 * 
 * Scenario:
 * 1. User expresses frustration about stock availability
 * 2. System responds with empathy + concrete recovery
 * 3. Offers nearest alternatives with actionable next steps
 * 
 * Success Criteria:
 * - 1 empathetic sentence in response
 * - Concrete recovery ("closest spec under $X" + notify/relax)
 * - Naturalness score ≥ 3.7
 * - No defensive or robotic language
 */

import { startSession, send, endSession } from '../utils/convoHarness';
import { personaChecks } from '../utils/personaLinter';
import { judgeNaturalness } from '../utils/judges';

describe('CONV-SNOW-03: Sentiment & Friction Handling', () => {
  let session: any;

  beforeAll(async () => {
    session = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });
  });

  afterAll(async () => {
    if (session) {
      await endSession(session);
    }
  });

  it('should handle frustration with empathy', async () => {
    console.log('\n📝 Turn 1: User expresses frustration');
    const response = await send(
      session,
      "Why is everything out of stock? This is frustrating."
    );

    console.log('Response:', response.text);

    const textLower = response.text.toLowerCase();

    // Should include empathetic language
    const hasEmpathy =
      textLower.includes('sorry') ||
      textLower.includes('understand') ||
      textLower.includes('frustrating') ||
      textLower.includes('appreciate') ||
      textLower.includes('know') ||
      textLower.includes('hear you') ||
      textLower.includes('feel');

    expect(hasEmpathy).toBe(true);

    // Should NOT be defensive or robotic
    const lintResults = personaChecks(response.text);
    expect(
      lintResults.violations.filter((v: string) => v.includes('robotic'))
    ).toHaveLength(0);

    // Should not blame the user
    expect(textLower.includes('unfortunately')).toBe(false);
    expect(textLower.includes('however')).toBe(false);
  });

  it('should provide concrete recovery options', async () => {
    const response = await send(
      session,
      "I just want a decent beginner board that's actually available"
    );

    console.log('Recovery response:', response.text);

    const textLower = response.text.toLowerCase();

    // Should offer concrete alternatives
    const hasAlternatives =
      textLower.includes('available') ||
      textLower.includes('in stock') ||
      textLower.includes('have') ||
      textLower.includes('can get') ||
      textLower.includes('ready to ship');

    expect(hasAlternatives).toBe(true);

    // Should show products or be very close to showing them
    const hasProducts = response.shortlist.length > 0;
    const promisesProducts = 
      textLower.includes('show you') ||
      textLower.includes('recommend') ||
      textLower.includes('perfect for');

    expect(hasProducts || promisesProducts).toBe(true);
  });

  it('should offer actionable next steps', async () => {
    const response = await send(
      session,
      "What if none of these work for me?"
    );

    console.log('Next steps response:', response.text);

    const textLower = response.text.toLowerCase();

    // Should offer actionable options
    const hasActions =
      textLower.includes('notify') ||
      textLower.includes('alert') ||
      textLower.includes('email') ||
      textLower.includes('let you know') ||
      textLower.includes('check back') ||
      textLower.includes('adjust') ||
      textLower.includes('broaden') ||
      textLower.includes('relax') ||
      textLower.includes('different') ||
      textLower.includes('other options');

    expect(hasActions).toBe(true);
  });

  it('should maintain empathetic tone throughout friction', async () => {
    const fullConversation = session.conversationHistory || [];
    
    // Check all assistant responses
    const assistantResponses = fullConversation
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => m.content);

    for (const response of assistantResponses) {
      const lintResults = personaChecks(response);
      
      // Should have no robotic violations
      expect(
        lintResults.violations.filter((v: string) => v.includes('robotic'))
      ).toHaveLength(0);
      
      // Should use contractions (sounds more human)
      expect(
        lintResults.violations.filter((v: string) => v.includes('contraction'))
      ).toHaveLength(0);

      // Should not be overly enthusiastic during frustration
      const exclamationCount = (response.match(/!/g) || []).length;
      expect(exclamationCount).toBeLessThanOrEqual(1);
    }
  });

  it('should score well on naturalness despite friction', async () => {
    const fullConversation = session.conversationHistory || [];
    const conversationText = fullConversation
      .map((m: any) => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    const score = await judgeNaturalness(conversationText);

    console.log('Naturalness Score:', score.score);
    console.log('Reasons:', score.reasons);

    // Should maintain natural tone even during friction
    expect(score.score).toBeGreaterThanOrEqual(3.7);
  });

  it('should acknowledge user emotion explicitly', async () => {
    const session2 = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const response = await send(
      session2,
      "I've been looking for weeks and can't find anything in my size. This is really annoying."
    );

    console.log('Emotion acknowledgment:', response.text);

    const textLower = response.text.toLowerCase();

    // Should acknowledge the emotion
    const acknowledgesEmotion =
      textLower.includes('frustrat') ||
      textLower.includes('annoying') ||
      textLower.includes('understand') ||
      textLower.includes('hear you') ||
      textLower.includes('tough') ||
      textLower.includes('difficult');

    expect(acknowledgesEmotion).toBe(true);

    // Should not minimize the emotion
    expect(textLower.includes('just')).toBe(false); // "it's just..."
    expect(textLower.includes('simply')).toBe(false); // "simply..."

    await endSession(session2);
  });

  it('should provide specific recovery with price/spec', async () => {
    const session3 = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    await send(session3, "Everything I want is sold out");
    const response = await send(
      session3,
      "I need something under $400 for all-mountain riding"
    );

    console.log('Specific recovery:', response.text);

    const textLower = response.text.toLowerCase();

    // Should mention specific price or spec
    const hasSpecifics =
      textLower.includes('$') ||
      textLower.includes('price') ||
      textLower.includes('under') ||
      textLower.includes('all-mountain') ||
      textLower.includes('mountain');

    expect(hasSpecifics).toBe(true);

    // Should show products or be very specific about what's available
    expect(
      response.shortlist.length > 0 ||
      textLower.includes('available') ||
      textLower.includes('in stock')
    ).toBe(true);

    await endSession(session3);
  });

  it('should not over-apologize', async () => {
    const fullConversation = session.conversationHistory || [];
    
    const assistantResponses = fullConversation
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => m.content);

    // Count total apologies
    let apologyCount = 0;
    for (const response of assistantResponses) {
      const textLower = response.toLowerCase();
      if (textLower.includes('sorry') || textLower.includes('apologize')) {
        apologyCount++;
      }
    }

    console.log('Total apologies:', apologyCount);
    console.log('Total responses:', assistantResponses.length);

    // Should apologize at most once (empathy, not groveling)
    expect(apologyCount).toBeLessThanOrEqual(1);
  });

  it('should shift from empathy to solution quickly', async () => {
    const session4 = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const response = await send(
      session4,
      "I'm so frustrated, nothing is available in my size"
    );

    console.log('Empathy + solution:', response.text);

    // Response should have both empathy AND solution in same turn
    const textLower = response.text.toLowerCase();

    const hasEmpathy =
      textLower.includes('understand') ||
      textLower.includes('frustrat') ||
      textLower.includes('sorry');

    const hasSolution =
      textLower.includes('available') ||
      textLower.includes('have') ||
      textLower.includes('show you') ||
      textLower.includes('recommend') ||
      response.shortlist.length > 0;

    // Should have BOTH in the same response (don't drag it out)
    expect(hasEmpathy && hasSolution).toBe(true);

    await endSession(session4);
  });
});

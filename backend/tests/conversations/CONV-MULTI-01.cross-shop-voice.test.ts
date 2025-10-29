/**
 * CONV-MULTI-01: Cross-Shop Brand Voice Test
 * 
 * Tests that brand voice switches correctly across different shops.
 * Prevents tone carry-over between sessions - a common real-world bug.
 * 
 * Scenario:
 * 1. Start conversation with Shop A (running shoes - cheerleader coach)
 * 2. Start separate conversation with Shop B (snowboards - neutral expert)
 * 3. Verify each maintains distinct voice
 * 4. Verify no tone bleed between shops
 * 
 * Success Criteria:
 * - Shop A uses enthusiastic, motivational tone
 * - Shop B uses calm, expert tone
 * - No voice characteristics carry over
 * - Each follows its own Store Card personality
 */

import { startSession, send, endSession } from '../utils/convoHarness';
import { personaChecks } from '../utils/personaLinter';

describe('CONV-MULTI-01: Cross-Shop Brand Voice', () => {
  it('should maintain distinct voice for running shop (cheerleader coach)', async () => {
    const runSession = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach', // Warm, motivational
    });

    const response = await send(
      runSession,
      "I'm training for a marathon"
    );

    console.log('\n🏃 Running Shop Response:', response.text);

    const textLower = response.text.toLowerCase();

    // Should use enthusiastic, motivational language
    const hasEnthusiasm =
      textLower.includes('awesome') ||
      textLower.includes('amazing') ||
      textLower.includes('exciting') ||
      textLower.includes('great') ||
      textLower.includes('perfect') ||
      textLower.includes('love');

    // Should use motivational framing
    const hasMotivation =
      textLower.includes('training') ||
      textLower.includes('goal') ||
      textLower.includes('achieve') ||
      textLower.includes('ready') ||
      textLower.includes('help you');

    expect(hasEnthusiasm || hasMotivation).toBe(true);

    // Should be warm and personal
    const lintResults = personaChecks(response.text);
    expect(
      lintResults.violations.filter((v: string) => v.includes('contraction'))
    ).toHaveLength(0); // Must use contractions

    await endSession(runSession);
  });

  it('should maintain distinct voice for snow shop (neutral expert)', async () => {
    const snowSession = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert', // Neutral, knowledgeable
    });

    const response = await send(
      snowSession,
      "I'm looking for a beginner snowboard"
    );

    console.log('\n🏂 Snow Shop Response:', response.text);

    const textLower = response.text.toLowerCase();

    // Should use expert, informative language
    const hasExpertise =
      textLower.includes('forgiving') ||
      textLower.includes('flex') ||
      textLower.includes('terrain') ||
      textLower.includes('riding') ||
      textLower.includes('style') ||
      textLower.includes('experience');

    expect(hasExpertise).toBe(true);

    // Should be friendly but not overly enthusiastic
    const exclamationCount = (response.text.match(/!/g) || []).length;
    expect(exclamationCount).toBeLessThanOrEqual(1);

    // Should still be warm (contractions)
    const lintResults = personaChecks(response.text);
    expect(
      lintResults.violations.filter((v: string) => v.includes('contraction'))
    ).toHaveLength(0);

    await endSession(snowSession);
  });

  it('should not carry over enthusiasm from running to snow shop', async () => {
    // First: enthusiastic running shop conversation
    const runSession = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach',
    });

    const runResponse = await send(
      runSession,
      "I want to run my first 5K!"
    );

    console.log('\n🏃 Running Shop (enthusiastic):', runResponse.text);

    const runExclamations = (runResponse.text.match(/!/g) || []).length;
    console.log('Running shop exclamations:', runExclamations);

    await endSession(runSession);

    // Then: neutral snow shop conversation (should NOT be enthusiastic)
    const snowSession = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const snowResponse = await send(
      snowSession,
      "I want to try snowboarding for the first time"
    );

    console.log('\n🏂 Snow Shop (neutral):', snowResponse.text);

    const snowExclamations = (snowResponse.text.match(/!/g) || []).length;
    console.log('Snow shop exclamations:', snowExclamations);

    // Snow shop should be noticeably less enthusiastic
    expect(snowExclamations).toBeLessThanOrEqual(1);

    // Snow shop should not use cheerleader language
    const snowTextLower = snowResponse.text.toLowerCase();
    expect(snowTextLower.includes('awesome')).toBe(false);
    expect(snowTextLower.includes('amazing')).toBe(false);
    expect(snowTextLower.includes('crush it')).toBe(false);
    expect(snowTextLower.includes('let\'s go')).toBe(false);

    await endSession(snowSession);
  });

  it('should not carry over neutral tone from snow to running shop', async () => {
    // First: neutral snow shop conversation
    const snowSession = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const snowResponse = await send(
      snowSession,
      "I need an all-mountain board"
    );

    console.log('\n🏂 Snow Shop (neutral):', snowResponse.text);

    await endSession(snowSession);

    // Then: enthusiastic running shop (should NOT be too neutral)
    const runSession = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach',
    });

    const runResponse = await send(
      runSession,
      "I want to improve my 10K time"
    );

    console.log('\n🏃 Running Shop (enthusiastic):', runResponse.text);

    const textLower = runResponse.text.toLowerCase();

    // Running shop should show enthusiasm
    const hasEnthusiasm =
      textLower.includes('awesome') ||
      textLower.includes('great') ||
      textLower.includes('exciting') ||
      textLower.includes('perfect') ||
      textLower.includes('love') ||
      (runResponse.text.match(/!/g) || []).length >= 1;

    expect(hasEnthusiasm).toBe(true);

    await endSession(runSession);
  });

  it('should use shop-specific terminology', async () => {
    // Running shop: should use running terms
    const runSession = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach',
    });

    const runResponse = await send(
      runSession,
      "What shoes do you recommend?"
    );

    console.log('\n🏃 Running terminology:', runResponse.text);

    const runTextLower = runResponse.text.toLowerCase();
    const hasRunningTerms =
      runTextLower.includes('run') ||
      runTextLower.includes('pace') ||
      runTextLower.includes('distance') ||
      runTextLower.includes('training') ||
      runTextLower.includes('road') ||
      runTextLower.includes('trail');

    expect(hasRunningTerms).toBe(true);

    // Should NOT use snowboarding terms
    expect(runTextLower.includes('board')).toBe(false);
    expect(runTextLower.includes('riding')).toBe(false);
    expect(runTextLower.includes('mountain')).toBe(false);
    expect(runTextLower.includes('powder')).toBe(false);

    await endSession(runSession);

    // Snow shop: should use snowboarding terms
    const snowSession = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const snowResponse = await send(
      snowSession,
      "What board do you recommend?"
    );

    console.log('\n🏂 Snow terminology:', snowResponse.text);

    const snowTextLower = snowResponse.text.toLowerCase();
    const hasSnowTerms =
      snowTextLower.includes('board') ||
      snowTextLower.includes('riding') ||
      snowTextLower.includes('terrain') ||
      snowTextLower.includes('mountain') ||
      snowTextLower.includes('snow') ||
      snowTextLower.includes('flex');

    expect(hasSnowTerms).toBe(true);

    // Should NOT use running terms
    expect(snowTextLower.includes('running')).toBe(false);
    expect(snowTextLower.includes('pace')).toBe(false);
    expect(snowTextLower.includes('distance')).toBe(false);
    expect(snowTextLower.includes('marathon')).toBe(false);

    await endSession(snowSession);
  });

  it('should follow shop-specific Store Card personality', async () => {
    // Test that each shop follows its Store Card
    const runSession = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach',
    });

    const snowSession = await startSession({
      shopDomain: 'snow.local',
      persona: 'friendly_expert',
    });

    const runResponse = await send(runSession, "Tell me about your store");
    const snowResponse = await send(snowSession, "Tell me about your store");

    console.log('\n🏃 Running Store Card:', runResponse.text);
    console.log('\n🏂 Snow Store Card:', snowResponse.text);

    // Responses should be distinctly different
    expect(runResponse.text).not.toBe(snowResponse.text);

    // Running shop should mention Trail & Tread
    expect(
      runResponse.text.toLowerCase().includes('trail') ||
      runResponse.text.toLowerCase().includes('tread')
    ).toBe(true);

    // Snow shop should mention Snowline Boards
    expect(
      snowResponse.text.toLowerCase().includes('snowline') ||
      snowResponse.text.toLowerCase().includes('boards')
    ).toBe(true);

    await endSession(runSession);
    await endSession(snowSession);
  });

  it('should maintain voice consistency within same shop across turns', async () => {
    const session = await startSession({
      shopDomain: 'run.local',
      persona: 'cheerleader_coach',
    });

    const response1 = await send(session, "I need running shoes");
    const response2 = await send(session, "For marathon training");
    const response3 = await send(session, "What do you recommend?");

    console.log('\n🏃 Turn 1:', response1.text);
    console.log('\n🏃 Turn 2:', response2.text);
    console.log('\n🏃 Turn 3:', response3.text);

    // All responses should maintain enthusiastic tone
    const exclamations1 = (response1.text.match(/!/g) || []).length;
    const exclamations2 = (response2.text.match(/!/g) || []).length;
    const exclamations3 = (response3.text.match(/!/g) || []).length;

    console.log('Exclamations:', exclamations1, exclamations2, exclamations3);

    // Should be consistently enthusiastic (at least 1 exclamation in 3 turns)
    const totalExclamations = exclamations1 + exclamations2 + exclamations3;
    expect(totalExclamations).toBeGreaterThanOrEqual(1);

    // All should use contractions
    for (const response of [response1, response2, response3]) {
      const lintResults = personaChecks(response.text);
      expect(
        lintResults.violations.filter((v: string) => v.includes('contraction'))
      ).toHaveLength(0);
    }

    await endSession(session);
  });
});

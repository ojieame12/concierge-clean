/**
 * CONV-RUN-03: Memory & Non-Repetition Test
 * 
 * Tests that the system remembers context and doesn't repeat clarifying questions.
 * This is a common frustration point in conversational AI.
 * 
 * Scenario:
 * 1. User provides budget and size upfront
 * 2. System asks follow-up questions
 * 3. Three turns later, verify system doesn't re-ask budget or size
 * 
 * Success Criteria:
 * - Zero repeat clarifiers
 * - Guidance score ≥ 3.7
 * - Natural conversation flow
 */

import { startSession, send, endSession } from '../utils/convoHarness';
import { personaChecks } from '../utils/personaLinter';
import { judgeGuidance } from '../utils/judges';

describe('CONV-RUN-03: Memory & Non-Repetition', () => {
  let session: any;

  beforeAll(async () => {
    session = await startSession({
      shopDomain: 'run.local',
      persona: 'friendly_expert',
    });
  });

  afterAll(async () => {
    if (session) {
      await endSession(session);
    }
  });

  it('should remember budget and size across multiple turns', async () => {
    console.log('\n📝 Turn 1: User provides budget and size upfront');
    const response1 = await send(
      session,
      "I need running shoes for marathon training. My budget is $150 and I wear size 10."
    );

    // Should acknowledge the information
    const text1Lower = response1.text.toLowerCase();
    expect(
      text1Lower.includes('150') || 
      text1Lower.includes('budget') ||
      text1Lower.includes('size 10') ||
      text1Lower.includes('10')
    ).toBe(true);

    // Should ask follow-up questions (but NOT budget or size)
    expect(response1.clarifiers.length).toBeGreaterThanOrEqual(1);

    console.log('\n📝 Turn 2: User answers follow-up');
    const response2 = await send(
      session,
      "I've been running for 2 years, mostly on roads"
    );

    // Should continue conversation naturally
    expect(response2.text.length).toBeGreaterThan(50);

    console.log('\n📝 Turn 3: User provides more context');
    const response3 = await send(
      session,
      "I prefer neutral shoes, nothing too cushioned"
    );

    // Should be working toward recommendation
    const hasProducts = response3.shortlist.length > 0;
    const hasMoreQuestions = response3.clarifiers.length > 0;
    expect(hasProducts || hasMoreQuestions).toBe(true);

    console.log('\n📝 Turn 4: Final clarification or recommendation');
    const response4 = await send(
      session,
      "Yes, show me what you recommend"
    );

    // Collect all clarifier questions from all turns
    const allClarifiers = [
      ...response1.clarifiers,
      ...response2.clarifiers,
      ...response3.clarifiers,
      ...response4.clarifiers,
    ];

    console.log('\n🔍 All clarifiers asked:', allClarifiers);

    // Check for repeat questions about budget or size
    const budgetQuestions = allClarifiers.filter((q: string) =>
      q.toLowerCase().includes('budget') ||
      q.toLowerCase().includes('price') ||
      q.toLowerCase().includes('spend') ||
      q.toLowerCase().includes('$') ||
      q.toLowerCase().includes('cost')
    );

    const sizeQuestions = allClarifiers.filter((q: string) =>
      q.toLowerCase().includes('size') ||
      q.toLowerCase().includes('fit') ||
      q.toLowerCase().includes('10') ||
      q.toLowerCase().includes('ten')
    );

    console.log('Budget-related questions:', budgetQuestions.length);
    console.log('Size-related questions:', sizeQuestions.length);

    // Should ask about budget/size at most ONCE (if at all, since user provided upfront)
    expect(budgetQuestions.length).toBeLessThanOrEqual(1);
    expect(sizeQuestions.length).toBeLessThanOrEqual(1);
  });

  it('should not repeat any clarifier across turns', async () => {
    // Start fresh session
    const session2 = await startSession({
      shopDomain: 'run.local',
      persona: 'friendly_expert',
    });

    const response1 = await send(session2, "I need trail running shoes");
    const response2 = await send(session2, "For rocky terrain");
    const response3 = await send(session2, "I'm an intermediate runner");

    const allClarifiers = [
      ...response1.clarifiers,
      ...response2.clarifiers,
      ...response3.clarifiers,
    ];

    // Check for duplicate questions (case-insensitive, trimmed)
    const normalizedQuestions = allClarifiers.map((q: string) =>
      q.toLowerCase().trim().replace(/[?.!]/g, '')
    );

    const uniqueQuestions = new Set(normalizedQuestions);

    console.log('Total clarifiers:', allClarifiers.length);
    console.log('Unique clarifiers:', uniqueQuestions.size);

    // Should not have exact duplicate questions
    expect(uniqueQuestions.size).toBe(allClarifiers.length);

    await endSession(session2);
  });

  it('should maintain context across conversation', async () => {
    const session3 = await startSession({
      shopDomain: 'run.local',
      persona: 'friendly_expert',
    });

    const response1 = await send(
      session3,
      "I'm training for my first marathon"
    );
    
    const response2 = await send(
      session3,
      "I've been running 5Ks for a year"
    );

    const response3 = await send(
      session3,
      "What do you recommend?"
    );

    // Final response should reference earlier context
    const text3Lower = response3.text.toLowerCase();
    const referencesMarathon = 
      text3Lower.includes('marathon') ||
      text3Lower.includes('first') ||
      text3Lower.includes('training');

    const referencesExperience =
      text3Lower.includes('5k') ||
      text3Lower.includes('year') ||
      text3Lower.includes('experience') ||
      text3Lower.includes('been running');

    // Should reference at least one piece of earlier context
    expect(referencesMarathon || referencesExperience).toBe(true);

    await endSession(session3);
  });

  it('should score well on guidance quality', async () => {
    // Collect full conversation from first test
    const fullConversation = session.conversationHistory || [];

    // Judge the guidance quality
    const score = await judgeGuidance(
      fullConversation.map((m: any) => m.content).join('\n\n')
    );

    console.log('Guidance Score:', score.score);
    console.log('Reasons:', score.reasons);

    // Should score at least 3.7 on guidance
    expect(score.score).toBeGreaterThanOrEqual(3.7);
  });

  it('should maintain natural tone throughout', async () => {
    const fullConversation = session.conversationHistory || [];
    
    // Check each assistant response
    const assistantResponses = fullConversation
      .filter((m: any) => m.role === 'assistant')
      .map((m: any) => m.content);

    for (const response of assistantResponses) {
      const lintResults = personaChecks(response);
      
      // Should have no robotic violations
      expect(
        lintResults.violations.filter((v: string) => v.includes('robotic'))
      ).toHaveLength(0);
      
      // Should use contractions
      expect(
        lintResults.violations.filter((v: string) => v.includes('contraction'))
      ).toHaveLength(0);
    }
  });

  it('should build on previous answers progressively', async () => {
    const session4 = await startSession({
      shopDomain: 'run.local',
      persona: 'friendly_expert',
    });

    const response1 = await send(session4, "I need running shoes");
    const question1 = response1.clarifiers[0] || '';

    const response2 = await send(session4, "For road running");
    const question2 = response2.clarifiers[0] || '';

    const response3 = await send(session3, "I'm a beginner");
    const question3 = response3.clarifiers[0] || '';

    console.log('Q1:', question1);
    console.log('Q2:', question2);
    console.log('Q3:', question3);

    // Questions should be progressively more specific
    // (hard to test automatically, but we can check they're different)
    expect(question1).not.toBe(question2);
    expect(question2).not.toBe(question3);
    expect(question1).not.toBe(question3);

    // Later questions should not ask about already-answered topics
    const q2Lower = question2.toLowerCase();
    const q3Lower = question3.toLowerCase();

    // Q2 shouldn't ask about road/trail again (user said "road")
    if (question1.toLowerCase().includes('road') || question1.toLowerCase().includes('trail')) {
      expect(
        q2Lower.includes('road') || q2Lower.includes('trail')
      ).toBe(false);
    }

    await endSession(session4);
  });
});

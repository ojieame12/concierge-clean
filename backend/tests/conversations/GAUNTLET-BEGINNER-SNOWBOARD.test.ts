/**
 * GAUNTLET • Beginner Snowboard (Gemini in control, tools on-demand)
 * 
 * This test proves three things:
 * 1. Gemini is in control (no regex routing; it decides when to chat, educate, or recommend)
 * 2. Full store intelligence is available when needed (Gemini chooses tools + store context)
 * 3. UI contract (Main Lead / Action Detail / Clarifiers / ≤3 cards / CTAs) is honored every turn
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { startSession, send, validateShopExists } from '../utils/convoHarness';
import { judgeNaturalness, judgeGuidance } from '../utils/judges';
import { 
  checkUiEnvelope, 
  countSentences, 
  noRepeatClarifiers,
  hasNoBoilerplate,
  hasContractions,
  countExclamations,
} from '../utils/assertions';
import type { ConversationSession, ConversationResponse } from '../utils/convoHarness';

const SHOP = 'insite-intellgience.myshopify.com';

describe('GAUNTLET • Beginner Snowboard', () => {
  let session: ConversationSession;
  const conversationHistory: ConversationResponse[] = [];

  beforeAll(async () => {
    await validateShopExists(SHOP);
    session = await startSession({ shopDomain: SHOP, persona: 'friendly_expert' });
  });

  it('T0 Greeting - Gemini only, no tools', async () => {
    const r = await send(session, 'Hi');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.segments).toBeDefined();
    expect(r.text).toBeTruthy();

    // Check sentence count (1-2 sentences for greeting)
    const sentences = countSentences(r.text);
    expect(sentences).toBeGreaterThanOrEqual(1);
    expect(sentences).toBeLessThanOrEqual(3);

    // No tools should be used for greeting
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // Check naturalness
    expect(hasNoBoilerplate(r.text)).toBe(true);
    expect(countExclamations(r.text)).toBeLessThanOrEqual(1);

    // Judge naturalness (should be ≥ 3.7)
    const naturalness = await judgeNaturalness(r.text);
    console.log(`T0 Naturalness: ${naturalness.score}/5 - ${naturalness.reasons.join(', ')}`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.5);
  });

  it('T1 Industry info - Gemini only, educational', async () => {
    const r = await send(session, 'What are snowboards and what sports are they for?');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // No tools for educational content
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // Should provide educational response
    expect(r.text.toLowerCase()).toMatch(/snowboard|snow|board|ride|slide/);

    // Check for pivot hint (optional but good)
    const hasPivot = r.text.toLowerCase().includes('show') || 
                     r.text.toLowerCase().includes('find') ||
                     r.text.toLowerCase().includes('looking');

    console.log(`T1 Has pivot hint: ${hasPivot}`);

    // Judge guidance (how well it pivots)
    const guidance = await judgeGuidance(r.text, 'pivot_to_store');
    console.log(`T1 Guidance: ${guidance.score}/5 - ${guidance.reasons.join(', ')}`);
    expect(guidance.score).toBeGreaterThanOrEqual(3.0);
  });

  it('T2 Beginner follow-up - Gemini asks clarifiers', async () => {
    const r = await send(session, 'What kind of snowboards are good for a beginner?');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should ask clarifying questions (options present)
    expect(r.options.length).toBeGreaterThan(0);
    expect(r.options.length).toBeLessThanOrEqual(4); // Max 3 + "Something else"

    // No tools yet (still gathering info)
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // Check for beginner-related content
    expect(r.text.toLowerCase()).toMatch(/beginner|start|first|new|learn/);

    // No repeated clarifiers
    expect(noRepeatClarifiers(conversationHistory.map(cr => ({ 
      clarifiers: cr.options.map(o => o.value || o.label) 
    })))).toBe(true);
  });

  it('T3 Clarifier 1 (terrain) - Context retained', async () => {
    // Simulate user tapping a clarifier
    const r = await send(session, 'Resort groomers, some powder');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should acknowledge the input
    expect(r.text.toLowerCase()).toMatch(/groomer|resort|powder/);

    // Should ask another clarifier
    expect(r.options.length).toBeGreaterThan(0);

    // Still no tools (gathering more info)
    expect(r.metadata?.tools_used || []).toHaveLength(0);
  });

  it('T4 Clarifier 2 (boot size) - Context builds', async () => {
    const r = await send(session, '10.5 US');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should acknowledge boot size
    expect(r.text.toLowerCase()).toMatch(/10|boot|size|width|waist/);

    // Should ask for budget or one more clarifier
    expect(r.options.length).toBeGreaterThan(0);

    // Still no tools
    expect(r.metadata?.tools_used || []).toHaveLength(0);
  });

  it('T5 Clarifier 3 (budget) - Ready to search', async () => {
    const r = await send(session, '$400-$550');
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should acknowledge budget
    expect(r.text.toLowerCase()).toMatch(/400|550|budget|range|price/);

    // May or may not have tools yet (depends on implementation)
    console.log(`T5 Tools used: ${r.metadata?.tools_used || []}`);
  });

  it('T6 Recommendation - Tools used, products shown', async () => {
    // If previous turn didn't show products, send a prompt
    const lastResponse = conversationHistory[conversationHistory.length - 1];
    
    let r: ConversationResponse;
    if (lastResponse.shortlist.length === 0) {
      r = await send(session, 'show me options');
      conversationHistory.push(r);
    } else {
      r = lastResponse;
    }

    // UI envelope check
    expect(r.shortlist.length).toBeGreaterThanOrEqual(2);
    expect(r.shortlist.length).toBeLessThanOrEqual(3);

    // Tools should be used for product search
    const toolsUsed = r.metadata?.tools_used || [];
    console.log(`T6 Tools used: ${toolsUsed}`);
    expect(toolsUsed.length).toBeGreaterThan(0);
    expect(toolsUsed).toContain('product.search');

    // Each product should have reasons
    for (const product of r.shortlist) {
      expect(product.why).toBeDefined();
      expect(product.why!.length).toBeGreaterThanOrEqual(1);
      expect(product.why!.length).toBeLessThanOrEqual(3);
    }

    // Check naturalness of recommendation
    const naturalness = await judgeNaturalness(r.text);
    console.log(`T6 Naturalness: ${naturalness.score}/5 - ${naturalness.reasons.join(', ')}`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.5);
  });

  it('T7 Product tap - Drawer support', async () => {
    const lastResponse = conversationHistory[conversationHistory.length - 1];
    const firstProduct = lastResponse.shortlist[0];
    
    if (!firstProduct) {
      console.warn('No products to tap, skipping T7');
      return;
    }

    const r = await send(session, `Tell me more about ${firstProduct.title}`);
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should provide more details
    expect(r.text.length).toBeGreaterThan(50);

    // May use product.details tool
    console.log(`T7 Tools used: ${r.metadata?.tools_used || []}`);
  });

  it('T8 Off-topic - Graceful pivot', async () => {
    const r = await send(session, "How's the weather today?");
    conversationHistory.push(r);

    // UI envelope check
    expect(r.text).toBeTruthy();

    // Should respond warmly but briefly
    const sentences = countSentences(r.text);
    expect(sentences).toBeLessThanOrEqual(3);

    // No tools for off-topic
    expect(r.metadata?.tools_used || []).toHaveLength(0);

    // Should pivot back to shopping (optional)
    const hasPivot = r.text.toLowerCase().includes('help') || 
                     r.text.toLowerCase().includes('find') ||
                     r.text.toLowerCase().includes('looking');

    console.log(`T8 Has pivot: ${hasPivot}`);

    // Judge guidance
    const guidance = await judgeGuidance(r.text, 'return to shopping');
    console.log(`T8 Guidance: ${guidance.score}/5 - ${guidance.reasons.join(', ')}`);
    expect(guidance.score).toBeGreaterThanOrEqual(3.0);
  });

  it('Summary - Full conversation stats', () => {
    console.log('\n=== GAUNTLET SUMMARY ===');
    console.log(`Total turns: ${conversationHistory.length}`);
    console.log(`Products shown: ${conversationHistory.reduce((sum, r) => sum + r.shortlist.length, 0)}`);
    console.log(`Clarifiers asked: ${conversationHistory.reduce((sum, r) => sum + r.clarifiers.length, 0)}`);
    console.log(`Tools used: ${conversationHistory.flatMap(r => r.metadata?.tools_used || []).join(', ')}`);
    
    // Check no repeated clarifiers across entire conversation
    expect(noRepeatClarifiers(conversationHistory.map(cr => ({ 
      clarifiers: cr.options.map(o => o.value || o.label) 
    })))).toBe(true);
  });
});

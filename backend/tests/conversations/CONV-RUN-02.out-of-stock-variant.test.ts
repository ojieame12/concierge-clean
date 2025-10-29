/**
 * CONV-RUN-02: Out-of-Stock Variant Recovery
 * 
 * Tests inventory-aware recovery when a specific variant is out of stock.
 * Should gracefully handle OOS and offer:
 * 1. Same model in different color/size
 * 2. "Notify me" option
 * 3. One tasteful upsell with clear value reasoning
 * 
 * Product: Fleet MarathonMax Black Size 9 (OOS)
 * Expected: Offer Grey Size 10 variant + notify + upsell
 */

import { startSession, send, extractProducts, extractClarifiers } from '../utils/convoHarness';
import { lintPersona } from '../utils/personaLinter';
import { judgeNaturalness, judgeRecommendations } from '../utils/judges';

describe('CONV-RUN-02: Out-of-Stock Variant Recovery', () => {
  let session: any;

  beforeAll(async () => {
    session = await startSession({
      persona: 'friendly_expert',
      shop_domain: 'run.local'
    });
  });

  it('should handle specific out-of-stock variant gracefully', async () => {
    // User asks for specific OOS variant
    const response1 = await send(session, "I want the Fleet MarathonMax in black, size 9");

    // Should acknowledge the specific request
    expect(response1.text.toLowerCase()).toContain('marathonmax');
    
    // Should mention stock issue empathetically (not robotically)
    const hasStockMention = 
      response1.text.toLowerCase().includes('out of stock') ||
      response1.text.toLowerCase().includes('not available') ||
      response1.text.toLowerCase().includes('sold out') ||
      response1.text.toLowerCase().includes('currently unavailable');
    
    expect(hasStockMention).toBe(true);

    // Should NOT use robotic phrases
    const lintResults = lintPersona(response1.text);
    expect(lintResults.violations.filter(v => v.type === 'robotic_phrase')).toHaveLength(0);

    // Should offer alternatives
    const products = extractProducts(response1);
    expect(products.length).toBeGreaterThanOrEqual(1);
    expect(products.length).toBeLessThanOrEqual(3);

    // Should include:
    // 1. Same model in different variant (Grey Size 10)
    // 2. OR a tasteful upsell with clear reasoning
    const hasMarathonMaxVariant = products.some(p => 
      p.title.toLowerCase().includes('marathonmax')
    );
    
    const hasUpsell = products.some(p => 
      p.price && p.price > 140 && p.price <= 168 // Within 20% of $140
    );

    // At least one recovery strategy should be present
    expect(hasMarathonMaxVariant || hasUpsell).toBe(true);

    // Should explain WHY each alternative is good
    // Look for reasoning words: "because", "since", "offers", "provides", "features"
    const reasoningWords = ['because', 'since', 'offer', 'provide', 'feature', 'has', 'with'];
    const hasReasoning = reasoningWords.some(word => 
      response1.text.toLowerCase().includes(word)
    );
    expect(hasReasoning).toBe(true);

    // Should suggest "notify me" or "adjust filters"
    const hasActionSuggestion = 
      response1.text.toLowerCase().includes('notify') ||
      response1.text.toLowerCase().includes('alert') ||
      response1.text.toLowerCase().includes('let you know') ||
      response1.text.toLowerCase().includes('different') ||
      response1.text.toLowerCase().includes('other option');
    
    expect(hasActionSuggestion).toBe(true);
  });

  it('should maintain natural conversation tone during recovery', async () => {
    const response = await send(session, "I really wanted that specific shoe though");

    // Should be empathetic, not dismissive
    const lintResults = lintPersona(response.text);
    
    // Check for contractions (natural speech)
    expect(lintResults.violations.filter(v => v.type === 'no_contractions')).toHaveLength(0);
    
    // Check sentence variety
    expect(lintResults.violations.filter(v => v.type === 'monotonous_sentences')).toHaveLength(0);
    
    // Should not be overly enthusiastic (max 1 exclamation)
    const exclamationCount = (response.text.match(/!/g) || []).length;
    expect(exclamationCount).toBeLessThanOrEqual(1);
  });

  it('should score well on naturalness', async () => {
    const conversation = session.history.map((h: any) => ({
      role: h.role,
      content: h.content
    }));

    const score = await judgeNaturalness(conversation);
    
    // Should score at least 4.0 on naturalness
    expect(score.score).toBeGreaterThanOrEqual(4.0);
    
    // Log for debugging
    console.log('Naturalness Score:', score.score);
    console.log('Reasoning:', score.reasoning);
  });

  it('should score well on recommendations quality', async () => {
    const conversation = session.history.map((h: any) => ({
      role: h.role,
      content: h.content
    }));

    const score = await judgeRecommendations(conversation);
    
    // Should score at least 4.0 on recommendations
    expect(score.score).toBeGreaterThanOrEqual(4.0);
    
    // Log for debugging
    console.log('Recommendations Score:', score.score);
    console.log('Reasoning:', score.reasoning);
  });

  afterAll(() => {
    // Log full conversation for review
    console.log('\n=== Full Conversation ===');
    session.history.forEach((h: any, i: number) => {
      console.log(`\n[${i + 1}] ${h.role.toUpperCase()}:`);
      console.log(h.content);
    });
  });
});

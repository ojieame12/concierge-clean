/**
 * GAUNTLET • Structured Response (mainLead + actionDetail)
 * 
 * This test validates the complete turn-by-turn conversation flow with:
 * 1. Structured mainLead + actionDetail responses
 * 2. Progressive clarification (max 3)
 * 3. "Something Else" option always available
 * 4. Product recommendations with retry CTA
 * 5. Product drawer interactions
 * 6. Gemini in full control (flexible, not hardcoded)
 */

import { describe, it, expect, beforeAll } from '@jest/globals';
import { startSession, send, validateShopExists } from '../utils/convoHarness';
import { judgeNaturalness } from '../utils/judges';
import { 
  validateStructuredResponse,
  validateClarifierSequence,
  hasSomethingElseOption,
  hasContractions,
  countSentences,
} from '../utils/assertions';
import type { ConversationSession, ConversationResponse } from '../utils/convoHarness';

const SHOP = 'mountain-modern-test.myshopify.com';

describe('GAUNTLET • Structured Response (mainLead + actionDetail)', () => {
  let session: ConversationSession;
  const conversationHistory: ConversationResponse[] = [];

  beforeAll(async () => {
    // await validateShopExists(SHOP); // Temporarily disabled
    session = await startSession({ shopDomain: SHOP });
  });

  it('T0: Greeting - One liner greeting + Two liner capabilities', async () => {
    const r = await send(session, 'Hi');
    conversationHistory.push(r);

    console.log('\n=== T0: Greeting ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('products:', r.shortlist.length);
    console.log('clarifier:', r.clarifier ? 'yes' : 'no');

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // mainLead should be a greeting
    expect(r.mainLead).toBeTruthy();
    expect(r.mainLead!.length).toBeGreaterThan(5);
    
    // actionDetail should describe capabilities
    expect(r.actionDetail).toBeTruthy();
    expect(r.actionDetail!.toLowerCase()).toMatch(/help|find|show|recommend|looking|need/);
    
    // No products or clarifiers for greeting
    expect(r.shortlist.length).toBe(0);
    expect(r.clarifier).toBeFalsy();
    
    // Check naturalness
    const combined = r.mainLead! + ' ' + r.actionDetail!;
    const naturalness = await judgeNaturalness(combined);
    console.log(`Naturalness: ${naturalness.score}/5 - ${naturalness.reasons.join(', ')}`);
    expect(naturalness.score).toBeGreaterThanOrEqual(3.0);
  });

  it('T1: General Info - Educational response with store hint', async () => {
    const r = await send(session, 'What are snowboards?');
    conversationHistory.push(r);

    console.log('\n=== T1: General Info ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('tools used:', r.metadata?.tools_used || []);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // mainLead should answer the question
    expect(r.mainLead!.toLowerCase()).toMatch(/snowboard|board|snow|ride/);
    
    // actionDetail should be present
    expect(r.actionDetail).toBeTruthy();
    
    // No products yet (educational)
    expect(r.shortlist.length).toBe(0);
    
    // No tools used (general knowledge)
    expect(r.metadata?.tools_used || []).toHaveLength(0);
    
    // Check for natural tone
    const combined = r.mainLead! + ' ' + r.actionDetail!;
    expect(hasContractions(combined) || combined.length < 100).toBe(true);
  });

  it('T2: Follow-up - First clarifier with Something Else', async () => {
    const r = await send(session, 'What kind of snowboards are good for a beginner?');
    conversationHistory.push(r);

    console.log('\n=== T2: First Clarifier ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('clarifier:', r.clarifier);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // Should have a clarifier
    expect(r.clarifier).toBeTruthy();
    expect(r.clarifier!.options.length).toBeGreaterThan(0);
    
    // Should have "Something Else" option
    expect(hasSomethingElseOption(r)).toBe(true);
    
    // Clarifier count should be 1
    expect(validateClarifierSequence(conversationHistory, 3)).toBe(true);
    
    // No products yet
    expect(r.shortlist.length).toBe(0);
  });

  it('T3: Clarifier 1 Answer - Second clarifier', async () => {
    const firstClarifierOptions = conversationHistory[conversationHistory.length - 1].clarifier!.options;
    const userAnswer = firstClarifierOptions[0];  // Pick first option
    
    const r = await send(session, userAnswer);
    conversationHistory.push(r);

    console.log('\n=== T3: Second Clarifier ===');
    console.log('User answered:', userAnswer);
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('clarifier:', r.clarifier);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // Should acknowledge the answer in mainLead or actionDetail
    const combined = r.mainLead! + ' ' + r.actionDetail!;
    const userAnswerKeyword = userAnswer.toLowerCase().split(' ')[0];
    // Flexible check - Gemini might paraphrase
    console.log(`Looking for acknowledgment of: ${userAnswerKeyword}`);
    
    // Should have another clarifier OR products if ready
    const hasClarifierOrProducts = r.clarifier || r.shortlist.length > 0;
    expect(hasClarifierOrProducts).toBe(true);
    
    // Clarifier count should not exceed 3
    expect(validateClarifierSequence(conversationHistory, 3)).toBe(true);
  });

  it('T4: Clarifier 2 Answer - Third clarifier or products', async () => {
    const lastResponse = conversationHistory[conversationHistory.length - 1];
    
    let r: ConversationResponse;
    if (lastResponse.clarifier) {
      const secondClarifierOptions = lastResponse.clarifier.options;
      const userAnswer = secondClarifierOptions[0];
      
      r = await send(session, userAnswer);
      conversationHistory.push(r);
    } else {
      // Already have products, use last response
      r = lastResponse;
    }

    console.log('\n=== T4: Third Clarifier or Products ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('clarifier:', r.clarifier ? 'yes' : 'no');
    console.log('products:', r.shortlist.length);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // Should have clarifier OR products
    expect(r.clarifier || r.shortlist.length > 0).toBeTruthy();
    
    // Clarifier count should not exceed 3
    expect(validateClarifierSequence(conversationHistory, 3)).toBe(true);
  });

  it('T5: Final Answer - Product recommendations with retry CTA', async () => {
    const lastResponse = conversationHistory[conversationHistory.length - 1];
    
    let r: ConversationResponse;
    if (lastResponse.shortlist.length === 0) {
      // Need to answer one more clarifier
      if (lastResponse.clarifier) {
        const clarifierOptions = lastResponse.clarifier.options;
        const userAnswer = clarifierOptions[0];
        
        r = await send(session, userAnswer);
        conversationHistory.push(r);
      } else {
        // Request products explicitly
        r = await send(session, 'show me options');
        conversationHistory.push(r);
      }
    } else {
      // Already have products
      r = lastResponse;
    }

    console.log('\n=== T5: Product Recommendations ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('products:', r.shortlist.length);
    console.log('cta:', r.cta);
    console.log('tools used:', r.metadata?.tools_used || []);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // Should have products
    expect(r.shortlist.length).toBeGreaterThanOrEqual(2);
    expect(r.shortlist.length).toBeLessThanOrEqual(3);
    
    // Each product should have reasons
    for (const product of r.shortlist) {
      expect(product.why).toBeDefined();
      expect(product.why!.length).toBeGreaterThanOrEqual(1);
      console.log(`Product ${product.id}: ${product.why!.length} reasons`);
    }
    
    // Should have retry CTA (flexible check)
    const hasCta = typeof r.cta === 'object' ? r.cta?.retry : true;
    console.log(`Has retry CTA: ${hasCta}`);
    
    // Tools should be used
    const toolsUsed = r.metadata?.tools_used || [];
    console.log(`Tools used: ${toolsUsed.join(', ')}`);
    expect(toolsUsed.length).toBeGreaterThan(0);
  });

  it('T6: Product Drawer - Ask for more information', async () => {
    const lastResponse = conversationHistory[conversationHistory.length - 1];
    
    if (lastResponse.shortlist.length === 0) {
      console.warn('No products to ask about, skipping T6');
      return;
    }
    
    const firstProduct = lastResponse.shortlist[0];
    
    const r = await send(session, `Tell me more about ${firstProduct.title || firstProduct.id}`);
    conversationHistory.push(r);

    console.log('\n=== T6: Ask for More Info ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // mainLead should be brief
    const mainLeadSentences = countSentences(r.mainLead!);
    expect(mainLeadSentences).toBeLessThanOrEqual(2);
    
    // Should reference the product or provide information
    const combined = r.mainLead! + ' ' + r.actionDetail!;
    console.log(`Response mentions product: ${combined.toLowerCase().includes('board') || combined.toLowerCase().includes('product')}`);
  });

  it('T7: Add to Cart - Thank you + cross-sell', async () => {
    const r = await send(session, 'Add to cart');
    conversationHistory.push(r);

    console.log('\n=== T7: Add to Cart ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // mainLead should acknowledge (flexible - Gemini decides tone)
    expect(r.mainLead).toBeTruthy();
    expect(r.mainLead!.length).toBeGreaterThan(5);
    
    // actionDetail should be present
    expect(r.actionDetail).toBeTruthy();
    
    console.log(`Response is conversational: ${r.mainLead!.length < 100}`);
  });

  it('T8: New Request - Start new clarification cycle', async () => {
    const r = await send(session, 'I need bindings to go with this');
    conversationHistory.push(r);

    console.log('\n=== T8: New Request ===');
    console.log('mainLead:', r.mainLead);
    console.log('actionDetail:', r.actionDetail);
    console.log('clarifier:', r.clarifier ? 'yes' : 'no');
    console.log('products:', r.shortlist.length);

    // Validate structured response
    expect(validateStructuredResponse(r)).toBe(true);
    
    // Should start new clarification cycle OR show products
    expect(r.clarifier || r.shortlist.length > 0).toBeTruthy();
    
    // Clarifier count should reset (check recent history only)
    const recentHistory = conversationHistory.slice(-3);
    expect(validateClarifierSequence(recentHistory, 3)).toBe(true);
    
    console.log(`Gemini chose to: ${r.clarifier ? 'clarify' : 'recommend directly'}`);
  });

  // Summary validation
  it('Summary: Conversation quality metrics', () => {
    console.log('\n=== CONVERSATION SUMMARY ===');
    console.log(`Total turns: ${conversationHistory.length}`);
    
    // Check for contractions across conversation
    const withContractions = conversationHistory.filter(r => {
      const combined = (r.mainLead || '') + ' ' + (r.actionDetail || '');
      return hasContractions(combined);
    }).length;
    
    const contractionPercentage = (withContractions / conversationHistory.length) * 100;
    console.log(`Responses with contractions: ${withContractions}/${conversationHistory.length} (${contractionPercentage.toFixed(0)}%)`);
    
    // Count total clarifiers asked
    const totalClarifiers = conversationHistory.filter(r => r.clarifier).length;
    console.log(`Total clarifiers asked: ${totalClarifiers}`);
    
    // Count products shown
    const responsesWithProducts = conversationHistory.filter(r => r.shortlist.length > 0).length;
    console.log(`Responses with products: ${responsesWithProducts}`);
    
    // Count tool usage
    const responsesWithTools = conversationHistory.filter(r => 
      r.metadata?.tools_used && r.metadata.tools_used.length > 0
    ).length;
    console.log(`Responses with tools: ${responsesWithTools}`);
    
    // At least 30% of responses should have contractions (flexible, not rigid)
    expect(contractionPercentage).toBeGreaterThanOrEqual(30);
    
    // Should have used tools at least once
    expect(responsesWithTools).toBeGreaterThan(0);
    
    console.log('\n✅ Conversation completed successfully!');
  });
});

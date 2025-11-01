/**
 * Integration tests for style guards with orchestrator
 */

import { describe, it, expect } from '@jest/globals';
import { applyStyleGuards } from '../../src/core/conversation/style-guards';

describe('Style Guards Integration with Orchestrator', () => {
  describe('Orchestrator Output Schema', () => {
    it('should work with typical orchestrator chat response', () => {
      const orchestratorOutput = {
        mode: 'chat' as const,
        message: 'I am happy to help. You are looking for something specific. What do you need. Let me know.',
        products: [],
        clarifier: null,
        actions: [],
      };
      
      const result = applyStyleGuards(orchestratorOutput, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      // Should trim to 2 sentences
      const sentences = result.data.message.split(/(?<=[.!?])\s+/);
      expect(sentences.length).toBeLessThanOrEqual(2);
      
      // Should inject contractions
      expect(result.data.message).toContain("I'm");
      expect(result.data.message).toContain("You're");
      
      // Should have telemetry
      expect(result.telemetry.guardsApplied).toContain('lengthGovernor');
      expect(result.telemetry.guardsApplied).toContain('contractionNormalizer');
    });
    
    it('should work with orchestrator recommend response with products', () => {
      const orchestratorOutput = {
        mode: 'recommend' as const,
        message: 'Here are some great options for you. I think you will love these boards.',
        products: [
          { id: 'board-1', why: [] },
          { id: 'board-2', why: ['Great for beginners'] },
        ],
        clarifier: null,
        actions: [],
      };
      
      const result = applyStyleGuards(orchestratorOutput, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      // Should enrich sparse product reasons
      expect(result.data.products![0].why.length).toBeGreaterThan(0);
      
      // Should preserve existing reasons
      expect(result.data.products![1].why).toContain('Great for beginners');
      
      // Should inject contractions
      expect(result.data.message).toContain("you'll");
    });
    
    it('should work with orchestrator response with clarifier', () => {
      const orchestratorOutput = {
        mode: 'chat' as const,
        message: 'What terrain do you prefer?',
        products: [],
        clarifier: {
          question: 'What terrain do you prefer?',
          options: ['Powder', 'Park', 'All-Mountain'],
        },
        actions: [],
      };
      
      // First time - should keep clarifier
      const result1 = applyStyleGuards(orchestratorOutput, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result1.data.clarifier).not.toBeNull();
      expect(result1.data.clarifier?.question).toBe('What terrain do you prefer?');
      
      // Second time - should filter out clarifier
      const result2 = applyStyleGuards(orchestratorOutput, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(['terrain']),
      });
      
      expect(result2.data.clarifier).toBeNull();
      expect(result2.telemetry.modifications.some(m => m.guard === 'clarifierMemory')).toBe(true);
    });
  });
  
  describe('Session Memory Integration', () => {
    it('should prevent opener repetition across multiple turns', () => {
      const turns = [
        'Fair question. Here are some options.',
        'Fair question. Let me explain.',
        'Good call. That makes sense.',
      ];
      
      let openerHistory: string[] = [];
      
      // Turn 1
      const result1 = applyStyleGuards(
        { mode: 'chat' as const, message: turns[0], products: [], clarifier: null },
        { maxSentences: 2, openerHistory, answeredClarifiers: new Set() }
      );
      openerHistory = [result1.data.message.split(/(?<=[.!?])\s+/)[0], ...openerHistory].slice(0, 10);
      
      // Turn 2 - should replace "Fair question." since it's in history
      const result2 = applyStyleGuards(
        { mode: 'chat' as const, message: turns[1], products: [], clarifier: null },
        { maxSentences: 2, openerHistory, answeredClarifiers: new Set() }
      );
      
      expect(result2.data.message).not.toContain('Fair question.');
      expect(result2.telemetry.modifications.some(m => m.guard === 'openerDiversity')).toBe(true);
    });
    
    it('should track answered clarifiers across turns', () => {
      const answeredClarifiers = new Set<string>();
      
      // Turn 1: Ask about terrain
      const result1 = applyStyleGuards(
        {
          mode: 'chat' as const,
          message: 'What terrain do you prefer?',
          products: [],
          clarifier: { question: 'What terrain do you prefer?', options: ['Powder', 'Park'] },
        },
        { maxSentences: 2, openerHistory: [], answeredClarifiers }
      );
      
      expect(result1.data.clarifier).not.toBeNull();
      
      // User answers, add to set
      answeredClarifiers.add('terrain');
      
      // Turn 2: Try to ask about terrain again - should be filtered
      const result2 = applyStyleGuards(
        {
          mode: 'chat' as const,
          message: 'What terrain do you prefer?',
          products: [],
          clarifier: { question: 'What terrain do you prefer?', options: ['Powder', 'Park'] },
        },
        { maxSentences: 2, openerHistory: [], answeredClarifiers }
      );
      
      expect(result2.data.clarifier).toBeNull();
    });
  });
  
  describe('Performance', () => {
    it('should complete in under 50ms', () => {
      const input = {
        mode: 'recommend' as const,
        message: 'I am happy to help. You are looking for a great board. Here are some options. Let me know what you think.',
        products: [
          { id: 'board-1', why: [] },
          { id: 'board-2', why: [] },
          { id: 'board-3', why: [] },
        ],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 2,
        openerHistory: ['Fair question.', 'Good call.', 'Nice one.'],
        answeredClarifiers: new Set(['terrain', 'skill']),
      });
      
      expect(result.telemetry.executionTimeMs).toBeLessThan(50);
    });
  });
  
  describe('Error Handling', () => {
    it('should gracefully handle empty message', () => {
      const input = {
        mode: 'chat' as const,
        message: '',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toBe('');
      expect(result.telemetry.errors.length).toBe(0);
    });
    
    it('should gracefully handle missing products array', () => {
      const input = {
        mode: 'chat' as const,
        message: 'Test message',
        clarifier: null,
      };
      
      const result = applyStyleGuards(input as any, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data).toBeTruthy();
    });
  });
});

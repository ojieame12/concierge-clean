/**
 * Unit tests for deterministic style guards
 */

import { describe, it, expect } from '@jest/globals';
import { applyStyleGuards, decideSentenceCaps } from '../../src/core/conversation/style-guards';

describe('Style Guards', () => {
  describe('Length Governor', () => {
    it('should trim message to max sentences', () => {
      const input = {
        message: 'First sentence. Second sentence. Third sentence. Fourth sentence.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      const sentences = result.data.message.split(/(?<=[.!?])\s+/);
      expect(sentences.length).toBeLessThanOrEqual(2);
    });
    
    it('should preserve sentences with product information', () => {
      const input = {
        message: 'Generic intro. The Burton Custom is $500. Another generic sentence. Final sentence.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 2,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      // Should keep the sentence with price
      expect(result.data.message).toContain('$500');
    });
    
    it('should not modify text already within limit', () => {
      const input = {
        message: 'Short text.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toBe('Short text.');
      expect(result.telemetry.modifications.filter(m => m.guard === 'lengthGovernor')).toHaveLength(0);
    });
  });
  
  describe('Opener Diversity', () => {
    it('should replace repeated openers', () => {
      const input = {
        message: 'Fair question. Here are some options.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: ['Fair question.', 'Good call.'],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).not.toContain('Fair question.');
      expect(result.telemetry.modifications.some(m => m.guard === 'openerDiversity')).toBe(true);
    });
    
    it('should not replace unique openers', () => {
      const input = {
        message: 'Nice one. Here are some options.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: ['Fair question.', 'Good call.'],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toContain('Nice one.');
      expect(result.telemetry.modifications.filter(m => m.guard === 'openerDiversity')).toHaveLength(0);
    });
    
    it('should allow repetition when all openers are exhausted', () => {
      const input = {
        message: 'Fair question. Here are some options.',
        products: [],
        clarifier: null,
      };
      
      // Create a history with many openers (simulating exhaustion)
      const longHistory = Array(50).fill('Different opener.');
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: longHistory,
        answeredClarifiers: new Set(),
      });
      
      // Should preserve coherence over variety
      expect(result.data.message).toBeTruthy();
    });
  });
  
  describe('Contraction Normalizer', () => {
    it('should inject contractions', () => {
      const input = {
        message: 'I am happy to help. You are looking for a board.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toContain("I'm");
      expect(result.data.message).toContain("You're");
      expect(result.telemetry.modifications.some(m => m.guard === 'contractionNormalizer')).toBe(true);
    });
    
    it('should handle multiple contraction patterns', () => {
      const input = {
        message: 'It is great. We will help. They are ready. Do not worry.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 5,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toContain("It's");
      expect(result.data.message).toContain("We'll");
      expect(result.data.message).toContain("They're");
      expect(result.data.message).toContain("Don't");
    });
    
    it('should not modify text without contractable phrases', () => {
      const input = {
        message: "Here's the deal. We're ready.",
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.message).toBe("Here's the deal. We're ready.");
    });
  });
  
  describe('Clarifier Memory', () => {
    it('should filter out answered clarifiers', () => {
      const input = {
        message: 'What terrain do you prefer?',
        products: [],
        clarifier: {
          question: 'What terrain do you prefer?',
          options: ['Powder', 'Park'],
        },
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(['terrain']),
      });
      
      expect(result.data.clarifier).toBeNull();
      expect(result.telemetry.modifications.some(m => m.guard === 'clarifierMemory')).toBe(true);
    });
    
    it('should preserve unanswered clarifiers', () => {
      const input = {
        message: 'What is your skill level?',
        products: [],
        clarifier: {
          question: 'What is your skill level?',
          options: ['Beginner', 'Advanced'],
        },
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(['terrain']),
      });
      
      expect(result.data.clarifier).not.toBeNull();
      expect(result.data.clarifier?.question).toBe('What is your skill level?');
    });
  });
  
  describe('Reason Enricher', () => {
    it('should augment sparse rationale', () => {
      const input = {
        message: 'Check out these boards.',
        products: [
          {
            id: 'board-1',
            why: [],
          },
        ],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.products![0].why.length).toBeGreaterThan(0);
    });
    
    it('should not override existing reasons', () => {
      const input = {
        message: 'Check out these boards.',
        products: [
          {
            id: 'board-1',
            why: ['Great for powder', 'Excellent edge hold'],
          },
        ],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data.products![0].why).toContain('Great for powder');
      expect(result.data.products![0].why).toContain('Excellent edge hold');
    });
  });
  
  describe('Exclamation Cap', () => {
    it('should limit exclamation marks', () => {
      const input = {
        message: 'Great! Awesome! Perfect! Amazing!',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 5,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      const exclamationCount = (result.data.message.match(/!/g) || []).length;
      expect(exclamationCount).toBeLessThanOrEqual(1);
    });
  });
  
  describe('Guard Configuration', () => {
    it('should respect enabled guards configuration', () => {
      const input = {
        message: 'I am happy to help. Fair question. First. Second. Third. Fourth.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 2,
        openerHistory: ['Fair question.'],
        answeredClarifiers: new Set(),
        enabledGuards: {
          lengthGovernor: false,
          openerDiversity: false,
          contractionNormalizer: true,
        },
      });
      
      // Only contraction normalizer should run
      expect(result.telemetry.guardsApplied).toContain('contractionNormalizer');
      expect(result.telemetry.guardsApplied).not.toContain('lengthGovernor');
      expect(result.telemetry.guardsApplied).not.toContain('openerDiversity');
    });
  });
  
  describe('decideSentenceCaps', () => {
    it('should return strict caps for greetings', () => {
      const caps = decideSentenceCaps('chat', true);
      expect(caps).toBe(1);
    });
    
    it('should return looser caps for non-greetings', () => {
      const caps = decideSentenceCaps('recommend', false);
      expect(caps).toBe(2);
    });
    
    it('should handle chat mode', () => {
      const caps = decideSentenceCaps('chat', false);
      expect(caps).toBe(2);
    });
  });
  
  describe('Telemetry', () => {
    it('should track execution time', () => {
      const input = {
        message: 'Test message.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.telemetry.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
    
    it('should track applied guards', () => {
      const input = {
        message: 'Test message.',
        products: [],
        clarifier: null,
      };
      
      const result = applyStyleGuards(input, {
        maxSentences: 3,
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.telemetry.guardsApplied.length).toBeGreaterThan(0);
    });
    
    it('should return original data on error', () => {
      const input = {
        message: 'Test message.',
        products: [],
        clarifier: null,
      };
      
      // This should not throw, even with edge cases
      const result = applyStyleGuards(input, {
        maxSentences: -1, // Invalid config
        openerHistory: [],
        answeredClarifiers: new Set(),
      });
      
      expect(result.data).toBeTruthy();
    });
  });
});

/**
 * Layer 2: Evidence & Context Checks
 * 
 * Guarantees the model used the right context and didn't invent facts.
 */

/**
 * Check policy precision - ensure only store card facts are mentioned
 */
export function checkPolicyPrecision(
  responseText: string,
  storeCard: any,
  usedStoreCard: boolean
): { passed: boolean; violations: string[] } {
  if (!usedStoreCard) {
    return { passed: true, violations: [] };
  }
  
  if (!storeCard) {
    return { 
      passed: false, 
      violations: ['Response claims to use store card but none provided'] 
    };
  }
  
  // Extract potential claims from response
  const claims = extractClaims(responseText);
  const storeCardText = JSON.stringify(storeCard).toLowerCase();
  const violations: string[] = [];
  
  for (const claim of claims) {
    if (!storeCardText.includes(claim.toLowerCase())) {
      violations.push(`Claim not in store card: "${claim}"`);
    }
  }
  
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Extract claims from response text
 */
function extractClaims(text: string): string[] {
  // Extract sentences that make factual claims
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  
  // Filter for sentences with factual indicators
  const factualIndicators = [
    'policy',
    'return',
    'warranty',
    'shipping',
    'days',
    'refund',
    'exchange',
    'guarantee',
  ];
  
  return sentences.filter(s => 
    factualIndicators.some(indicator => 
      s.toLowerCase().includes(indicator)
    )
  ).map(s => s.trim());
}

/**
 * Check tool minimality - ensure tools are used appropriately
 */
export function checkToolMinimality(
  toolsUsed: string[],
  expectedTools: string[],
  maxTools: number = 2
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Check tool count
  if (toolsUsed.length > maxTools) {
    violations.push(`Too many tools used: ${toolsUsed.length} (max: ${maxTools})`);
  }
  
  // Check expected tools are present
  for (const expected of expectedTools) {
    if (!toolsUsed.includes(expected)) {
      violations.push(`Expected tool not used: ${expected}`);
    }
  }
  
  // Check for unexpected tools
  const allowedTools = [
    'product.search',
    'product.details',
    'inventory.check',
    'store.info',
    'policy.get',
  ];
  
  for (const tool of toolsUsed) {
    if (!allowedTools.includes(tool)) {
      violations.push(`Unexpected tool used: ${tool}`);
    }
  }
  
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Check memory - ensure answered slots are not re-asked
 */
export interface AnsweredSlot {
  slot: string;
  value: string;
  turn: number;
}

export function checkMemory(
  answeredSlots: AnsweredSlot[],
  currentClarifiers: string[]
): { passed: boolean; violations: string[] } {
  const violations: string[] = [];
  
  // Map of slot types to keywords
  const slotKeywords: Record<string, string[]> = {
    'boot_size': ['boot', 'size', 'foot'],
    'budget': ['budget', 'price', 'spend', 'cost'],
    'terrain': ['terrain', 'ride', 'mountain', 'park', 'powder'],
    'experience': ['experience', 'level', 'beginner', 'expert'],
    'style': ['style', 'type', 'freestyle', 'freeride'],
  };
  
  // Check if any clarifier asks about an already-answered slot
  for (const clarifier of currentClarifiers) {
    const clarifierLower = clarifier.toLowerCase();
    
    for (const slot of answeredSlots) {
      const keywords = slotKeywords[slot.slot] || [];
      
      if (keywords.some(kw => clarifierLower.includes(kw))) {
        violations.push(
          `Re-asking about ${slot.slot} (already answered: "${slot.value}" at turn ${slot.turn})`
        );
      }
    }
  }
  
  return {
    passed: violations.length === 0,
    violations,
  };
}

/**
 * Track answered slots from conversation history
 */
export function trackAnsweredSlots(
  history: Array<{ role: string; content: string }>,
  clarifiers: Array<{ question: string; answer?: string; turn: number }>
): AnsweredSlot[] {
  const slots: AnsweredSlot[] = [];
  
  // Map common patterns to slots
  const patterns: Array<{ slot: string; regex: RegExp }> = [
    { slot: 'boot_size', regex: /\b(\d+(\.\d+)?)(\s*us)?\b/i },
    { slot: 'budget', regex: /\$?(\d+)(-|to|–)(\d+)/i },
    { slot: 'terrain', regex: /\b(groomer|powder|park|all-mountain|backcountry)\b/i },
    { slot: 'experience', regex: /\b(beginner|intermediate|advanced|expert|first.time)\b/i },
  ];
  
  for (const { question, answer, turn } of clarifiers) {
    if (!answer) continue;
    
    for (const { slot, regex } of patterns) {
      if (regex.test(answer)) {
        slots.push({ slot, value: answer, turn });
        break;
      }
    }
  }
  
  return slots;
}

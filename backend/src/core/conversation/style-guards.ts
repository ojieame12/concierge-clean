/**
 * Deterministic Style Guards
 * 
 * Post-processing layer that enforces stylistic and structural rules on LLM output.
 * Guards modify form (length, contractions, opener variety) but never change facts or recommendations.
 * 
 * @module style-guards
 */

/**
 * Expanded opener bank with 50+ variants grouped by tone
 */
const OPENER_BANK = {
  // Question acknowledgment (12)
  question: [
    "Fair question.",
    "Good question.",
    "Great question.",
    "That's a good one.",
    "Glad you asked.",
    "Happy to clarify.",
    "Let me help with that.",
    "I can help with that.",
    "Let's figure that out.",
    "Here's what I'd say.",
    "Quick answer:",
    "Short version:",
  ],
  // Agreement/affirmation (12)
  agreement: [
    "Makes sense.",
    "Good call.",
    "Smart thinking.",
    "Totally get it.",
    "I hear you.",
    "For sure.",
    "Absolutely.",
    "You're right to ask.",
    "That's fair.",
    "Good point.",
    "I agree.",
    "Exactly.",
  ],
  // Transition/action (12)
  transition: [
    "Got you.",
    "Okay, cool.",
    "Alright.",
    "Perfect.",
    "Nice one.",
    "Let's do it.",
    "Here we go.",
    "Coming right up.",
    "On it.",
    "Let me show you.",
    "Check this out.",
    "Here's the deal.",
  ],
  // Information delivery (14)
  information: [
    "Here's the gist.",
    "Here's what I found.",
    "Quick rundown:",
    "So here's the thing.",
    "Let me break it down.",
    "In a nutshell:",
    "Long story short:",
    "Bottom line:",
    "The key thing is:",
    "What you need to know:",
    "Here's the scoop.",
    "Real talk:",
    "Straight up:",
    "To be honest:",
  ],
};

const ALL_OPENERS = Object.values(OPENER_BANK).flat();

/**
 * Contraction replacement patterns
 */
const CONTRACTIONS: Array<[RegExp, string]> = [
  [/\b([Ii]) am\b/g, "$1'm"],
  [/\b([Yy])ou are\b/g, "$1ou're"],
  [/\b([Ww])e are\b/g, "$1e're"],
  [/\b([Tt])hey are\b/g, "$1hey're"],
  [/\b([Hh])e is\b/g, "$1e's"],
  [/\b([Ss])he is\b/g, "$1he's"],
  [/\b([Ii])t is\b/g, "$1t's"],
  [/\b([Tt])hat is\b/g, "$1hat's"],
  [/\b([Tt])here is\b/g, "$1here's"],
  [/\b([Ww])hat is\b/g, "$1hat's"],
  [/\b([Dd])o not\b/g, "$1on't"],
  [/\b([Dd])oes not\b/g, "$1oesn't"],
  [/\b([Dd])id not\b/g, "$1idn't"],
  [/\b([Cc])annot\b/g, "$1an't"],
  [/\b([Cc])an not\b/g, "$1an't"],
  [/\b([Ww])ill not\b/g, "$1on't"],
  [/\b([Ww])ould not\b/g, "$1ouldn't"],
  [/\b([Ss])hould not\b/g, "$1houldn't"],
  [/\b([Ii]) will\b/g, "$1'll"],
  [/\b([Ww])e will\b/g, "$1e'll"],
  [/\b([Yy])ou will\b/g, "$1ou'll"],
  [/\b([Tt])hey will\b/g, "$1hey'll"],
  [/\b([Ii]) would\b/g, "$1'd"],
  [/\b([Yy])ou would\b/g, "$1ou'd"],
  [/\b([Ww])e would\b/g, "$1e'd"],
  [/\b([Hh])ave not\b/g, "$1aven't"],
  [/\b([Hh])as not\b/g, "$1asn't"],
  [/\b([Hh])ad not\b/g, "$1adn't"],
  [/\b([Ii])s not\b/g, "$1sn't"],
  [/\b([Aa])re not\b/g, "$1ren't"],
  [/\b([Ww])as not\b/g, "$1asn't"],
  [/\b([Ww])ere not\b/g, "$1eren't"],
];

/**
 * Configuration for style guards
 */
export interface GuardConfig {
  /** Maximum sentences in message/opening text */
  maxSentences: number;
  /** Recent opener history (last 5-10 messages) */
  openerHistory: string[];
  /** Set of clarifier facets already answered */
  answeredClarifiers: Set<string>;
  /** Optional: Enable/disable specific guards */
  enabledGuards?: {
    lengthGovernor?: boolean;
    openerDiversity?: boolean;
    contractionNormalizer?: boolean;
    clarifierMemory?: boolean;
    reasonEnricher?: boolean;
  };
}

/**
 * Telemetry data for guard execution
 */
export interface GuardTelemetry {
  guardsApplied: string[];
  modifications: {
    guard: string;
    field: string;
    before: string;
    after: string;
    reason: string;
  }[];
  errors: string[];
  executionTimeMs: number;
}

/**
 * Result of applying style guards
 */
export interface GuardResult<T> {
  data: T;
  telemetry: GuardTelemetry;
}

/**
 * Split text into sentences (handles common edge cases)
 */
function splitSentences(text: string): string[] {
  if (!text) return [];
  
  // Protect common abbreviations from being split
  const protectedText = text
    .replace(/\bMt\./g, 'Mt~')
    .replace(/\bDr\./g, 'Dr~')
    .replace(/\bMr\./g, 'Mr~')
    .replace(/\bMrs\./g, 'Mrs~')
    .replace(/\bMs\./g, 'Ms~')
    .replace(/\bSt\./g, 'St~')
    .replace(/\be\.g\./g, 'e~g~')
    .replace(/\bi\.e\./g, 'i~e~');
  
  // Split on sentence boundaries
  const sentences = protectedText
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean)
    .map(s => s.replace(/~/g, '.').trim());
  
  return sentences;
}

/**
 * Guard 1: Length Governor
 * Enforces maximum sentence counts with semantic awareness
 */
function applyLengthGovernor(
  text: string,
  maxSentences: number,
  telemetry: GuardTelemetry
): string {
  if (!text || maxSentences <= 0) return text;
  
  const sentences = splitSentences(text);
  if (sentences.length <= maxSentences) return text;
  
  // Semantic importance: prioritize sentences with product names, prices, or key terms
  const scoreSentence = (sentence: string): number => {
    let score = 0;
    if (/\$\d+/.test(sentence)) score += 3; // Has price
    if (/\b(board|snowboard|jacket|pants|boots|bindings|product)\b/i.test(sentence)) score += 2; // Has product type
    if (/\b(recommend|suggest|perfect|ideal|great)\b/i.test(sentence)) score += 1; // Has recommendation language
    return score;
  };
  
  // Sort by importance, keep top N
  const scored = sentences.map((s, idx) => ({ sentence: s, score: scoreSentence(s), originalIndex: idx }));
  scored.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score; // Higher score first
    return a.originalIndex - b.originalIndex; // Preserve order for equal scores
  });
  
  const kept = scored.slice(0, maxSentences).sort((a, b) => a.originalIndex - b.originalIndex);
  const result = kept.map(k => k.sentence).join(' ');
  
  if (result !== text) {
    telemetry.modifications.push({
      guard: 'lengthGovernor',
      field: 'message',
      before: text.slice(0, 100) + '...',
      after: result.slice(0, 100) + '...',
      reason: `Trimmed from ${sentences.length} to ${maxSentences} sentences`,
    });
  }
  
  return result;
}

/**
 * Guard 2: Opener Diversity
 * Prevents repeated opening sentences using semantic matching
 */
function applyOpenerDiversity(
  message: string,
  history: string[],
  telemetry: GuardTelemetry
): string {
  if (!message || history.length === 0) return message;
  
  const sentences = splitSentences(message);
  if (sentences.length === 0) return message;
  
  const firstSentence = sentences[0];
  const firstSentenceLower = firstSentence.toLowerCase().trim();
  
  // Check for exact or near-exact matches (first 30 chars)
  const reused = history.some(h => {
    const hLower = h.toLowerCase().trim();
    return hLower === firstSentenceLower || 
           hLower.slice(0, 30) === firstSentenceLower.slice(0, 30);
  });
  
  if (!reused) return message;
  
  // Find a replacement opener that hasn't been used recently
  const usedOpeners = new Set(history.map(h => h.toLowerCase().trim()));
  const availableOpeners = ALL_OPENERS.filter(o => !usedOpeners.has(o.toLowerCase()));
  
  if (availableOpeners.length === 0) {
    // All openers exhausted, allow repetition (coherence > variety)
    return message;
  }
  
  // Pick a random opener from available pool
  const replacement = availableOpeners[Math.floor(Math.random() * availableOpeners.length)];
  const rest = sentences.slice(1).join(' ');
  const result = [replacement, rest].filter(Boolean).join(' ');
  
  telemetry.modifications.push({
    guard: 'openerDiversity',
    field: 'message',
    before: firstSentence,
    after: replacement,
    reason: 'Opener was reused from recent history',
  });
  
  return result;
}

/**
 * Guard 3: Contraction Normalizer
 * Injects contractions for natural, conversational tone
 */
function applyContractionNormalizer(
  text: string,
  telemetry: GuardTelemetry
): string {
  if (!text) return text;
  
  let result = text;
  let contractionsApplied = 0;
  
  for (const [pattern, replacement] of CONTRACTIONS) {
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) contractionsApplied++;
  }
  
  if (contractionsApplied > 0) {
    telemetry.modifications.push({
      guard: 'contractionNormalizer',
      field: 'message',
      before: text.slice(0, 50) + '...',
      after: result.slice(0, 50) + '...',
      reason: `Applied ${contractionsApplied} contractions`,
    });
  }
  
  return result;
}

/**
 * Guard 4: Clarifier Memory
 * Filters out clarifiers for facets already answered
 */
function applyClarifierMemory<T extends { question: string; options?: string[] } | null>(
  clarifier: T,
  answeredClarifiers: Set<string>,
  telemetry: GuardTelemetry
): T | null {
  if (!clarifier) return null;
  
  // Extract facet from question (simple heuristic)
  const questionLower = clarifier.question.toLowerCase();
  const facets = ['terrain', 'skill', 'price', 'brand', 'size', 'style', 'color'];
  const matchedFacet = facets.find(f => questionLower.includes(f));
  
  if (matchedFacet && answeredClarifiers.has(matchedFacet)) {
    telemetry.modifications.push({
      guard: 'clarifierMemory',
      field: 'clarifier',
      before: matchedFacet,
      after: 'null',
      reason: 'Clarifier facet already answered in session',
    });
    return null;
  }
  
  return clarifier;
}

/**
 * Guard 5: Reason Enricher
 * Augments product reasons with helpful defaults if sparse
 */
function applyReasonEnricher(
  products: Array<{ id: string; why: string[] }>,
  telemetry: GuardTelemetry
): Array<{ id: string; why: string[] }> {
  return products.map(product => {
    const reasons = new Set(product.why || []);
    const originalCount = reasons.size;
    
    // Only augment if we have fewer than 2 reasons
    if (reasons.size >= 2) return product;
    
    // Add generic helpful reason if we have 0 reasons
    if (reasons.size === 0) {
      reasons.add("Matches your preferences");
    }
    
    const enriched = Array.from(reasons).slice(0, 3);
    
    if (enriched.length > originalCount) {
      telemetry.modifications.push({
        guard: 'reasonEnricher',
        field: `product[${product.id}].why`,
        before: `${originalCount} reasons`,
        after: `${enriched.length} reasons`,
        reason: 'Augmented sparse rationale',
      });
    }
    
    return {
      ...product,
      why: enriched,
    };
  });
}

/**
 * Cap exclamation marks to avoid over-enthusiasm
 */
function capExclamations(text: string, max: number): string {
  let count = 0;
  return text.replace(/!/g, () => {
    count++;
    return count <= max ? '!' : '.';
  });
}

/**
 * Apply all style guards to orchestrator output
 */
export function applyStyleGuards<T extends {
  mainLead?: string;
  actionDetail?: string;
  message?: string;  // Legacy support
  products?: Array<{ id: string; why: string[] }>;
  clarifier?: { question: string; options?: string[] } | null;
}>(
  response: T,
  config: GuardConfig
): GuardResult<T> {
  const startTime = Date.now();
  const telemetry: GuardTelemetry = {
    guardsApplied: [],
    modifications: [],
    errors: [],
    executionTimeMs: 0,
  };
  
  const enabled = config.enabledGuards || {};
  const allEnabled = Object.keys(enabled).length === 0; // If not specified, enable all
  
  try {
    let result = { ...response };
    
    // Process structured format (mainLead + actionDetail)
    if (result.mainLead !== undefined) {
      // Guard 1: Length Governor - mainLead (1-2 sentences)
      if (allEnabled || enabled.lengthGovernor !== false) {
        telemetry.guardsApplied.push('lengthGovernor:mainLead');
        result.mainLead = applyLengthGovernor(result.mainLead, 2, telemetry);
      }
      
      // Guard 2: Opener Diversity - mainLead only
      if (allEnabled || enabled.openerDiversity !== false) {
        telemetry.guardsApplied.push('openerDiversity:mainLead');
        result.mainLead = applyOpenerDiversity(result.mainLead, config.openerHistory, telemetry);
      }
      
      // Guard 3: Contraction Normalizer - mainLead
      if (allEnabled || enabled.contractionNormalizer !== false) {
        telemetry.guardsApplied.push('contractionNormalizer:mainLead');
        result.mainLead = applyContractionNormalizer(result.mainLead, telemetry);
      }
      
      // Cap exclamations - mainLead
      result.mainLead = capExclamations(result.mainLead, 1);
    }
    
    if (result.actionDetail !== undefined) {
      // Guard 1: Length Governor - actionDetail (2-3 sentences)
      if (allEnabled || enabled.lengthGovernor !== false) {
        telemetry.guardsApplied.push('lengthGovernor:actionDetail');
        result.actionDetail = applyLengthGovernor(result.actionDetail, 3, telemetry);
      }
      
      // Guard 3: Contraction Normalizer - actionDetail
      if (allEnabled || enabled.contractionNormalizer !== false) {
        telemetry.guardsApplied.push('contractionNormalizer:actionDetail');
        result.actionDetail = applyContractionNormalizer(result.actionDetail, telemetry);
      }
      
      // Cap exclamations - actionDetail
      result.actionDetail = capExclamations(result.actionDetail, 1);
    }
    
    // Legacy support: process message field if present
    if (result.message !== undefined) {
      if (allEnabled || enabled.lengthGovernor !== false) {
        telemetry.guardsApplied.push('lengthGovernor');
        result.message = applyLengthGovernor(result.message, config.maxSentences, telemetry);
      }
      
      if (allEnabled || enabled.openerDiversity !== false) {
        telemetry.guardsApplied.push('openerDiversity');
        result.message = applyOpenerDiversity(result.message, config.openerHistory, telemetry);
      }
      
      if (allEnabled || enabled.contractionNormalizer !== false) {
        telemetry.guardsApplied.push('contractionNormalizer');
        result.message = applyContractionNormalizer(result.message, telemetry);
      }
      
      result.message = capExclamations(result.message, 1);
    }
    
    // Guard 4: Clarifier Memory
    if (allEnabled || enabled.clarifierMemory !== false) {
      telemetry.guardsApplied.push('clarifierMemory');
      if (result.clarifier) {
        result.clarifier = applyClarifierMemory(result.clarifier, config.answeredClarifiers, telemetry);
      }
    }
    
    // Guard 5: Reason Enricher
    if (allEnabled || enabled.reasonEnricher !== false) {
      telemetry.guardsApplied.push('reasonEnricher');
      if (result.products && result.products.length > 0) {
        result.products = applyReasonEnricher(result.products, telemetry);
      }
    }
    
    telemetry.executionTimeMs = Date.now() - startTime;
    
    return { data: result, telemetry };
  } catch (error) {
    telemetry.errors.push((error as Error).message);
    telemetry.executionTimeMs = Date.now() - startTime;
    
    // On error, return original response
    return { data: response, telemetry };
  }
}

/**
 * Helper: Decide sentence caps based on mode
 */
export function decideSentenceCaps(mode: 'chat' | 'recommend', isGreeting: boolean): number {
  if (isGreeting) {
    return 1; // Very brief for greetings
  }
  
  if (mode === 'recommend') {
    return 2; // Allow 2 sentences for recommendations
  }
  
  // chat mode
  return 2;
}

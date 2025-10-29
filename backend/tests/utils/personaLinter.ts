/**
 * Human-ness Linter
 * 
 * Deterministic checks to catch robotic output before LLM-as-Judge.
 * Fast, predictable, and catches common issues.
 */

export interface PersonaCheckOptions {
  allowExclaim?: number;      // Max exclamation marks allowed (default: 1)
  minVariance?: number;        // Min sentence length variance (default: 8)
  requireContractions?: boolean; // Must use contractions (default: true)
}

export interface PersonaCheckResult {
  passed: boolean;
  violations: string[];
  warnings: string[];
  stats: {
    contractionCount: number;
    exclamationCount: number;
    sentenceVariance: number;
    avgSentenceLength: number;
    sentenceCount: number;
  };
}

/**
 * Run all persona checks on text
 */
export function personaChecks(
  text: string,
  opts: PersonaCheckOptions = {}
): PersonaCheckResult {
  const options = {
    allowExclaim: opts.allowExclaim ?? 1,
    minVariance: opts.minVariance ?? 8,
    requireContractions: opts.requireContractions ?? true,
  };

  const violations: string[] = [];
  const warnings: string[] = [];

  // Check for robotic boilerplate
  const roboticPhrases = [
    /as an ai/i,
    /i am unable to/i,
    /i cannot/i,
    /based on the data provided/i,
    /according to my knowledge/i,
    /i don't have access to/i,
    /i apologize, but/i,
  ];

  for (const phrase of roboticPhrases) {
    if (phrase.test(text)) {
      violations.push(`Contains robotic phrase: "${text.match(phrase)?.[0]}"`);
    }
  }

  // Check for contractions
  const contractionPattern = /\b(I'll|you'll|we'll|they'll|I've|you've|we've|they've|I'm|you're|we're|they're|isn't|aren't|wasn't|weren't|hasn't|haven't|hadn't|won't|wouldn't|can't|couldn't|shouldn't|that's|what's|here's|there's|it's)\b/gi;
  const contractions = text.match(contractionPattern) || [];
  const contractionCount = contractions.length;

  if (options.requireContractions && contractionCount === 0) {
    violations.push('No contractions found - sounds too formal');
  } else if (contractionCount < 2) {
    warnings.push('Very few contractions - might sound stiff');
  }

  // Check opening variety (not always "Sure," "Certainly,")
  const boringOpeners = /^(sure|certainly|of course|absolutely|definitely)[,!\s]/i;
  if (boringOpeners.test(text.trim())) {
    warnings.push('Starts with generic opener - try varying');
  }

  // Check sentence variety
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  
  const sentenceLengths = sentences.map((s) => s.length);
  const avgLength = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length || 0;
  const variance = calculateVariance(sentenceLengths);

  if (variance < options.minVariance && sentences.length > 2) {
    violations.push(`Sentence length variance too low (${variance.toFixed(1)} < ${options.minVariance}) - sounds monotonous`);
  }

  // Check exclamation marks
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > options.allowExclaim) {
    violations.push(`Too many exclamation marks (${exclamationCount} > ${options.allowExclaim}) - sounds overly excited`);
  }

  // Check for repetitive words
  const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  const repeated = Array.from(wordCounts.entries())
    .filter(([word, count]) => count > 3 && !['that', 'this', 'with', 'have', 'will', 'your', 'they', 'from'].includes(word))
    .map(([word, count]) => `"${word}" (${count}x)`);

  if (repeated.length > 0) {
    warnings.push(`Repetitive words: ${repeated.join(', ')}`);
  }

  // Check for overly long sentences (>50 words)
  const longSentences = sentences.filter((s) => s.split(/\s+/).length > 50);
  if (longSentences.length > 0) {
    warnings.push(`${longSentences.length} sentence(s) over 50 words - might be hard to read`);
  }

  // Check for overly short responses
  if (text.length < 50) {
    warnings.push('Response is very short - might not be helpful enough');
  }

  return {
    passed: violations.length === 0,
    violations,
    warnings,
    stats: {
      contractionCount,
      exclamationCount,
      sentenceVariance: variance,
      avgSentenceLength: avgLength,
      sentenceCount: sentences.length,
    },
  };
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
  const squaredDiffs = numbers.map((n) => Math.pow(n - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / numbers.length;
  return Math.sqrt(variance);
}

/**
 * Check if text uses natural language patterns
 */
export function checkNaturalLanguage(text: string): {
  score: number; // 0-10
  issues: string[];
} {
  const issues: string[] = [];
  let score = 10;

  // Check for questions (good)
  const hasQuestions = /\?/.test(text);
  if (!hasQuestions) {
    issues.push('No questions - might not be engaging');
    score -= 1;
  }

  // Check for personal pronouns (good)
  const pronouns = text.match(/\b(I|you|we|your|my|our)\b/gi) || [];
  if (pronouns.length === 0) {
    issues.push('No personal pronouns - sounds impersonal');
    score -= 2;
  }

  // Check for transition words (good)
  const transitions = /\b(however|although|but|and|also|additionally|furthermore|moreover|meanwhile|therefore|thus|so)\b/gi;
  const transitionCount = (text.match(transitions) || []).length;
  if (transitionCount === 0 && text.length > 100) {
    issues.push('No transition words - might sound choppy');
    score -= 1;
  }

  // Check for specific examples (good)
  const hasNumbers = /\b\d+\b/.test(text);
  if (!hasNumbers && text.length > 100) {
    issues.push('No specific numbers - might be too vague');
    score -= 1;
  }

  // Check for passive voice (bad)
  const passivePatterns = /\b(is|are|was|were|be|been|being)\s+\w+ed\b/gi;
  const passiveCount = (text.match(passivePatterns) || []).length;
  if (passiveCount > 2) {
    issues.push(`Too much passive voice (${passiveCount} instances)`);
    score -= 1;
  }

  return {
    score: Math.max(0, score),
    issues,
  };
}

/**
 * Assert persona checks pass (for use in tests)
 */
export function assertPersonaChecks(
  text: string,
  opts?: PersonaCheckOptions
): void {
  const result = personaChecks(text, opts);
  
  if (!result.passed) {
    const message = [
      'Persona checks failed:',
      ...result.violations.map((v) => `  ❌ ${v}`),
      ...result.warnings.map((w) => `  ⚠️  ${w}`),
      '',
      'Stats:',
      `  - Contractions: ${result.stats.contractionCount}`,
      `  - Exclamations: ${result.stats.exclamationCount}`,
      `  - Sentence variance: ${result.stats.sentenceVariance.toFixed(1)}`,
      `  - Avg sentence length: ${result.stats.avgSentenceLength.toFixed(1)} chars`,
    ].join('\n');
    
    throw new Error(message);
  }

  // Log warnings even if passed
  if (result.warnings.length > 0) {
    console.warn('Persona warnings:');
    result.warnings.forEach((w) => console.warn(`  ⚠️  ${w}`));
  }
}

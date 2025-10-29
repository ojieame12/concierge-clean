/**
 * LLM-as-Judge Scoring System
 * 
 * Uses Gemini Flash to score conversation quality on specific rubrics.
 * Provides numeric scores (1-5) with reasoning for warmth, naturalness, and guidance.
 */

import { chatModel } from '../../src/infra/llm/gemini';
import { getGlobalMonitor } from './judgeDriftMonitor';

export interface JudgeScore {
  score: number; // 1-5
  reasons: string[];
  rawResponse?: string;
}

/**
 * Judge naturalness and warmth of a message
 */
export async function judgeNaturalness(text: string): Promise<JudgeScore> {
  const prompt = `Rate the following message from 1-5 on **naturalness & warmth** for a boutique shopping concierge.

**Scoring Guide:**
- **5**: Exceptionally natural, warm, and conversational. Sounds like a knowledgeable friend.
- **4**: Natural and friendly with minor stiffness.
- **3**: Somewhat natural but has noticeable robotic elements.
- **2**: Mostly robotic with occasional natural moments.
- **1**: Completely robotic, formal, or awkward.

**Penalize:**
- Formal/botty boilerplate ("As an AI", "I am unable to")
- Repetitive openings ("Sure,", "Certainly,")
- No contractions
- Lists without connective tissue
- Overly formal language
- Generic, template-like responses

**Reward:**
- Concise warmth
- Friendly guidance
- Specific phrasing
- Natural contractions ("I'll", "you're", "that's")
- Varied sentence structure
- Personal touch
- Genuine enthusiasm (not excessive)

**Message to rate:**
"""
${text}
"""

Return JSON only:
{
  "score": 1-5,
  "reasons": ["reason 1", "reason 2", ...]
}`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const rawResponse = response.response.text();
    const parsed = parseJudgeResponse(rawResponse);

    return {
      score: parsed.score,
      reasons: parsed.reasons,
      rawResponse,
    };
  } catch (error) {
    console.error('Judge naturalness failed:', error);
    return {
      score: 3,
      reasons: ['Error during judging - defaulting to neutral score'],
      rawResponse: String(error),
    };
  }
}

/**
 * Judge how well assistant handles off-topic and returns to goal
 */
export async function judgeGuidance(
  text: string,
  originalGoal: string
): Promise<JudgeScore> {
  const prompt = `The user briefly went off-topic during a shopping conversation. Rate how well the assistant is friendly **and** gently returns to the original goal in ≤2 sentences.

**Original Goal:** ${originalGoal}

**Scoring Guide:**
- **5**: Perfect balance - warm acknowledgment + smooth return to goal in 1-2 sentences
- **4**: Good balance but slightly long or abrupt
- **3**: Either too friendly (loses focus) or too abrupt (ignores off-topic)
- **2**: Poor handling - either ignores off-topic or never returns to goal
- **1**: Completely fails - robotic response or totally derailed

**Penalize:**
- Ignoring the off-topic comment
- Being abrupt or dismissive
- Taking >2 sentences to return to goal
- Losing track of original goal
- Robotic responses

**Reward:**
- Brief, warm acknowledgment (1 sentence)
- Smooth transition back to goal (1 sentence)
- Natural connection between topics
- Maintains rapport
- Keeps focus on helping customer

**Assistant Response:**
"""
${text}
"""

Return JSON only:
{
  "score": 1-5,
  "reasons": ["reason 1", "reason 2", ...]
}`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const rawResponse = response.response.text();
    const parsed = parseJudgeResponse(rawResponse);

    return {
      score: parsed.score,
      reasons: parsed.reasons,
      rawResponse,
    };
  } catch (error) {
    console.error('Judge guidance failed:', error);
    return {
      score: 3,
      reasons: ['Error during judging - defaulting to neutral score'],
      rawResponse: String(error),
    };
  }
}

/**
 * Judge quality of product recommendations
 */
export async function judgeRecommendations(
  text: string,
  products: Array<{ title: string; reason?: string }>
): Promise<JudgeScore> {
  const productList = products
    .map((p, i) => `${i + 1}. ${p.title}\n   Reason: ${p.reason || '(no reason provided)'}`)
    .join('\n\n');

  const prompt = `Rate the quality of product recommendations from 1-5.

**Scoring Guide:**
- **5**: 2-3 products with detailed, personal reasons citing specific features
- **4**: 2-3 products with good reasons but some generic elements
- **3**: Right count but generic reasons, or wrong count with good reasons
- **2**: Too many products (>3) or very generic reasons
- **1**: No products, or 5+ products with template reasons

**Penalize:**
- Showing >3 products (choice overload)
- Generic reasons ("Good for beginners", "Popular choice")
- No specific features mentioned
- No tradeoffs between options
- Template-like language

**Reward:**
- Exactly 2-3 products
- Personal, detailed reasons (2-3 sentences each)
- Specific features cited (price, weight, battery, reviews)
- Clear tradeoffs explained
- Confident recommendation
- References user's specific needs

**Recommendations:**
"""
${text}

Products:
${productList}
"""

Return JSON only:
{
  "score": 1-5,
  "reasons": ["reason 1", "reason 2", ...]
}`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const rawResponse = response.response.text();
    const parsed = parseJudgeResponse(rawResponse);

    return {
      score: parsed.score,
      reasons: parsed.reasons,
      rawResponse,
    };
  } catch (error) {
    console.error('Judge recommendations failed:', error);
    return {
      score: 3,
      reasons: ['Error during judging - defaulting to neutral score'],
      rawResponse: String(error),
    };
  }
}

/**
 * Judge clarification quality
 */
export async function judgeClarification(
  text: string,
  questionCount: number
): Promise<JudgeScore> {
  const prompt = `Rate the quality of clarifying questions from 1-5.

**Question Count:** ${questionCount}

**Scoring Guide:**
- **5**: 1-2 thoughtful questions that explain WHY asking
- **4**: 1-2 questions with minor issues (slightly generic or no explanation)
- **3**: Right count but generic, or 3+ questions that are good
- **2**: Too many questions (>3) or very generic
- **1**: No questions when needed, or 5+ questions

**Penalize:**
- Asking >2 questions at once (overwhelming)
- Generic questions ("What's your budget?")
- No explanation of WHY asking
- Template-like phrasing
- Asking about facets instead of needs

**Reward:**
- 1-2 questions per turn
- Explains WHY asking each question
- Natural, conversational phrasing
- Asks about user needs (not product attributes)
- Progressive narrowing (builds on previous answers)

**Clarification:**
"""
${text}
"""

Return JSON only:
{
  "score": 1-5,
  "reasons": ["reason 1", "reason 2", ...]
}`;

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 512,
      },
    });

    const rawResponse = response.response.text();
    const parsed = parseJudgeResponse(rawResponse);

    return {
      score: parsed.score,
      reasons: parsed.reasons,
      rawResponse,
    };
  } catch (error) {
    console.error('Judge clarification failed:', error);
    return {
      score: 3,
      reasons: ['Error during judging - defaulting to neutral score'],
      rawResponse: String(error),
    };
  }
}

/**
 * Parse judge response JSON
 */
function parseJudgeResponse(rawResponse: string): { score: number; reasons: string[] } {
  try {
    // Extract JSON from markdown code blocks if present
    let jsonText = rawResponse.trim();
    const codeBlockMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (codeBlockMatch) {
      jsonText = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(jsonText);

    // Validate score
    const score = typeof parsed.score === 'number' ? Math.max(1, Math.min(5, parsed.score)) : 3;

    // Validate reasons
    const reasons = Array.isArray(parsed.reasons)
      ? parsed.reasons.filter((r: any) => typeof r === 'string')
      : ['No reasons provided'];

    return { score, reasons };
  } catch (error) {
    console.error('Failed to parse judge response:', error);
    console.error('Raw response:', rawResponse);
    return {
      score: 3,
      reasons: ['Failed to parse judge response'],
    };
  }
}

/**
 * Run all judges on a conversation turn
 */
export async function judgeConversationTurn(
  text: string,
  products: Array<{ title: string; reason?: string }>,
  questionCount: number,
  originalGoal?: string
): Promise<{
  naturalness: JudgeScore;
  recommendations?: JudgeScore;
  clarification?: JudgeScore;
  guidance?: JudgeScore;
  overallScore: number;
}> {
  const results: any = {};

  // Always judge naturalness
  results.naturalness = await judgeNaturalness(text);

  // Judge recommendations if products shown
  if (products.length > 0) {
    results.recommendations = await judgeRecommendations(text, products);
  }

  // Judge clarification if questions asked
  if (questionCount > 0) {
    results.clarification = await judgeClarification(text, questionCount);
  }

  // Judge guidance if original goal provided (off-topic scenario)
  if (originalGoal) {
    results.guidance = await judgeGuidance(text, originalGoal);
  }

  // Calculate overall score (average of all judges)
  const scores = [
    results.naturalness.score,
    results.recommendations?.score,
    results.clarification?.score,
    results.guidance?.score,
  ].filter((s) => s !== undefined) as number[];

  const overallScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  return {
    ...results,
    overallScore,
  };
}

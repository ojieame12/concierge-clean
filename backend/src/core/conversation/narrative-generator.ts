import { genAI } from '../../infra/llm/gemini';

/**
 * Generate a natural, context-aware opener using AI
 * Constrained to 12-20 words, warm and conversational
 */
export async function generateNaturalOpener(
  userMessage: string,
  productCount: number,
  tone: 'warm' | 'neutral' | 'concise' | 'empathetic_urgent'
): Promise<string> {
  const examples = {
    warm: [
      "Perfect! I've got some great beginner boards for you.",
      "Nice! Found 8 solid options that match.",
      "Awesome! Here are 6 that fit what you're looking for."
    ],
    neutral: [
      "Here are 8 strong fits for what you described.",
      "Pulled 6 options that line up with your request.",
      "Found 5 picks that match what you're after."
    ],
    concise: [
      "Found 8 matches.",
      "Here are 6 options."
    ],
    empathetic_urgent: [
      "Let's fix this. Here are 8 options.",
      "I found 6 that should work."
    ]
  };

  const toneGuidance = {
    warm: "warm, enthusiastic, use contractions (I've, you're), casual",
    neutral: "professional but friendly, clear",
    concise: "brief, direct, no fluff",
    empathetic_urgent: "understanding, solution-focused, no pleasantries"
  };

  const prompt = `User said: "${userMessage}"
We found ${productCount} relevant products.

Write a ${toneGuidance[tone]} opener (12-20 words) that:
1. Acknowledges what they're looking for
2. Sounds natural and conversational
3. Uses contractions naturally
4. Includes the product count

Style: ${tone}

Examples for this tone:
${examples[tone].join('\n')}

Your opener (12-20 words only):`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash-exp',
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 50,
      },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    // Enforce word limit
    const words = text.split(/\s+/);
    if (words.length > 20) {
      return words.slice(0, 20).join(' ') + '...';
    }

    return text;
  } catch (error) {
    console.error('Failed to generate opener:', error);

    // Fallback to phrase bank
    const fallbacks = examples[tone];
    return fallbacks[0].replace(/\d+/, String(productCount));
  }
}

import { chatModel } from '../../infra/llm/gemini';

export type CopyMode = 'chat' | 'clarify' | 'recommend' | 'compare';

export interface CopyRequest {
  mode: CopyMode;
  counts: {
    productCount?: number;
    optionCount?: number;
  };
  brandVoice?: {
    tone?: string;
    persona?: string;
  };
  contextSnippets?: string[];
  askPreview?: string | null;
  cautions?: string[];
  userQuery?: string;
}

export interface CopyResponse {
  lead: string;
  detail: string;
  usedFallback: boolean;
}

const sanitize = (value: string | null | undefined): string =>
  (value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const FALLBACKS: Record<CopyMode, { lead: (counts: CopyRequest['counts']) => string; detail: (counts: CopyRequest['counts']) => string }> = {
  chat: {
    lead: () => `You're asking the right questions—we can unpack it together and point you toward the next best step.`,
    detail: () => `I'll give you the quick scoop and then we can decide whether to look at actual products, compare fits, or keep exploring ideas.`,
  },
  clarify: {
    lead: (counts) => {
      const productCount = counts.productCount ?? 0;
      if (productCount <= 0) return `You're looking at a fresh set of options—we can dial in the fit together.`;
      if (productCount === 1) return `We've surfaced a strong contender—let's make sure it matches how you ride.`;
      return `You've got ${productCount} promising matches on the table—let's decide what matters most.`;
    },
    detail: () => `Tell me what you care about right now—brand loyalty, riding style, budget, or something else entirely—so we can tighten the shortlist and keep momentum.`,
  },
  recommend: {
    lead: (counts) => {
      const productCount = counts.productCount ?? 0;
      if (productCount <= 0) return `We tracked down a setup that fits what you told me—let's get you riding.`;
      if (productCount === 1) return `This pick matches the ride you described—ready to dive into the details together?`;
      return `These ${productCount} boards line up with your brief—let's pick the one that feels right.`;
    },
    detail: () => `Picture that first run: confident edge control, smooth response, and a board tuned to your vibe—open a card, line up a comparison, or tell me what to tweak and we'll keep refining.`,
  },
  compare: {
    lead: (counts) => {
      const productCount = counts.productCount ?? 0;
      if (productCount <= 1) return `Let's line these specs up so the differences pop before you decide.`;
      return `We've pulled a side-by-side on these ${productCount} boards—let's see what stands out.`;
    },
    detail: () => `Glance at flex, warranty, and extras in each column—tell me which one feels closest to the ride you're chasing and I'll dive deeper or swap boards around.`,
  },
};

const COPY_STYLE_GUIDANCE: Record<CopyMode, string[]> = {
  chat: [
    'Acknowledge their curiosity and keep the tone welcoming.',
    'Bridge from information into an invitation to keep exploring or shop.',
    'Use imagery or emotional hooks so it feels aspirational, not textbook.',
  ],
  clarify: [
    'Sound collaborative—use "we" and "you" as if you are deciding together.',
    'Acknowledge the momentum ("we already have good options") before asking what to narrow.',
    'End with an open invitation for them to share what matters most right now.',
  ],
  recommend: [
    'Paint the outcome they will feel—describe the ride, not a spec list.',
    'Invite a next step (open a card, compare, tweak) while keeping the choice theirs.',
    'Stay shopper-centric; avoid talking about the store in the third person.',
  ],
  compare: [
    'Explain how the comparison helps them decide and spotlight meaningful differences.',
    'Encourage them to point to the column that matches their goal or ask for changes.',
    'Offer to dig deeper or adjust the lineup based on their response.',
  ],
};

const buildPrompt = (request: CopyRequest): string => {
  const snippets = (request.contextSnippets ?? [])
    .map((snippet) => `• ${snippet}`)
    .slice(0, 3)
    .join('\n');

  const cautions = (request.cautions ?? [])
    .map((note) => `- ${note}`)
    .join('\n');

  const voiceTone = sanitize(request.brandVoice?.tone) || 'friendly';
  const voicePersona = sanitize(request.brandVoice?.persona) || 'helpful merchandiser';
  const guidance = COPY_STYLE_GUIDANCE[request.mode] ?? [];

  return [
    'You are the copywriter for a conversational shopping concierge.',
    `Speak in a ${voiceTone} tone and sound like a ${voicePersona}.`,
    'Write exactly two lines of copy that guide the shopper without referencing UI elements directly.',
    'Line 1 should feel like a natural headline anchored in their situation (aim for 12-18 words).',
    'Line 2 should be one conversational sentence focused on their outcome or next move (aim for 25-40 words).',
    'Speak in "you" and "we"; never rely on "this product" phrasing or talk about the store in the third person.',
    'Avoid encyclopedic definitions or bullet-like lists—stay warm, consultative, and solution-oriented.',
    "If you ask a question, keep it open and rooted in the shopper's context (SPIN-style).",
    '',
    `Turn mode: ${request.mode}`,
    request.userQuery ? `User question: ${request.userQuery}` : null,
    `Product count: ${request.counts.productCount ?? 0}`,
    `Option count: ${request.counts.optionCount ?? 0}`,
    request.askPreview ? `Clarifier preview: ${request.askPreview}` : null,
    snippets ? `Grounded context:\n${snippets}` : 'Grounded context: none',
    cautions ? `Cautions:\n${cautions}` : 'Cautions: none',
    '',
    'Style guidance:',
    ...guidance.map((line) => `- ${line}`),
    '',
    'Return format (plain text):',
    'LEAD: <short headline ≤18 words>',
    'DETAIL: <supporting line ≤45 words>',
    '',
    'Rules:',
    '- No bullet lists, no numbered lists.',
    '- Do not mention buttons, chips, quick replies, or UI.',
    '- Refer to counts using {{productCount}} and {{optionCount}} if needed.',
    '- Stay grounded in the provided context.',
  ]
    .filter(Boolean)
    .join('\n');
};

const extractLine = (text: string, prefix: string): string | null => {
  const regex = new RegExp(String.raw`^\s*${prefix}\s*:(.*)$`, 'im');
  const match = text.match(regex);
  if (!match) return null;
  const value = sanitize(match[1]);
  return value || null;
};

export async function writeTurnCopy(request: CopyRequest): Promise<CopyResponse> {
  const fallbackLead = FALLBACKS[request.mode].lead(request.counts);
  const fallbackDetail = FALLBACKS[request.mode].detail(request.counts);

  const prompt = buildPrompt(request);

  try {
    const response = await chatModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.6,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 160,
        responseMimeType: 'text/plain',
      },
    });

    const candidate = response.response.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text ?? '';
    const lead = extractLine(text, 'LEAD');
    const detail = extractLine(text, 'DETAIL');

    const patchedLead = lead?.replace(/\{\{productCount\}\}/g, String(request.counts.productCount ?? 0))
      .replace(/\{\{optionCount\}\}/g, String(request.counts.optionCount ?? 0));
    const patchedDetail = detail?.replace(/\{\{productCount\}\}/g, String(request.counts.productCount ?? 0))
      .replace(/\{\{optionCount\}\}/g, String(request.counts.optionCount ?? 0));

    let finalLead = sanitize(patchedLead) || fallbackLead;
    let finalDetail = sanitize(patchedDetail) || fallbackDetail;

    const leadWordCount = finalLead.split(' ').filter(Boolean).length;
    const detailWordCount = finalDetail.split(' ').filter(Boolean).length;

    if (leadWordCount < 6) {
      finalLead = fallbackLead;
    }

    if (detailWordCount < 15 || detailWordCount > 50) {
      finalDetail = fallbackDetail;
    }

    return {
      lead: finalLead,
      detail: finalDetail,
      usedFallback: finalLead === fallbackLead || finalDetail === fallbackDetail,
    };
  } catch (error) {
    console.warn('[copy-writer] Falling back to phrase bank', error);
    return { lead: fallbackLead, detail: fallbackDetail, usedFallback: true };
  }
}

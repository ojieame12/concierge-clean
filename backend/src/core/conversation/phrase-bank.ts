export type ToneStyle = 'warm' | 'neutral' | 'concise' | 'empathetic_urgent';

const phraseBank: Record<string, Record<ToneStyle, string[]>> = {
  opener: {
    warm: [
      'Nice! I’ve got {count} solid options for you.',
      'Here are {count} great matches.',
      'Found {count} that fit what you’re looking for.',
      'I pulled {count} options I think you’ll like.'
    ],
    neutral: [
      '{count} options match your request.',
      'Here are {count} products that fit.',
      'Found {count} relevant picks for you.',
      '{count} products line up with your preferences.'
    ],
    concise: [
      '{count} matches found.',
      '{count} solid picks.',
      'Here are {count} options.',
      'Found {count} results.'
    ],
    empathetic_urgent: [
      'Let’s fix this—{count} good options ready.',
      'I’ve got {count} fast fixes for you.',
      'Here are {count} options that should work right away.',
      'Pulled {count} reliable choices to get you sorted.'
    ],
  },
  clarifier: {
    warm: [
      'Which matters more right now?',
      'What should we focus on?',
      'What’s the most important detail to get right?',
      'Which one feels right for you?'
    ],
    neutral: [
      'Which priority should we focus on?',
      'What’s most important?',
      'How should we refine these?',
      'Which direction should we take?'
    ],
    concise: [
      'Priority?',
      'What matters most?',
      'Which one?',
      'Next filter?'
    ],
    empathetic_urgent: [
      'Tell me what to fix first.',
      'What do you need sorted right away?',
      'Where should we start?',
      'What’s blocking you most right now?'
    ],
  },
  evidenceIntro: {
    warm: [
      'Here’s what stood out:',
      'Quick snapshot:',
      'A few highlights:',
      'What I noticed:'
    ],
    neutral: [
      'Key details:',
      'Quick rundown:',
      'Notable points:',
      'Here’s what matters:'
    ],
    concise: [
      'Quick facts:',
      'Highlights:',
      'Key points:',
      'Summary:'
    ],
    empathetic_urgent: [
      'Here’s the important part:',
      'What you need to know:',
      'Key fixes:',
      'What we can lean on:'
    ],
  },
  uncertainty: {
    warm: [
      'I’m not seeing that exact spec—want close matches?',
      'That’s a bit outside our stock, but these are similar…',
      'We don’t have that exact one, but these are close.',
      'No exact match, but these are the best alternatives.'
    ],
    neutral: [
      'No exact match in stock. Here are the closest alternatives.',
      'That configuration isn’t available. Suggested alternatives below.',
      'Out of stock on that spec—closest options below.',
      'I don’t see that exact setup, but these are similar.'
    ],
    concise: [
      'No exact match. Showing closest options.',
      'That spec’s unavailable. Try these.',
      'Closest matches coming up.',
      'No exact fit—showing similar items.'
    ],
    empathetic_urgent: [
      'I know that’s frustrating—here’s what we can do instead.',
      'Sorry, that one’s gone. These are the next-best options.',
      'We can’t get that exact model, but here’s the quick solve.',
      'Let’s pivot—here’s what we can offer right now.'
    ],
  },
};

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export type PhraseCategory = keyof typeof phraseBank;

export function selectPhrase(
  category: PhraseCategory,
  tone: ToneStyle,
  sessionKey: string,
  vars: Record<string, string | number> = {}
): string {
  const toneVariants = phraseBank[category][tone] ?? phraseBank[category].warm;
  if (!toneVariants?.length) return '';

  const index = hashString(`${sessionKey}-${category}`) % toneVariants.length;
  let phrase = toneVariants[index];

  Object.entries(vars).forEach(([key, value]) => {
    phrase = phrase.replace(`{${key}}`, String(value));
  });

  return phrase;
}

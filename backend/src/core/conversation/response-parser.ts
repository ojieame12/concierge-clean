export interface InteractiveOption {
  id: string;
  label: string;
  value: string;
  icon?: string;
}

export interface StructuredResponse {
  summary: string;
  question?: string;
  options?: InteractiveOption[];
  followUp?: string;
  type: 'single_select' | 'confirmation' | 'none';
}

const extractSection = (text: string, label: string) => {
  const regex = new RegExp(`${label}:\\s*([\\s\\S]*?)(?=\\n\\w+?:|$)`, 'i');
  const match = text.match(regex);
  return match ? match[1].trim() : undefined;
};

const normaliseOptions = (section?: string): InteractiveOption[] | undefined => {
  if (!section) return undefined;

  const lines = section
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').trim())
    .filter(Boolean);

  if (!lines.length) return undefined;

  return lines.map((label, index) => ({
    id: `option_${index}`,
    label,
    value: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
  }));
};

/**
 * Parse structured LLM response using SUMMARY/QUESTION/OPTIONS/FOLLOW_UP sections.
 */
export function parseResponse(aiText: string): StructuredResponse {
  const summary = extractSection(aiText, 'SUMMARY') || aiText.trim();
  const question = extractSection(aiText, 'QUESTION');
  const optionsSection = extractSection(aiText, 'OPTIONS');
  const followUp = extractSection(aiText, 'FOLLOW_UP');

  const options = normaliseOptions(optionsSection);

  let type: StructuredResponse['type'] = 'none';
  if (question && /\b(yes|no)\b/i.test(question) && (!options || options.length === 0)) {
    type = 'confirmation';
  } else if (options && options.length > 0) {
    type = 'single_select';
  }

  return {
    summary,
    question,
    options,
    followUp,
    type,
  };
}

/**
 * Auto-detect common e-commerce question patterns and suggest options
 */
export function suggestOptions(question: string): InteractiveOption[] | null {
  const q = question.toLowerCase();

  // Skill level
  if (q.includes('skill level') || q.includes('experience')) {
    return [
      { id: 'beginner', label: 'Beginner', value: 'beginner', icon: '🌱' },
      { id: 'intermediate', label: 'Intermediate', value: 'intermediate', icon: '⚡' },
      { id: 'advanced', label: 'Advanced', value: 'advanced', icon: '🔥' },
    ];
  }

  // Gender
  if (q.includes('gender') || q.includes('men') || q.includes('women')) {
    return [
      { id: 'mens', label: "Men's", value: 'mens', icon: '👔' },
      { id: 'womens', label: "Women's", value: 'womens', icon: '👗' },
      { id: 'unisex', label: 'Unisex', value: 'unisex', icon: '✨' },
    ];
  }

  // Size
  if (q.includes('size')) {
    return [
      { id: 'xs', label: 'XS', value: 'xs' },
      { id: 's', label: 'S', value: 's' },
      { id: 'm', label: 'M', value: 'm' },
      { id: 'l', label: 'L', value: 'l' },
      { id: 'xl', label: 'XL', value: 'xl' },
    ];
  }

  // Color
  if (q.includes('color') || q.includes('colour')) {
    return [
      { id: 'black', label: 'Black', value: 'black', icon: '⚫' },
      { id: 'white', label: 'White', value: 'white', icon: '⚪' },
      { id: 'blue', label: 'Blue', value: 'blue', icon: '🔵' },
      { id: 'red', label: 'Red', value: 'red', icon: '🔴' },
      { id: 'other', label: 'Other', value: 'other', icon: '🎨' },
    ];
  }

  return null;
}

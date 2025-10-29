export const clampWords = (text: string, limit: number): string => {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= limit) return text;
  return `${words.slice(0, limit).join(' ')}…`;
};

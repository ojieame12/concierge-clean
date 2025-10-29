import type { Segment } from './index';

export function extractResponseStructure(segments: Segment[]): {
  mainLead: string | null;
  detail: string | null;
  contentSegments: Segment[];
} {
  let mainLead: string | null = null;
  let detail: string | null = null;
  let clarifier: string | null = null;
  const contentSegments: Segment[] = [];

  const splitNarrative = (text: string) => {
    const trimmed = text.trim();
    if (trimmed.length <= 140) {
      return { lead: trimmed, rest: null };
    }

    const sentenceMatch = trimmed.match(/(.+?[.!?…])\s+(.*)/);
    if (sentenceMatch) {
      const [, lead, rest] = sentenceMatch;
      return {
        lead: lead.trim(),
        rest: rest.trim().length ? rest.trim() : null,
      };
    }

    return {
      lead: `${trimmed.slice(0, 140).trim()}…`,
      rest: trimmed.slice(140).trim() || null,
    };
  };

  for (const segment of segments) {
    if (segment.type === 'narrative') {
      if (!mainLead) {
        const { lead, rest } = splitNarrative(segment.text);
        mainLead = lead;
        if (!detail && rest) {
          detail = rest;
        } else if (rest) {
          contentSegments.push({ type: 'narrative', text: rest });
        }
        continue;
      }
      if (!detail) {
        detail = segment.text;
        continue;
      }
    }

    if (segment.type === 'note' && segment.tone === 'discreet' && !detail) {
      detail = segment.text;
      continue;
    }

    if (segment.type === 'ask' && !clarifier) {
      clarifier = segment.text;
      continue;
    }

    contentSegments.push(segment);
  }

  if (!detail) {
    detail = clarifier;
  }

  if (!mainLead && detail) {
    mainLead = detail;
    detail = null;
  }

  return { mainLead, detail, contentSegments };
}

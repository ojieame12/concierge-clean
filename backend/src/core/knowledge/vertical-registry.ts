export type VerticalPackId = 'snowboard';

export interface VerticalPack {
  id: VerticalPackId;
  label: string;
  detect: (input: VerticalDetectionInput) => boolean;
}

export interface VerticalDetectionInput {
  productType?: string | null;
  tags?: string[];
  vendor?: string | null;
}

const snowboardKeywords = ['snowboard', 'snow board', 'splitboard'];

const snowboardPack: VerticalPack = {
  id: 'snowboard',
  label: 'Snowboard Pack',
  detect: ({ productType, tags }) => {
    const haystack = [productType, ...(tags ?? [])]
      .filter(Boolean)
      .map((value) => value!.toLowerCase());

    if (!haystack.length) return false;

    return snowboardKeywords.some((needle) => haystack.some((value) => value.includes(needle)));
  },
};

const PACKS: VerticalPack[] = [snowboardPack];

export const detectVerticalForProduct = (input: VerticalDetectionInput): VerticalPackId | null => {
  for (const pack of PACKS) {
    if (pack.detect(input)) {
      return pack.id;
    }
  }

  return null;
};

export const verticalPacks = PACKS;

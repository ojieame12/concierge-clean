export interface ClarifierOption {
  label: string;
  value: string;
  aliases?: string[];
}

export const DEFAULT_CLARIFIER_CHOICES: Record<string, ClarifierOption[]> = {
  style: [
    { label: 'All Mountain', value: 'all_mountain', aliases: ['all mountain', 'all-mountain'] },
    { label: 'Freestyle', value: 'freestyle' },
    { label: 'Powder', value: 'powder' },
    { label: 'Park', value: 'park', aliases: ['terrain park'] },
  ],
  price_bucket: [
    { label: 'Under $50', value: 'Under $50', aliases: ['under 50', 'under fifty'] },
    { label: '$50 - $200', value: '$50-$200', aliases: ['$50 to $200', '50-200'] },
    { label: '$200+', value: '$200+', aliases: ['200+', '$200 plus'] },
  ],
};

export const FALLBACK_FACET_PRIORITY = ['style', 'price_bucket'];

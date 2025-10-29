export interface AccumulatedIntent {
  category?: string;
  skillLevel?: string;
  useCase?: string;
  minPrice?: number;
  maxPrice?: number;
  priceBucket?: string;
  selectedVendor?: string;
  selectedTags?: string[];
  size?: string;
  color?: string;
}

/**
 * Extract shopping intent from user message
 * Accumulates constraints across conversation turns
 */
export function extractIntent(
  message: string,
  previousIntent: AccumulatedIntent = {}
): AccumulatedIntent {
  const intent: AccumulatedIntent = { ...previousIntent };
  const lower = message.toLowerCase();

  // Extract category
  const categoryMatch = lower.match(/(skateboard|snowboard|surfboard|helmet|boots|jacket|pants)/);
  if (categoryMatch) {
    intent.category = categoryMatch[1];
  }

  // Extract skill level
  if (/beginner|novice|starter|new to|first time|learning/.test(lower)) {
    intent.skillLevel = 'beginner';
  } else if (/intermediate|some experience|can do/.test(lower)) {
    intent.skillLevel = 'intermediate';
  } else if (/advanced|expert|pro|experienced/.test(lower)) {
    intent.skillLevel = 'advanced';
  }

  // Extract use case
  if (/park|freestyle|tricks/.test(lower)) {
    intent.useCase = 'freestyle';
  } else if (/all.mountain|versatile|general/.test(lower)) {
    intent.useCase = 'all-mountain';
  } else if (/powder|backcountry|off.piste/.test(lower)) {
    intent.useCase = 'powder';
  }

  // Extract price constraints
  const underMatch = lower.match(/under \$?(\d+)/);
  if (underMatch) {
    intent.maxPrice = parseInt(underMatch[1]);
  }

  const overMatch = lower.match(/over \$?(\d+)|above \$?(\d+)/);
  if (overMatch) {
    intent.minPrice = parseInt(overMatch[1] || overMatch[2]);
  }

  const betweenMatch = lower.match(/\$?(\d+)\s*-\s*\$?(\d+)|\$?(\d+)\s+to\s+\$?(\d+)/);
  if (betweenMatch) {
    intent.minPrice = parseInt(betweenMatch[1] || betweenMatch[3]);
    intent.maxPrice = parseInt(betweenMatch[2] || betweenMatch[4]);
  }

  // Extract from facet option clicks (e.g., "$50-$100")
  const priceBucketMatch = message.match(/^\$?(\d+)-\$?(\d+)$/);
  if (priceBucketMatch) {
    intent.minPrice = parseInt(priceBucketMatch[1]);
    intent.maxPrice = parseInt(priceBucketMatch[2]);
    intent.priceBucket = message;
  }

  // Extract from "Under $50" style options
  const underBucketMatch = message.match(/^Under \$(\d+)$/i);
  if (underBucketMatch) {
    intent.maxPrice = parseInt(underBucketMatch[1]);
    intent.priceBucket = message;
  }

  // Extract vendor selection
  // If message is just a brand name, it's likely a vendor selection
  if (message.length < 30 && !message.includes(' ') && /^[A-Z]/.test(message)) {
    intent.selectedVendor = message;
  }

  // Extract size
  const sizeMatch = message.match(/size (\w+)|(\d+)cm|(\d+) inch/i);
  if (sizeMatch) {
    intent.size = sizeMatch[1] || sizeMatch[2] || sizeMatch[3];
  }

  // Extract color
  const colorMatch = message.match(/\b(black|white|red|blue|green|yellow|orange|purple|pink|gray|brown)\b/i);
  if (colorMatch) {
    intent.color = colorMatch[1];
  }

  return intent;
}

/**
 * Build a semantic query that includes accumulated intent
 */
export function buildSemanticQuery(
  userMessage: string,
  intent: AccumulatedIntent
): string {
  const parts: string[] = [];

  // Original query
  parts.push(userMessage);

  // Add accumulated context
  if (intent.category) parts.push(intent.category);
  if (intent.skillLevel) parts.push(intent.skillLevel);
  if (intent.useCase) parts.push(intent.useCase);

  // Don't add price/vendor to semantic query (handled by filters)

  return parts.join(' ');
}

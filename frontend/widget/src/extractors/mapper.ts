/**
 * Style mapping utilities
 * Maps extracted CSS values to safe theme tokens
 */

// Font allowlist (curated Google Fonts + system fonts)
const FONT_ALLOWLIST = [
  "Inter",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Open Sans",
  "DM Sans",
  "Source Sans 3",
  "IBM Plex Sans",
  "Nunito",
  "Work Sans",
  "Lato",
  "Raleway",
  "Merriweather",
  "Lora",
  "Playfair Display",
  "PT Sans",
  "Noto Sans",
  "Ubuntu",
  "Rubik",
  "Karla",
  "system-ui",
  "sans-serif",
  "serif"
];

/**
 * Normalize font family to allowlist
 * Extracts first font from stack and matches against allowlist
 */
export function normalizeFontFamily(ff?: string): string {
  if (!ff) return "Inter";
  
  // Take the first family token, strip quotes
  const first = ff.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
  
  // Fuzzy match against allowlist (case-insensitive)
  const hit = FONT_ALLOWLIST.find(f => 
    first.toLowerCase().includes(f.toLowerCase()) ||
    f.toLowerCase().includes(first.toLowerCase())
  );
  
  return hit ?? "Inter";
}

/**
 * Map box-shadow to token (none, sm, md, lg)
 * Analyzes blur radius to determine closest preset
 */
export function mapShadowToToken(boxShadow?: string): "none" | "sm" | "md" | "lg" {
  if (!boxShadow || boxShadow === "none") return "none";
  
  const matches = boxShadow.match(/(\d+(\.\d+)?)px/g);
  if (!matches) return "md";
  
  // Try to interpret blur radius as the 3rd length (offset-x, offset-y, blur, spread)
  const blur = parseFloat(matches[2] ?? matches[1] ?? "8");
  
  if (blur <= 4) return "sm";
  if (blur <= 10) return "md";
  return "lg";
}

/**
 * Detect card variant based on shadow and border
 */
export function detectVariant(
  boxShadow?: string,
  border?: string
): "base" | "minimal" | "merchant" {
  if (boxShadow && boxShadow !== "none") return "base";
  if (border && border !== "none" && border !== "0px none") return "minimal";
  return "merchant";
}

/**
 * Map image dimensions to aspect ratio token
 * Uses nearest-bucket algorithm
 */
export function mapAspectFromDims(
  w?: number,
  h?: number
): "1:1" | "4:5" | "3:4" | "16:9" {
  if (!w || !h) return "4:5";
  
  const r = w / h;
  
  // Nearest-bucket mapping
  const buckets = [
    { k: "1:1", v: 1 },
    { k: "4:5", v: 0.8 },
    { k: "3:4", v: 0.75 },
    { k: "16:9", v: 1.777 }
  ];
  
  let best = "4:5";
  let bestd = 9;
  
  for (const b of buckets) {
    const d = Math.abs(r - b.v);
    if (d < bestd) {
      bestd = d;
      best = b.k as any;
    }
  }
  
  return best as any;
}

/**
 * Clamp border radius to safe range (0-24px)
 */
export function clampRadius(radius?: string): string {
  if (!radius) return "12px";
  
  const px = parseFloat(radius);
  if (isNaN(px)) return "12px";
  
  const clamped = Math.max(0, Math.min(24, px));
  return `${clamped}px`;
}

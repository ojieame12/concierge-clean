import { z } from "zod";

/**
 * Theme Schema - Strict contract for merchant customization
 * 
 * Merchants can customize exactly 5 things:
 * 1. Logo (hero + nav sizes)
 * 2. Fonts (lead + detail)
 * 3. CTA button color
 * 4. Product card skin
 * 5. Card micro-tokens (radius/shadow/aspect)
 * 
 * Everything else (grid, spacing, segment order, JSON response) stays consistent.
 */

export const ThemeSchema = z.object({
  logo: z.object({
    src: z.string().url(),
    alt: z.string().default(""),
    heroHeight: z.number().int().min(32).max(120).default(72),
    navHeight: z.number().int().min(16).max(48).default(24)
  }),
  
  fonts: z.object({
    lead: z.string(),      // validated against allowlist
    detail: z.string(),    // validated against allowlist
    urls: z.array(z.string().url()).max(4).default([]) // optional self-hosted
  }),
  
  cta: z.object({
    bg: z.string().regex(/^#([0-9a-f]{6}|[0-9a-f]{3})$/i),
    radius: z.string().regex(/^\d+px$/).default("10px")
  }),
  
  card: z.object({
    variant: z.enum(["base", "minimal", "merchant"]).default("base"),
    imageAspect: z.enum(["1:1", "4:5", "3:4", "16:9"]).default("4:5"),
    radius: z.string().regex(/^\d+px$/).default("12px"),
    shadow: z.enum(["none", "sm", "md", "lg"]).default("sm")
  })
});

export type Theme = z.infer<typeof ThemeSchema>;

/**
 * Hard allowlist of web-safe fonts or curated Google Fonts
 * Prevents arbitrary font injection for security and performance
 */
export const FONT_ALLOWLIST = new Set([
  "Inter",
  "DM Sans",
  "IBM Plex Sans",
  "Nunito",
  "Work Sans",
  "Source Sans 3",
  "Merriweather",
  "Lora",
  "Playfair Display",
  "system-ui"
]);

/**
 * Validate font against allowlist
 */
export function isValidFont(font: string): boolean {
  return FONT_ALLOWLIST.has(font);
}

/**
 * Get list of allowed fonts for UI display
 */
export function getAllowedFonts(): string[] {
  return Array.from(FONT_ALLOWLIST).sort();
}

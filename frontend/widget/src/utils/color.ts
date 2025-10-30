/**
 * Color utilities for WCAG 2.1 compliance
 * Handles hex/rgb conversion, luminance, contrast, and accessible text colors
 */

export function hexToRgb(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return null;
  const s = m[1].length === 3 ? m[1].split("").map(x => x + x).join("") : m[1];
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  return { r, g, b };
}

export function rgbStrToRgb(s: string) {
  const m = s.match(/rgba?\((\d+),\s?(\d+),\s?(\d+)/i);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

/**
 * WCAG 2.1 relative luminance calculation
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function luminance({ r, g, b }: { r: number; g: number; b: number }) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
}

/**
 * WCAG 2.1 contrast ratio calculation
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */
export function contrastRatio(
  c1: { r: number; g: number; b: number },
  c2: { r: number; g: number; b: number }
) {
  const L1 = luminance(c1);
  const L2 = luminance(c2);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Determine best text color (white or black) for given background
 * Ensures WCAG AA compliance (4.5:1 minimum)
 */
export function bestTextOn(bg: string) {
  const rgb = hexToRgb(bg) ?? rgbStrToRgb(bg);
  if (!rgb) return "#000"; // fallback
  const black = { r: 0, g: 0, b: 0 };
  const white = { r: 255, g: 255, b: 255 };
  return contrastRatio(rgb, white) >= contrastRatio(rgb, black) ? "#fff" : "#000";
}

/**
 * Darken a hex color by percentage (for hover states)
 */
export function darkenHex(hex: string, pct = 8) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const f = (v: number) => Math.max(0, Math.round(v * (100 - pct) / 100));
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(f(rgb.r))}${toHex(f(rgb.g))}${toHex(f(rgb.b))}`;
}

/**
 * Convert RGB object to hex string
 */
export function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

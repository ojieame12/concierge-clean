/**
 * Color utility functions for accessible CTA button colors
 * 
 * Merchants pick ONE color, we auto-compute:
 * - Text color (black or white for WCAG AA contrast)
 * - Hover state (darken 10%)
 * - Focus outline (lighten 40%)
 */

/**
 * Compute accessible text color (black or white) based on background
 * Uses YIQ color space for quick luminance calculation
 * 
 * @param hex - Background color in hex format (#RRGGBB or #RGB)
 * @returns "#000" for dark text or "#fff" for light text
 */
export function computeAccessibleText(hex: string): "#000" | "#fff" {
  const rgb = hexToRgb(hex);
  
  // YIQ formula: perceived brightness
  const yiq = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
  
  // Threshold at 150 (empirically good for most colors)
  return yiq >= 150 ? "#000" : "#fff";
}

/**
 * Derive hover state by darkening the base color
 * 
 * @param hex - Base color in hex format
 * @returns Darkened hex color for hover state
 */
export function deriveHover(hex: string): string {
  const hsl = hexToHsl(hex);
  
  // Darken by 8% in lightness
  const newL = Math.max(0, hsl.l - 8);
  
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Derive focus outline by lightening the base color
 * 
 * @param hex - Base color in hex format
 * @returns Lightened hex color for focus outline
 */
export function deriveFocus(hex: string): string {
  const hsl = hexToHsl(hex);
  
  // Lighten by 40% in lightness
  const newL = Math.min(100, hsl.l + 40);
  
  return hslToHex(hsl.h, hsl.s, newL);
}

/**
 * Convert hex color to RGB array
 */
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const expanded = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  
  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  
  return [r, g, b];
}

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / delta + 2) / 6;
        break;
      case b:
        h = ((r - g) / delta + 4) / 6;
        break;
    }
  }
  
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

/**
 * Convert HSL to hex color
 */
function hslToHex(h: number, s: number, l: number): string {
  const hNorm = h / 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  let r, g, b;
  
  if (sNorm === 0) {
    r = g = b = lNorm;
  } else {
    const q = lNorm < 0.5 ? lNorm * (1 + sNorm) : lNorm + sNorm - lNorm * sNorm;
    const p = 2 * lNorm - q;
    r = hue2rgb(p, q, hNorm + 1/3);
    g = hue2rgb(p, q, hNorm);
    b = hue2rgb(p, q, hNorm - 1/3);
  }
  
  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Check if a color meets WCAG AA contrast requirements
 * 
 * @param bgHex - Background color
 * @param fgHex - Foreground color
 * @returns Contrast ratio (4.5:1 minimum for WCAG AA)
 */
export function checkContrast(bgHex: string, fgHex: string): number {
  const bgLum = getLuminance(bgHex);
  const fgLum = getLuminance(fgHex);
  
  const lighter = Math.max(bgLum, fgLum);
  const darker = Math.min(bgLum, fgLum);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Calculate relative luminance
 * https://www.w3.org/TR/WCAG20/#relativeluminancedef
 */
function getLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  const [r, g, b] = rgb.map(val => {
    const sRGB = val / 255;
    return sRGB <= 0.03928
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

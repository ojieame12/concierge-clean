import { ThemeSchema, FONT_ALLOWLIST, type Theme } from '@insite/shared-types';
import { ZodError } from 'zod';

/**
 * Validation result with detailed errors
 */
export interface ValidationResult {
  valid: boolean;
  theme?: Theme;
  errors?: string[];
}

/**
 * Validate theme with Zod schema + custom rules
 */
export function validateTheme(input: unknown): ValidationResult {
  const errors: string[] = [];

  // 1. Zod schema validation
  let theme: Theme;
  try {
    theme = ThemeSchema.parse(input);
  } catch (err) {
    if (err instanceof ZodError) {
      return {
        valid: false,
        errors: err.errors.map(e => `${e.path.join('.')}: ${e.message}`)
      };
    }
    return {
      valid: false,
      errors: ['Invalid theme format']
    };
  }

  // 2. Font allowlist validation
  if (!FONT_ALLOWLIST.has(theme.fonts.lead)) {
    errors.push(`Invalid lead font: ${theme.fonts.lead}. Must be one of: ${Array.from(FONT_ALLOWLIST).join(', ')}`);
  }

  if (!FONT_ALLOWLIST.has(theme.fonts.detail)) {
    errors.push(`Invalid detail font: ${theme.fonts.detail}. Must be one of: ${Array.from(FONT_ALLOWLIST).join(', ')}`);
  }

  // 3. CTA contrast validation (WCAG AA requires 4.5:1 for normal text)
  const ctaContrast = checkContrast(theme.cta.bg);
  if (ctaContrast < 4.5) {
    errors.push(`CTA button color has insufficient contrast (${ctaContrast.toFixed(2)}:1). Minimum is 4.5:1 for WCAG AA.`);
  }

  // 4. Logo URL validation (basic check)
  try {
    new URL(theme.logo.src);
  } catch {
    errors.push(`Invalid logo URL: ${theme.logo.src}`);
  }

  // 5. Font URLs validation
  for (const url of theme.fonts.urls) {
    try {
      new URL(url);
    } catch {
      errors.push(`Invalid font URL: ${url}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, theme };
}

/**
 * Check contrast ratio between background and auto-selected text color
 * Returns contrast ratio (higher is better, 4.5:1 minimum for WCAG AA)
 */
function checkContrast(bgHex: string): number {
  const bgLuminance = getLuminance(bgHex);
  
  // Check contrast with both black and white text
  const blackLuminance = 0;
  const whiteLuminance = 1;
  
  const contrastWithBlack = (bgLuminance + 0.05) / (blackLuminance + 0.05);
  const contrastWithWhite = (whiteLuminance + 0.05) / (bgLuminance + 0.05);
  
  // Return the better contrast (we'll auto-select the appropriate text color)
  return Math.max(contrastWithBlack, contrastWithWhite);
}

/**
 * Calculate relative luminance for a hex color
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
 * Sanitize theme by clamping values to safe ranges
 * Used as a fallback when validation fails
 */
export function sanitizeTheme(theme: Partial<Theme>): Theme {
  return {
    logo: {
      src: theme.logo?.src || '',
      alt: theme.logo?.alt || '',
      heroHeight: clamp(theme.logo?.heroHeight || 72, 32, 120),
      navHeight: clamp(theme.logo?.navHeight || 24, 16, 48)
    },
    fonts: {
      lead: FONT_ALLOWLIST.has(theme.fonts?.lead || '') ? theme.fonts!.lead : 'Inter',
      detail: FONT_ALLOWLIST.has(theme.fonts?.detail || '') ? theme.fonts!.detail : 'Inter',
      urls: (theme.fonts?.urls || []).slice(0, 4)
    },
    cta: {
      bg: /^#([0-9a-f]{6}|[0-9a-f]{3})$/i.test(theme.cta?.bg || '') ? theme.cta!.bg : '#3B82F6',
      radius: /^\d+px$/.test(theme.cta?.radius || '') ? theme.cta!.radius : '10px'
    },
    card: {
      variant: ['base', 'minimal', 'merchant'].includes(theme.card?.variant || '') 
        ? theme.card!.variant as 'base' | 'minimal' | 'merchant'
        : 'base',
      imageAspect: ['1:1', '4:5', '3:4', '16:9'].includes(theme.card?.imageAspect || '')
        ? theme.card!.imageAspect as '1:1' | '4:5' | '3:4' | '16:9'
        : '4:5',
      radius: /^\d+px$/.test(theme.card?.radius || '') ? theme.card!.radius : '12px',
      shadow: ['none', 'sm', 'md', 'lg'].includes(theme.card?.shadow || '')
        ? theme.card!.shadow as 'none' | 'sm' | 'md' | 'lg'
        : 'sm'
    }
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

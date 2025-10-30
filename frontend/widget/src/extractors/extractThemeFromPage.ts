/**
 * Main theme extraction logic
 * Extracts computed styles from current page and maps to theme schema
 */

import {
  CARD_SELECTORS,
  TITLE_SELECTORS,
  PRICE_SELECTORS,
  CTA_SELECTORS,
  LOGO_SELECTORS,
  FAVICON_SELECTORS
} from "./selectors";
import { getStyle, pickFirst, sizeOf } from "../utils/dom";
import { bestTextOn, darkenHex, rgbStrToRgb } from "../utils/color";
import {
  detectVariant,
  mapAspectFromDims,
  mapShadowToToken,
  normalizeFontFamily,
  clampRadius
} from "./mapper";

/**
 * Theme schema (matches backend/shared types)
 */
export type Theme = {
  logo: { src: string; alt: string; heroHeight?: number; navHeight?: number };
  fonts: { lead: string; detail: string };
  cta: { bg: string; fg: string; hover: string; radius: string };
  card: {
    variant: "base" | "minimal" | "merchant";
    radius: string;
    shadow: "none" | "sm" | "md" | "lg";
    imageAspect: "1:1" | "4:5" | "3:4" | "16:9";
  };
};

/**
 * Default theme (fallback if extraction fails)
 */
const DEFAULT: Theme = {
  logo: { src: "", alt: document.title || "Logo", heroHeight: 72, navHeight: 24 },
  fonts: { lead: "Inter", detail: "Inter" },
  cta: { bg: "#111827", fg: "#fff", hover: "#0b1220", radius: "10px" },
  card: { variant: "base", radius: "12px", shadow: "sm", imageAspect: "4:5" }
};

/**
 * Find a regular product card on the page
 * Filters out hero/featured cards by checking for image, title, and reasonable height
 */
function findProductCard(): Element | null {
  return pickFirst(CARD_SELECTORS, el => {
    // Skip hero/featured: prefer grid items with image + title
    const img = el.querySelector("img");
    const hasTitle = TITLE_SELECTORS.some(s => el.querySelector(s));
    const size = sizeOf(el);
    
    // Must have image, title, and be at least 100px tall
    return !!img && hasTitle && size.h > 100;
  });
}

/**
 * Extract logo from header/nav
 * Falls back to favicon if no logo found
 */
function extractLogo(): { src: string; alt: string } {
  // Try common logo selectors
  const logo = pickFirst(LOGO_SELECTORS) as HTMLImageElement | null;
  if (logo?.src) {
    return { src: logo.src, alt: logo.alt || "Logo" };
  }

  // Fallback to site icon (favicon)
  const icon = pickFirst(FAVICON_SELECTORS) as HTMLLinkElement | null;
  return { src: icon?.href || "", alt: document.title || "Logo" };
}

/**
 * Detect CTA button color and radius
 * Multiple fallback strategies:
 * 1. Common button selectors
 * 2. CSS custom properties (--color-primary, --primary)
 * 3. Default theme
 */
function detectCTA(): { bg: string; radius: string } {
  // Try finding a primary button
  const btn = pickFirst(CTA_SELECTORS);
  if (btn) {
    const cs = getStyle(btn);
    const bg =
      cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)"
        ? cs.backgroundColor
        : cs.color;
    return { bg, radius: cs.borderRadius || "10px" };
  }

  // Try CSS variables commonly used for primary color
  const root = getStyle(document.documentElement);
  const primary =
    root.getPropertyValue("--color-primary") || root.getPropertyValue("--primary");
  if (primary) return { bg: primary.trim(), radius: "10px" };

  // Default
  return { bg: DEFAULT.cta.bg, radius: DEFAULT.cta.radius };
}

/**
 * Main extraction function
 * Runs on client's page during widget initialization
 */
export function extractThemeFromCurrentPage(): Theme {
  const card = findProductCard();
  const { src, alt } = extractLogo();

  // If no product card found, return default with extracted logo
  if (!card) {
    console.warn("[Insite] No product card found, using default theme");
    return { ...DEFAULT, logo: { ...DEFAULT.logo, src, alt } };
  }

  console.log("[Insite] Product card found, extracting styles...");

  // Extract card styles
  const box = getStyle(card);
  const border = box.border;
  const shadow = mapShadowToToken(box.boxShadow);
  const radius = clampRadius(box.borderRadius);

  // Extract image aspect ratio
  const img = card.querySelector("img") as HTMLImageElement | null;
  const dims = img
    ? img.naturalWidth && img.naturalHeight
      ? { w: img.naturalWidth, h: img.naturalHeight }
      : sizeOf(img)
    : { w: 0, h: 0 };
  const imageAspect = mapAspectFromDims(dims.w, dims.h);

  // Extract typography
  const titleEl =
    (card.querySelector(TITLE_SELECTORS.join(",")) as Element) || card;
  const priceEl = card.querySelector(PRICE_SELECTORS.join(",")) as Element | null;

  const titleStyle = getStyle(titleEl);
  const priceStyle = priceEl ? getStyle(priceEl) : titleStyle;

  const lead = normalizeFontFamily(titleStyle.fontFamily);
  const detail = normalizeFontFamily(priceStyle.fontFamily);

  // Extract CTA color
  const ctaGuess = detectCTA();
  const fg = bestTextOn(ctaGuess.bg);
  const hover =
    typeof ctaGuess.bg === "string" && ctaGuess.bg.startsWith("#")
      ? darkenHex(ctaGuess.bg, 8)
      : ctaGuess.bg;

  const theme: Theme = {
    logo: { src, alt, heroHeight: 72, navHeight: 24 },
    fonts: { lead, detail },
    cta: { bg: ctaGuess.bg, fg, hover, radius: clampRadius(ctaGuess.radius) },
    card: {
      variant: detectVariant(box.boxShadow, border),
      radius,
      shadow,
      imageAspect
    }
  };

  console.log("[Insite] Theme extracted:", theme);
  return theme;
}

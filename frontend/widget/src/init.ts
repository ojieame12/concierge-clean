/**
 * Widget initialization with theme extraction and caching
 * 
 * Flow:
 * 1. Check localStorage cache (instant render)
 * 2. Fetch from server (authoritative)
 * 3. If no server theme, extract from page
 * 4. Save to localStorage + server
 */

import { extractThemeFromCurrentPage, type Theme } from "./extractors/extractThemeFromPage";

type Config = {
  clientId: string;
  apiBase?: string;
  apiKey?: string;
};

const LS_KEY = (id: string) => `insite_theme_${id}_v1`;

/**
 * Fetch theme from server
 */
async function fetchTheme(
  clientId: string,
  apiBase: string,
  apiKey?: string
): Promise<Theme | null> {
  try {
    const r = await fetch(`${apiBase}/v1/theme/${encodeURIComponent(clientId)}`, {
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      credentials: "include"
    });
    if (!r.ok) return null;
    const data = await r.json();
    // Handle both direct theme object and wrapped response
    return data.theme || data;
  } catch (err) {
    console.warn("[Insite] Failed to fetch theme from server:", err);
    return null;
  }
}

/**
 * Save theme to server (fire-and-forget)
 */
async function saveTheme(
  clientId: string,
  apiBase: string,
  theme: Theme,
  apiKey?: string
) {
  try {
    await fetch(`${apiBase}/v1/theme/${encodeURIComponent(clientId)}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { "x-api-key": apiKey } : {})
      },
      body: JSON.stringify(theme),
      credentials: "include"
    });
    console.log("[Insite] Theme saved to server");
  } catch (err) {
    console.warn("[Insite] Failed to save theme to server:", err);
  }
}

/**
 * Apply theme as CSS variables
 * Sets variables on document root for widget to consume
 */
function applyCssVars(theme: Theme) {
  const root = document.documentElement;

  // Fonts
  root.style.setProperty("--insite-font-lead", `'${theme.fonts.lead}', system-ui, sans-serif`);
  root.style.setProperty("--insite-font-detail", `'${theme.fonts.detail}', system-ui, sans-serif`);

  // CTA
  root.style.setProperty("--insite-cta-bg", String(theme.cta.bg));
  root.style.setProperty("--insite-cta-fg", String(theme.cta.fg));
  root.style.setProperty("--insite-cta-bg-hover", String(theme.cta.hover));
  root.style.setProperty("--insite-cta-radius", String(theme.cta.radius));

  // Card
  root.style.setProperty("--insite-card-radius", String(theme.card.radius));
  root.style.setProperty(
    "--insite-card-shadow",
    theme.card.shadow === "none"
      ? "none"
      : theme.card.shadow === "sm"
      ? "0 1px 4px rgba(0,0,0,0.08)"
      : theme.card.shadow === "md"
      ? "0 4px 18px rgba(0,0,0,0.12)"
      : "0 12px 28px rgba(0,0,0,0.16)"
  );

  // Image aspect ratio (as padding-top percentage)
  const aspect = theme.card.imageAspect;
  const [w, h] = aspect.split(":").map(Number);
  root.style.setProperty("--insite-card-aspect", `${(h / w) * 100}%`);

  // Logo
  root.style.setProperty("--insite-logo-src", `url(${theme.logo.src})`);
  root.style.setProperty("--insite-logo-hero-height", `${theme.logo.heroHeight || 72}px`);
  root.style.setProperty("--insite-logo-nav-height", `${theme.logo.navHeight || 24}px`);

  console.log("[Insite] CSS variables applied");
}

/**
 * Initialize Insite widget with theme extraction
 * 
 * IMPORTANT: This does NOT break existing UI!
 * - Only sets CSS variables (--insite-*)
 * - Existing components continue to work
 * - Theme editor remains as fallback
 */
export async function initializeInsiteWidget(cfg: Config) {
  const apiBase = cfg.apiBase || "https://api.insite.com";

  console.log("[Insite] Initializing widget for client:", cfg.clientId);

  // Step 1: Try localStorage cache (instant render)
  const cached = localStorage.getItem(LS_KEY(cfg.clientId));
  if (cached) {
    try {
      const theme = JSON.parse(cached);
      applyCssVars(theme);
      console.log("[Insite] Applied cached theme");
    } catch (err) {
      console.warn("[Insite] Failed to parse cached theme:", err);
    }
  }

  // Step 2: Fetch from server (authoritative)
  const existing = await fetchTheme(cfg.clientId, apiBase, cfg.apiKey);
  if (existing) {
    applyCssVars(existing);
    localStorage.setItem(LS_KEY(cfg.clientId), JSON.stringify(existing));
    console.log("[Insite] Applied server theme");
    return existing;
  }

  // Step 3: Auto-extract from page
  console.log("[Insite] No server theme found, extracting from page...");
  const extracted = extractThemeFromCurrentPage();
  applyCssVars(extracted);
  localStorage.setItem(LS_KEY(cfg.clientId), JSON.stringify(extracted));

  // Step 4: Save to server (fire-and-forget)
  saveTheme(cfg.clientId, apiBase, extracted, cfg.apiKey);

  return extracted;
}

/**
 * Clear cached theme (for testing/debugging)
 */
export function clearCachedTheme(clientId: string) {
  localStorage.removeItem(LS_KEY(clientId));
  console.log("[Insite] Cached theme cleared");
}

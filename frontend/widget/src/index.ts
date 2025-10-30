/**
 * Insite Widget - Public API
 * 
 * Exposes window.Insite.init() for client-side initialization
 * 
 * Usage:
 * <script src="https://cdn.insite.com/insite-widget.js" async></script>
 * <script>
 *   window.Insite.init({
 *     clientId: "acme-industrial",
 *     apiBase: "https://api.insite.com",
 *     apiKey: "optional-api-key"
 *   });
 * </script>
 */

import { initializeInsiteWidget, clearCachedTheme } from "./init";
import type { Theme } from "./extractors/extractThemeFromPage";

declare global {
  interface Window {
    Insite?: {
      init: (config: {
        clientId: string;
        apiBase?: string;
        apiKey?: string;
      }) => Promise<Theme>;
      clearCache: (clientId: string) => void;
      version: string;
    };
  }
}

// Initialize global Insite object
window.Insite = window.Insite || {
  /**
   * Initialize Insite widget
   * Automatically extracts theme from page if not configured
   */
  init: (config: { clientId: string; apiBase?: string; apiKey?: string }) => {
    return initializeInsiteWidget(config);
  },

  /**
   * Clear cached theme (for testing/debugging)
   */
  clearCache: (clientId: string) => {
    clearCachedTheme(clientId);
  },

  /**
   * Widget version
   */
  version: "1.0.0"
};

console.log("[Insite] Widget loaded, version", window.Insite.version);

// Export for TypeScript consumers
export { initializeInsiteWidget, clearCachedTheme };
export type { Theme };

'use client';

import React, { createContext, useContext, useMemo } from 'react';
import type { Theme } from '@insite/shared-types';
import { computeAccessibleText, deriveHover, deriveFocus } from './color-utils';

interface ThemeContextValue {
  theme: Theme;
  shopId: string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

interface ThemeProviderProps {
  theme: Theme;
  shopId: string;
  children: React.ReactNode;
}

/**
 * ThemeProvider - Applies merchant theme via CSS variables
 * 
 * Scopes styles to prevent cross-tenant leakage:
 * - data-tenant={shopId} for isolation
 * - data-skin={variant} for card styling
 * - CSS variables for all customizable tokens
 * 
 * DOM structure stays consistent; only variables change.
 */
export function ThemeProvider({ theme, shopId, children }: ThemeProviderProps) {
  // Compute derived colors
  const ctaText = useMemo(() => computeAccessibleText(theme.cta.bg), [theme.cta.bg]);
  const ctaHover = useMemo(() => deriveHover(theme.cta.bg), [theme.cta.bg]);
  const ctaFocus = useMemo(() => deriveFocus(theme.cta.bg), [theme.cta.bg]);

  // Build CSS variables object
  const cssVars = useMemo(() => ({
    // Logo
    '--logo-hero-height': `${theme.logo.heroHeight}px`,
    '--logo-nav-height': `${theme.logo.navHeight}px`,
    
    // Fonts
    '--font-lead': theme.fonts.lead,
    '--font-detail': theme.fonts.detail,
    
    // CTA Button
    '--cta-bg': theme.cta.bg,
    '--cta-text': ctaText,
    '--cta-hover': ctaHover,
    '--cta-focus': ctaFocus,
    '--cta-radius': theme.cta.radius,
    
    // Product Cards
    '--card-radius': theme.card.radius,
    '--card-shadow': getShadowValue(theme.card.shadow),
    '--card-aspect': getAspectValue(theme.card.imageAspect),
  } as React.CSSProperties), [theme, ctaText, ctaHover, ctaFocus]);

  // Load custom fonts if provided
  const fontLinks = theme.fonts.urls.map((url, i) => (
    <link key={i} rel="stylesheet" href={url} />
  ));

  return (
    <ThemeContext.Provider value={{ theme, shopId }}>
      {fontLinks.length > 0 && fontLinks}
      <div
        data-tenant={shopId}
        data-skin={theme.card.variant}
        style={cssVars}
        className="theme-root"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

/**
 * Hook to access theme context
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

/**
 * Map shadow enum to CSS value
 */
function getShadowValue(shadow: 'none' | 'sm' | 'md' | 'lg'): string {
  const shadows = {
    none: 'none',
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)'
  };
  return shadows[shadow];
}

/**
 * Map aspect ratio enum to CSS value
 */
function getAspectValue(aspect: '1:1' | '4:5' | '3:4' | '16:9'): string {
  const aspects = {
    '1:1': '1 / 1',
    '4:5': '4 / 5',
    '3:4': '3 / 4',
    '16:9': '16 / 9'
  };
  return aspects[aspect];
}

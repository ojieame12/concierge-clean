import type { Theme } from '@insite/shared-types';

/**
 * Default theme used when merchant hasn't customized
 * Clean, professional, accessible
 */
export const DEFAULT_THEME: Theme = {
  logo: {
    src: 'https://via.placeholder.com/200x72/3B82F6/FFFFFF?text=Store+Logo',
    alt: 'Store Logo',
    heroHeight: 72,
    navHeight: 24
  },
  
  fonts: {
    lead: 'Inter',
    detail: 'Inter',
    urls: []
  },
  
  cta: {
    bg: '#3B82F6', // Blue-500
    radius: '10px'
  },
  
  card: {
    variant: 'base',
    imageAspect: '4:5',
    radius: '12px',
    shadow: 'sm'
  }
};

/**
 * Example themes for different store types
 */
export const EXAMPLE_THEMES: Record<string, Theme> = {
  // Modern tech store
  tech: {
    logo: {
      src: 'https://via.placeholder.com/200x72/1E293B/FFFFFF?text=Tech+Store',
      alt: 'Tech Store',
      heroHeight: 64,
      navHeight: 24
    },
    fonts: {
      lead: 'IBM Plex Sans',
      detail: 'Inter',
      urls: []
    },
    cta: {
      bg: '#1E293B', // Slate-800
      radius: '8px'
    },
    card: {
      variant: 'minimal',
      imageAspect: '1:1',
      radius: '8px',
      shadow: 'none'
    }
  },

  // Outdoor/adventure store
  outdoor: {
    logo: {
      src: 'https://via.placeholder.com/200x72/16A34A/FFFFFF?text=Outdoor+Co',
      alt: 'Outdoor Co',
      heroHeight: 80,
      navHeight: 28
    },
    fonts: {
      lead: 'Work Sans',
      detail: 'Source Sans 3',
      urls: []
    },
    cta: {
      bg: '#16A34A', // Green-600
      radius: '12px'
    },
    card: {
      variant: 'base',
      imageAspect: '4:5',
      radius: '16px',
      shadow: 'md'
    }
  },

  // Luxury/premium store
  luxury: {
    logo: {
      src: 'https://via.placeholder.com/200x72/000000/FFFFFF?text=Luxury+Brand',
      alt: 'Luxury Brand',
      heroHeight: 48,
      navHeight: 20
    },
    fonts: {
      lead: 'Playfair Display',
      detail: 'DM Sans',
      urls: []
    },
    cta: {
      bg: '#000000', // Black
      radius: '4px'
    },
    card: {
      variant: 'merchant',
      imageAspect: '3:4',
      radius: '4px',
      shadow: 'sm'
    }
  },

  // Casual/friendly store
  casual: {
    logo: {
      src: 'https://via.placeholder.com/200x72/F59E0B/FFFFFF?text=Casual+Shop',
      alt: 'Casual Shop',
      heroHeight: 72,
      navHeight: 24
    },
    fonts: {
      lead: 'Nunito',
      detail: 'Nunito',
      urls: []
    },
    cta: {
      bg: '#F59E0B', // Amber-500
      radius: '24px'
    },
    card: {
      variant: 'base',
      imageAspect: '1:1',
      radius: '20px',
      shadow: 'lg'
    }
  }
};

/**
 * Get theme by name or return default
 */
export function getExampleTheme(name: string): Theme {
  return EXAMPLE_THEMES[name] || DEFAULT_THEME;
}

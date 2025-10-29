import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Theme-adaptive colors (will be overridden by CSS variables)
        brand: {
          primary: 'var(--theme-primary, #4a5d47)',
          secondary: 'var(--theme-secondary, #6b7b68)',
          accent: 'var(--theme-accent, #4a5d47)',
        },
        surface: {
          base: 'var(--theme-bg, #f5f5f0)',
          elevated: 'var(--theme-surface, #fafaf8)',
          overlay: 'var(--theme-overlay, #ffffff)',
        },
        content: {
          primary: 'var(--theme-text, #2d2d2d)',
          secondary: 'var(--theme-text-secondary, #6b7280)',
          tertiary: 'var(--theme-text-tertiary, #9ca3af)',
          inverse: 'var(--theme-text-inverse, #ffffff)',
        },
        border: {
          DEFAULT: 'var(--theme-border, #e5e7eb)',
          light: 'var(--theme-border-light, #f3f4f6)',
          dark: 'var(--theme-border-dark, #d1d5db)',
        },
        // Semantic colors (fixed)
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6',
      },
      fontFamily: {
        display: ['var(--font-display, Optima)', 'Palatino', 'serif'],
        body: ['var(--font-body, "Hubot Sans")', '-apple-system', 'BlinkMacSystemFont', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'Monaco', 'Consolas', 'monospace'],
      },
      fontSize: {
        'xs': ['12px', { lineHeight: '1.4' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.5' }],
        'xl': ['24px', { lineHeight: '1.4' }],
        '2xl': ['30px', { lineHeight: '1.3' }],
        '3xl': ['36px', { lineHeight: '1.2' }],
        '4xl': ['48px', { lineHeight: '1.1' }],
      },
      spacing: {
        '0.5': '2px',
        '1': '4px',
        '1.5': '6px',
        '2': '8px',
        '2.5': '10px',
        '3': '12px',
        '3.5': '14px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '7': '28px',
        '8': '32px',
        '9': '36px',
        '10': '40px',
        '11': '44px',
        '12': '48px',
        '14': '56px',
        '16': '64px',
        '20': '80px',
        '24': '96px',
        '28': '112px',
        '30': '120px',
      },
      borderRadius: {
        'sm': 'var(--radius-sm, 6px)',
        'DEFAULT': 'var(--radius-base, 8px)',
        'md': 'var(--radius-md, 12px)',
        'lg': 'var(--radius-lg, 16px)',
        'xl': 'var(--radius-xl, 24px)',
        '2xl': '32px',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 3px rgba(0, 0, 0, 0.08)',
        'DEFAULT': '0 4px 12px rgba(0, 0, 0, 0.08)',
        'md': '0 8px 24px rgba(0, 0, 0, 0.1)',
        'lg': '0 16px 48px rgba(0, 0, 0, 0.12)',
        'xl': '0 24px 64px rgba(0, 0, 0, 0.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;

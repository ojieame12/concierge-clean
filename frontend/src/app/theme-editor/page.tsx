'use client';

import React, { useState, useEffect } from 'react';
import { ThemeProvider } from '@/theme/ThemeProvider';
import { Logo } from '@/components/Logo';
import { ProductCard, ProductGrid } from '@/components/ProductCard';
import { CTAButton } from '@/components/CTAButton';
import { ThemeSchema, FONT_ALLOWLIST, type Theme } from '@insite/shared-types';
import { computeAccessibleText, checkContrast } from '@/theme/color-utils';
import { DEFAULT_THEME } from '../../core/theme/defaults';

/**
 * Theme Editor - Merchant UI for customizing theme
 * 
 * 5 simple controls:
 * 1. Logo upload (hero + nav sizes)
 * 2. Font picker (lead + detail from allowlist)
 * 3. CTA color picker (with contrast check)
 * 4. Card variant selector (base, minimal, merchant)
 * 5. Card micro-tokens (radius, shadow, aspect)
 * 
 * Live preview shows changes instantly.
 */
export default function ThemeEditorPage() {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [shopId, setShopId] = useState('demo-shop');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sample products for preview
  const sampleProducts = [
    {
      id: '1',
      title: 'Premium Running Shoes',
      price: 129.99,
      currency: 'USD',
      image_url: 'https://via.placeholder.com/400x500/3B82F6/FFFFFF?text=Product+1',
      description: 'Lightweight and comfortable for long-distance running.',
      in_stock: true,
      rating: 4.5,
      review_count: 128
    },
    {
      id: '2',
      title: 'Trail Hiking Boots',
      price: 159.99,
      currency: 'USD',
      image_url: 'https://via.placeholder.com/400x500/16A34A/FFFFFF?text=Product+2',
      description: 'Durable boots for rugged terrain.',
      in_stock: true,
      rating: 4.8,
      review_count: 89
    },
    {
      id: '3',
      title: 'Casual Sneakers',
      price: 79.99,
      currency: 'USD',
      image_url: 'https://via.placeholder.com/400x500/F59E0B/FFFFFF?text=Product+3',
      description: 'Stylish everyday sneakers.',
      in_stock: false,
      rating: 4.2,
      review_count: 56
    }
  ];

  // Load theme from API
  useEffect(() => {
    loadTheme();
  }, [shopId]);

  const loadTheme = async () => {
    try {
      const response = await fetch(`/v1/theme/${shopId}`);
      const data = await response.json();
      if (data.theme) {
        setTheme(data.theme);
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    }
  };

  // Save theme to API
  const saveTheme = async () => {
    setSaving(true);
    setError(null);

    try {
      // Validate theme
      const validation = ThemeSchema.safeParse(theme);
      if (!validation.success) {
        setError('Invalid theme: ' + validation.error.message);
        return;
      }

      // Save to API
      const response = await fetch(`/v1/theme/${shopId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(theme)
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || 'Failed to save theme');
        return;
      }

      alert('Theme saved successfully!');
    } catch (err) {
      setError('Failed to save theme: ' + (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Reset to default theme
  const resetTheme = () => {
    if (confirm('Reset to default theme? This cannot be undone.')) {
      setTheme(DEFAULT_THEME);
    }
  };

  // Update theme field
  const updateTheme = (path: string, value: any) => {
    setTheme(prev => {
      const newTheme = { ...prev };
      const keys = path.split('.');
      let current: any = newTheme;
      
      for (let i = 0; i < keys.length - 1; i++) {
        current[keys[i]] = { ...current[keys[i]] };
        current = current[keys[i]];
      }
      
      current[keys[keys.length - 1]] = value;
      return newTheme;
    });
  };

  // Check CTA contrast
  const ctaContrast = checkContrast(theme.cta.bg, computeAccessibleText(theme.cta.bg));
  const contrastOk = ctaContrast >= 4.5;

  return (
    <div className="theme-editor">
      {/* Editor Panel */}
      <aside className="editor-panel">
        <h1>Theme Editor</h1>
        
        {error && (
          <div className="error-message">{error}</div>
        )}

        {/* 1. Logo */}
        <section className="editor-section">
          <h2>Logo</h2>
          
          <label>
            Logo URL
            <input
              type="url"
              value={theme.logo.src}
              onChange={(e) => updateTheme('logo.src', e.target.value)}
              placeholder="https://example.com/logo.png"
            />
          </label>

          <label>
            Alt Text
            <input
              type="text"
              value={theme.logo.alt}
              onChange={(e) => updateTheme('logo.alt', e.target.value)}
              placeholder="Store Logo"
            />
          </label>

          <label>
            Hero Height (32-120px)
            <input
              type="range"
              min="32"
              max="120"
              value={theme.logo.heroHeight}
              onChange={(e) => updateTheme('logo.heroHeight', parseInt(e.target.value))}
            />
            <span>{theme.logo.heroHeight}px</span>
          </label>

          <label>
            Nav Height (16-48px)
            <input
              type="range"
              min="16"
              max="48"
              value={theme.logo.navHeight}
              onChange={(e) => updateTheme('logo.navHeight', parseInt(e.target.value))}
            />
            <span>{theme.logo.navHeight}px</span>
          </label>
        </section>

        {/* 2. Fonts */}
        <section className="editor-section">
          <h2>Fonts</h2>
          
          <label>
            Lead Font (headlines, prices)
            <select
              value={theme.fonts.lead}
              onChange={(e) => updateTheme('fonts.lead', e.target.value)}
            >
              {Array.from(FONT_ALLOWLIST).map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>

          <label>
            Detail Font (body, chips)
            <select
              value={theme.fonts.detail}
              onChange={(e) => updateTheme('fonts.detail', e.target.value)}
            >
              {Array.from(FONT_ALLOWLIST).map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </label>
        </section>

        {/* 3. CTA Button */}
        <section className="editor-section">
          <h2>CTA Button</h2>
          
          <label>
            Button Color
            <input
              type="color"
              value={theme.cta.bg}
              onChange={(e) => updateTheme('cta.bg', e.target.value)}
            />
            <input
              type="text"
              value={theme.cta.bg}
              onChange={(e) => updateTheme('cta.bg', e.target.value)}
              placeholder="#3B82F6"
            />
          </label>

          <div className={`contrast-check ${contrastOk ? 'ok' : 'warning'}`}>
            Contrast: {ctaContrast.toFixed(2)}:1 
            {contrastOk ? ' ✓ WCAG AA' : ' ⚠️ Below WCAG AA (4.5:1)'}
          </div>

          <label>
            Border Radius
            <input
              type="text"
              value={theme.cta.radius}
              onChange={(e) => updateTheme('cta.radius', e.target.value)}
              placeholder="10px"
            />
          </label>
        </section>

        {/* 4. Product Cards */}
        <section className="editor-section">
          <h2>Product Cards</h2>
          
          <label>
            Card Variant
            <select
              value={theme.card.variant}
              onChange={(e) => updateTheme('card.variant', e.target.value)}
            >
              <option value="base">Base (shadow + radius)</option>
              <option value="minimal">Minimal (outline)</option>
              <option value="merchant">Merchant (custom)</option>
            </select>
          </label>

          <label>
            Image Aspect Ratio
            <select
              value={theme.card.imageAspect}
              onChange={(e) => updateTheme('card.imageAspect', e.target.value)}
            >
              <option value="1:1">1:1 (Square)</option>
              <option value="4:5">4:5 (Portrait)</option>
              <option value="3:4">3:4 (Standard)</option>
              <option value="16:9">16:9 (Landscape)</option>
            </select>
          </label>

          <label>
            Card Radius
            <input
              type="text"
              value={theme.card.radius}
              onChange={(e) => updateTheme('card.radius', e.target.value)}
              placeholder="12px"
            />
          </label>

          <label>
            Card Shadow
            <select
              value={theme.card.shadow}
              onChange={(e) => updateTheme('card.shadow', e.target.value)}
            >
              <option value="none">None</option>
              <option value="sm">Small</option>
              <option value="md">Medium</option>
              <option value="lg">Large</option>
            </select>
          </label>
        </section>

        {/* Actions */}
        <div className="editor-actions">
          <button onClick={saveTheme} disabled={saving}>
            {saving ? 'Saving...' : 'Save Theme'}
          </button>
          <button onClick={resetTheme} className="secondary">
            Reset to Default
          </button>
        </div>
      </aside>

      {/* Live Preview */}
      <main className="preview-panel">
        <h2>Live Preview</h2>
        
        <ThemeProvider theme={theme} shopId={shopId}>
          <div className="preview-content">
            {/* Hero Section */}
            <header className="intro">
              <Logo 
                src={theme.logo.src} 
                alt={theme.logo.alt}
                variant="hero"
                heroHeight={theme.logo.heroHeight}
              />
              <h1 className="lead">What can I help you find?</h1>
              <CTAButton>Start Shopping</CTAButton>
            </header>

            {/* Product Grid */}
            <ProductGrid 
              products={sampleProducts}
              skin={theme.card.variant}
            />
          </div>
        </ThemeProvider>
      </main>

      <style jsx>{`
        .theme-editor {
          display: grid;
          grid-template-columns: 400px 1fr;
          height: 100vh;
        }

        .editor-panel {
          padding: 24px;
          background: #f9fafb;
          overflow-y: auto;
          border-right: 1px solid #e5e7eb;
        }

        .editor-panel h1 {
          font-size: 24px;
          margin: 0 0 24px 0;
        }

        .editor-section {
          margin: 24px 0;
          padding: 16px;
          background: white;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
        }

        .editor-section h2 {
          font-size: 18px;
          margin: 0 0 16px 0;
        }

        .editor-section label {
          display: block;
          margin: 12px 0;
          font-size: 14px;
          font-weight: 500;
        }

        .editor-section input,
        .editor-section select {
          display: block;
          width: 100%;
          margin: 4px 0;
          padding: 8px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
        }

        .contrast-check {
          padding: 8px;
          border-radius: 6px;
          font-size: 14px;
          margin: 8px 0;
        }

        .contrast-check.ok {
          background: #d1fae5;
          color: #065f46;
        }

        .contrast-check.warning {
          background: #fef3c7;
          color: #92400e;
        }

        .editor-actions {
          display: flex;
          gap: 8px;
          margin: 24px 0;
        }

        .editor-actions button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
        }

        .editor-actions button:first-child {
          background: #3B82F6;
          color: white;
        }

        .editor-actions button.secondary {
          background: #e5e7eb;
          color: #374151;
        }

        .error-message {
          padding: 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 6px;
          margin: 0 0 16px 0;
        }

        .preview-panel {
          padding: 24px;
          overflow-y: auto;
          background: white;
        }

        .preview-panel h2 {
          font-size: 20px;
          margin: 0 0 24px 0;
        }

        .preview-content {
          max-width: 1200px;
          margin: 0 auto;
        }
      `}</style>
    </div>
  );
}

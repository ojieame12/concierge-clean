'use client';

import React from 'react';

interface CTAButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

/**
 * CTAButton component - Call-to-action button with theme-aware styling
 * 
 * Merchants customize ONE color, we auto-compute:
 * - Text color (black or white for WCAG AA contrast)
 * - Hover state (darken 10%)
 * - Focus outline (lighten 40%)
 * 
 * Styling is controlled by theme CSS variables:
 * - --cta-bg
 * - --cta-text
 * - --cta-hover
 * - --cta-focus
 * - --cta-radius
 * 
 * Variants:
 * - primary: Uses theme CTA color (default)
 * - secondary: Outline style with theme color
 * - ghost: Text only with theme color
 */
export function CTAButton({ 
  children, 
  onClick,
  disabled = false,
  type = 'button',
  variant = 'primary',
  className = ''
}: CTAButtonProps) {
  const variantClass = `cta-button--${variant}`;
  
  return (
    <button
      type={type}
      className={`cta-button ${variantClass} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={variant === 'primary' ? {
        background: 'var(--cta-bg, #3B82F6)',
        color: 'var(--cta-text, #fff)',
        borderRadius: 'var(--cta-radius, 10px)'
      } : undefined}
    >
      {children}
    </button>
  );
}

/**
 * Secondary variant styles (outline)
 */
export function CTAButtonSecondary(props: Omit<CTAButtonProps, 'variant'>) {
  return (
    <button
      {...props}
      className={`cta-button cta-button--secondary ${props.className || ''}`}
      style={{
        background: 'transparent',
        color: 'var(--cta-bg, #3B82F6)',
        border: '2px solid var(--cta-bg, #3B82F6)',
        borderRadius: 'var(--cta-radius, 10px)'
      }}
    />
  );
}

/**
 * Ghost variant styles (text only)
 */
export function CTAButtonGhost(props: Omit<CTAButtonProps, 'variant'>) {
  return (
    <button
      {...props}
      className={`cta-button cta-button--ghost ${props.className || ''}`}
      style={{
        background: 'transparent',
        color: 'var(--cta-bg, #3B82F6)',
        border: 'none',
        borderRadius: 'var(--cta-radius, 10px)'
      }}
    />
  );
}

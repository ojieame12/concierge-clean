'use client';

import React from 'react';
import Image from 'next/image';

interface LogoProps {
  src: string;
  alt: string;
  variant?: 'hero' | 'nav';
  heroHeight?: number;
  navHeight?: number;
  className?: string;
}

/**
 * Logo component - Displays merchant logo with theme-aware sizing
 * 
 * Variants:
 * - hero: Large logo for page header (default 72px, range 32-120px)
 * - nav: Small logo for navigation bar (default 24px, range 16-48px)
 * 
 * Sizes are controlled by theme CSS variables:
 * - --logo-hero-height
 * - --logo-nav-height
 */
export function Logo({ 
  src, 
  alt, 
  variant = 'hero',
  heroHeight = 72,
  navHeight = 24,
  className = ''
}: LogoProps) {
  const variantClass = variant === 'hero' ? 'logo--hero' : 'logo--nav';
  const height = variant === 'hero' ? heroHeight : navHeight;
  
  // Calculate width based on common aspect ratios
  // Most logos are 2:1 to 4:1 ratio
  const estimatedWidth = height * 3;
  
  return (
    <div className={`logo ${variantClass} ${className}`}>
      <Image
        src={src}
        alt={alt}
        width={estimatedWidth}
        height={height}
        style={{
          height: variant === 'hero' 
            ? 'var(--logo-hero-height, 72px)' 
            : 'var(--logo-nav-height, 24px)',
          width: 'auto',
          objectFit: 'contain'
        }}
        priority={variant === 'hero'}
      />
    </div>
  );
}

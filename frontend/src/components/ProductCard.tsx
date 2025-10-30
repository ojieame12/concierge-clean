'use client';

import React from 'react';
import Image from 'next/image';
import type { ProductCard as ProductCardType } from '@insite/shared-types';

interface ProductCardProps {
  product: ProductCardType;
  skin?: 'base' | 'minimal' | 'merchant';
  onSelect?: (product: ProductCardType) => void;
  className?: string;
}

/**
 * ProductCard component - Displays product with theme-aware styling
 * 
 * Skins:
 * - base: Default shadow + radius (most merchants)
 * - minimal: Outline style, no shadow (modern/tech stores)
 * - merchant: Custom radius/shadow/aspect (full control)
 * 
 * Styling is controlled by theme CSS variables:
 * - --card-radius
 * - --card-shadow
 * - --card-aspect
 * 
 * DOM structure is fixed; only variables change.
 */
export function ProductCard({ 
  product, 
  skin = 'base',
  onSelect,
  className = ''
}: ProductCardProps) {
  const {
    title,
    price,
    currency = 'USD',
    image_url,
    description,
    in_stock = true,
    rating,
    review_count
  } = product;

  const formattedPrice = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(price);

  const handleClick = () => {
    if (onSelect && in_stock) {
      onSelect(product);
    }
  };

  return (
    <article 
      className={`card card--${skin} ${!in_stock ? 'card--out-of-stock' : ''} ${className}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Product Image */}
      <div className="media">
        {image_url ? (
          <Image
            src={image_url}
            alt={title}
            width={400}
            height={500}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div className="media-placeholder">
            <span>No image</span>
          </div>
        )}
        {!in_stock && (
          <div className="out-of-stock-badge">
            Out of Stock
          </div>
        )}
      </div>

      {/* Product Content */}
      <div className="content">
        <h3 className="title">{title}</h3>
        
        <div className="price">{formattedPrice}</div>
        
        {(rating || review_count) && (
          <div className="rating">
            {rating && (
              <span className="rating-stars">
                {'★'.repeat(Math.round(rating))}{'☆'.repeat(5 - Math.round(rating))}
              </span>
            )}
            {review_count && (
              <span className="rating-count">
                ({review_count} reviews)
              </span>
            )}
          </div>
        )}
        
        {description && (
          <p className="description">{description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="actions">
        <button 
          className="cta-button"
          disabled={!in_stock}
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
        >
          {in_stock ? 'View Details' : 'Notify Me'}
        </button>
      </div>
    </article>
  );
}

/**
 * ProductGrid component - Grid layout for multiple products
 */
interface ProductGridProps {
  products: ProductCardType[];
  skin?: 'base' | 'minimal' | 'merchant';
  onSelect?: (product: ProductCardType) => void;
  className?: string;
}

export function ProductGrid({ 
  products, 
  skin, 
  onSelect,
  className = ''
}: ProductGridProps) {
  return (
    <section className={`grid ${className}`}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          skin={skin}
          onSelect={onSelect}
        />
      ))}
    </section>
  );
}

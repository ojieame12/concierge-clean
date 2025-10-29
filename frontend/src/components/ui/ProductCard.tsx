/**
 * ProductCard - EXACT copy from concierge with full polish
 *
 * Maintains:
 * - Structure: aspect ratio, layout, spacing
 * - Animations: fade in, hover scale, ring selection
 * - Polish: color swatches, reviews, badges
 *
 * Adapted:
 * - Removed Next.js Image (use standard img)
 * - CSS classes → CSS variables
 */

import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import './ProductCard.css';

export interface ProductCardProps {
  title: string;
  price: number;
  currency?: string;
  image?: string;
  colors?: string[];
  reviews?: {
    rating: number;
    count: number;
  };
  badges?: string[];
  reason?: string;  // Concierge reason
  isSelected?: boolean;
  onSelect?: () => void;
}

export function ProductCard({
  title,
  price,
  currency = 'USD',
  image,
  colors = [],
  reviews,
  badges,
  reason,
  isSelected = false,
  onSelect,
}: ProductCardProps) {
  const currencySymbol = currency === 'USD' ? '$' : currency;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="product-card-real"
      onClick={onSelect}
      data-product-card
      data-selected={isSelected}
    >
      {/* Image with aspect ratio and hover effects */}
      {image && (
        <div className="product-card-real__image-container">
          <img
            src={image}
            alt={title}
            className="product-card-real__image"
            loading="lazy"
          />
        </div>
      )}

      {/* Content */}
      <div className="product-card-real__content">
        {/* Color swatches (if available) */}
        {colors && colors.length > 0 && (
          <div className="product-card-real__colors">
            {colors.slice(0, 5).map((color, i) => (
              <div
                key={i}
                className="product-card-real__color-swatch"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="product-card-real__title">
          {title}
        </h3>

        {/* Concierge reason (why this product) */}
        {reason && (
          <p className="product-card-real__reason" data-product-reason>
            {reason}
          </p>
        )}

        {/* Price with display font */}
        <p className="product-card-real__price" data-product-price>
          {currencySymbol}{price.toFixed(2)}
        </p>

        {/* Reviews with stars */}
        {reviews && (
          <div className="product-card-real__reviews">
            <div className="product-card-real__stars">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  size={14}
                  className={i < Math.floor(reviews.rating)
                    ? 'product-card-real__star--filled'
                    : 'product-card-real__star--empty'}
                  fill={i < Math.floor(reviews.rating) ? 'currentColor' : 'none'}
                />
              ))}
            </div>
            <span className="product-card-real__review-count">
              {reviews.count} reviews
            </span>
          </div>
        )}

        {/* Badges (top pick, sale, etc) */}
        {badges && badges.length > 0 && (
          <div className="product-card-real__badges">
            {badges.map((badge, i) => (
              <span key={i} className="product-card-real__badge">
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

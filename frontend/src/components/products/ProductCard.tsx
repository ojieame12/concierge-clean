import Image from 'next/image';
import { motion } from 'framer-motion';
import { Star } from 'lucide-react';

interface ProductCardProps {
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
  isSelected = false,
  onSelect,
}: ProductCardProps) {
  const currencySymbol = currency === 'USD' ? '$' : currency;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="group bg-transparent cursor-pointer"
      onClick={onSelect}
    >
      {/* Image */}
      {image && (
        <div className={`
          relative w-full max-w-[220px] mx-auto aspect-[3/4] bg-surface-elevated rounded-lg overflow-hidden mb-3
          group-hover:shadow-md transition-all duration-300
          ${isSelected
            ? 'ring-2 ring-brand-primary ring-offset-4 ring-offset-surface-base'
            : ''
          }
        `}>
          <Image
            src={image}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        </div>
      )}

      {/* Content */}
      <div className="space-y-2">
        {/* Color swatches */}
        {colors.length > 0 && (
          <div className="flex gap-1.5 mb-3">
            {colors.slice(0, 5).map((color, i) => (
              <div
                key={i}
                className="w-2.5 h-2.5 rounded-full border border-border"
                style={{ backgroundColor: color }}
                title={color}
              />
            ))}
          </div>
        )}

        {/* Title */}
        <h3 className="text-base font-normal text-content-primary mb-1 line-clamp-2 leading-snug">
          {title}
        </h3>

        {/* Price */}
        <p className="text-[28px] font-display font-light text-content-primary">
          {currencySymbol}{price.toFixed(2)}
        </p>

        {/* Reviews */}
        {reviews && (
          <div className="flex items-center gap-1 text-sm text-content-secondary">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={i < Math.floor(reviews.rating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
              />
            ))}
            <span className="ml-1">{reviews.count} reviews</span>
          </div>
        )}

        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {badges.map((badge, i) => (
              <span
                key={i}
                className="px-2 py-1 text-xs font-medium bg-brand-primary/10 text-brand-primary rounded"
              >
                {badge}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

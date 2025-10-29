'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { X, Plus, Minus } from 'lucide-react';

interface ProductDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  product: {
    id: string;
    title: string;
    price: number;
    currency?: string;
    image?: string;
    description?: string | null;
    features?: string[];
    variantId?: string | null;
    variants?: Array<{ id: string; title: string; color?: string }>;
  } | null;
  onCompare?: () => void;
  onAddToCart?: (variantId?: string | null) => void;
}

export function ProductDrawer({
  isOpen,
  onClose,
  product,
  onCompare,
  onAddToCart
}: ProductDrawerProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(product?.variantId ?? product?.variants?.[0]?.id ?? null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  useEffect(() => {
    if (!product) {
      setSelectedVariant(null);
      setSelectedSize(null);
      return;
    }
    setSelectedVariant(product.variantId ?? product.variants?.[0]?.id ?? null);
    setSelectedSize(null);
  }, [product?.id]);

  if (!product) return null;

  const currentVariantId = selectedVariant ?? product.variantId ?? product.variants?.[0]?.id ?? null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1]
            }}
            className="fixed right-0 top-0 h-full w-[480px] bg-surface-overlay shadow-2xl z-50 flex flex-col"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 flex items-center justify-center
                       text-content-tertiary hover:text-content-primary transition-colors z-10"
            >
              <X size={20} />
            </button>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Product Image */}
              {product.image && (
                <div className="relative w-full h-[320px] bg-surface-elevated">
                  <Image
                    src={product.image}
                    alt={product.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 480px"
                  />
                </div>
              )}

              {/* Content */}
              <div className="p-8 space-y-8">
                {/* Meet the product */}
                <div>
                  <h2 className="text-[28px] font-display font-light text-content-primary mb-4">
                    Meet the product
                  </h2>
                  <p className="text-[16px] font-display font-light text-content-secondary leading-relaxed">
                    {product.description || 'Classic design with premium materials.'}
                  </p>
                </div>

                {/* Accordions */}
                <div className="space-y-0 border-t border-border">
                  {/* Details Accordion */}
                  <AccordionSection
                    title="Details"
                    isExpanded={expandedSection === 'details'}
                    onToggle={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
                  >
                    <ul className="space-y-2">
                      {product.features?.map((feature, i) => (
                        <li key={i} className="text-[15px] font-light text-content-secondary">
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </AccordionSection>

                  {/* Size & Fit Accordion */}
                  <AccordionSection
                    title="Size & Fit"
                    isExpanded={expandedSection === 'size'}
                    onToggle={() => setExpandedSection(expandedSection === 'size' ? null : 'size')}
                  >
                    <p className="text-[15px] font-light text-content-secondary">
                      True to size. See size guide for detailed measurements.
                    </p>
                  </AccordionSection>

                  {/* Shipping Accordion */}
                  <AccordionSection
                    title="Shipping & Returns"
                    isExpanded={expandedSection === 'shipping'}
                    onToggle={() => setExpandedSection(expandedSection === 'shipping' ? null : 'shipping')}
                  >
                    <p className="text-[15px] font-light text-content-secondary">
                      Free shipping on orders over $150. Free returns within 30 days.
                    </p>
                  </AccordionSection>
                </div>

                {/* Color Selector (if variants) */}
                {product.variants && product.variants.length > 0 && (
                  <div>
                    <h3 className="text-[16px] font-display font-light text-content-primary mb-4">
                      Colour
                    </h3>
                    <div className="flex gap-3 mb-4">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariant(variant.id)}
                          className={`
                            w-12 h-12 rounded-full transition-all
                            ${selectedVariant === variant.id
                              ? 'ring-2 ring-brand-primary ring-offset-2'
                              : 'ring-1 ring-border'
                            }
                          `}
                          style={{ backgroundColor: variant.color }}
                          title={variant.title}
                        />
                      ))}
                    </div>
                    <p className="text-[14px] font-light text-content-tertiary">
                      Selected: {product.variants.find(v => v.id === selectedVariant)?.title}
                    </p>
                  </div>
                )}

                {/* Size Selector */}
                <div>
                  <h3 className="text-[16px] font-display font-light text-content-primary mb-4">
                    Size
                  </h3>
                  <div className="flex gap-3">
                    {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`
                          w-12 h-12 rounded-full border-2 transition-all
                          text-[14px] font-normal
                          ${selectedSize === size
                            ? 'bg-brand-primary border-brand-primary text-white'
                            : 'bg-transparent border-border text-content-primary hover:border-brand-primary'
                          }
                        `}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Bottom CTAs */}
            <div className="border-t border-border p-6 space-y-3 bg-surface-overlay">
              <button
                onClick={onCompare}
                className="w-full px-6 py-4 bg-transparent border border-border rounded-lg
                         text-[15px] font-normal text-content-primary
                         hover:border-brand-primary hover:bg-surface-elevated transition-all"
              >
                Compare
              </button>

              <button
                onClick={() => onAddToCart?.(currentVariantId)}
                disabled={!currentVariantId}
                className="w-full px-6 py-4 bg-brand-primary text-white rounded-lg
                         text-[15px] font-medium
                         hover:bg-brand-secondary transition-colors
                         disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Add to Cart
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Accordion Section Component (tentree style)
function AccordionSection({
  title,
  isExpanded,
  onToggle,
  children
}: {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between py-5 text-left
                 hover:bg-surface-elevated/30 transition-colors"
      >
        <span className="text-[18px] font-display font-light text-content-primary">
          {title}
        </span>
        {isExpanded ? (
          <Minus size={20} className="text-content-tertiary" />
        ) : (
          <Plus size={20} className="text-content-tertiary" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pb-6 px-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

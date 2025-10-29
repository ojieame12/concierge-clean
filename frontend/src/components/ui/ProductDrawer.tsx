import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus } from 'lucide-react';
import './ProductDrawer.css';

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
            className="product-drawer-backdrop"
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
            className="product-drawer"
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="product-drawer-close"
            >
              <X size={20} />
            </button>

            {/* Scrollable Content */}
            <div className="product-drawer-scroll">
              {/* Product Image */}
              {product.image && (
                <div className="product-drawer-image">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="product-drawer-image-img"
                  />
                </div>
              )}

              {/* Content */}
              <div className="product-drawer-content">
                {/* Meet the product */}
                <div>
                  <h2 className="product-drawer-heading">
                    Meet the product
                  </h2>
                  <p className="product-drawer-description">
                    {product.description || 'Classic design with premium materials.'}
                  </p>
                </div>

                {/* Accordions */}
                <div className="product-drawer-accordions">
                  {/* Details Accordion */}
                  <AccordionSection
                    title="Details"
                    isExpanded={expandedSection === 'details'}
                    onToggle={() => setExpandedSection(expandedSection === 'details' ? null : 'details')}
                  >
                    <ul className="product-drawer-features-list">
                      {product.features?.map((feature, i) => (
                        <li key={i} className="product-drawer-feature-item">
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
                    <p className="product-drawer-accordion-text">
                      True to size. See size guide for detailed measurements.
                    </p>
                  </AccordionSection>

                  {/* Shipping Accordion */}
                  <AccordionSection
                    title="Shipping & Returns"
                    isExpanded={expandedSection === 'shipping'}
                    onToggle={() => setExpandedSection(expandedSection === 'shipping' ? null : 'shipping')}
                  >
                    <p className="product-drawer-accordion-text">
                      Free shipping on orders over $150. Free returns within 30 days.
                    </p>
                  </AccordionSection>
                </div>

                {/* Color Selector (if variants) */}
                {product.variants && product.variants.length > 0 && (
                  <div>
                    <h3 className="product-drawer-selector-heading">
                      Colour
                    </h3>
                    <div className="product-drawer-color-options">
                      {product.variants.map((variant) => (
                        <button
                          key={variant.id}
                          onClick={() => setSelectedVariant(variant.id)}
                          className={`product-drawer-color-button ${
                            selectedVariant === variant.id ? 'selected' : ''
                          }`}
                          style={{ backgroundColor: variant.color }}
                          title={variant.title}
                        />
                      ))}
                    </div>
                    <p className="product-drawer-selected-text">
                      Selected: {product.variants.find(v => v.id === selectedVariant)?.title}
                    </p>
                  </div>
                )}

                {/* Size Selector */}
                <div>
                  <h3 className="product-drawer-selector-heading">
                    Size
                  </h3>
                  <div className="product-drawer-size-options">
                    {['XS', 'S', 'M', 'L', 'XL'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`product-drawer-size-button ${
                          selectedSize === size ? 'selected' : ''
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Fixed Bottom CTAs */}
            <div className="product-drawer-actions">
              <button
                onClick={onCompare}
                className="product-drawer-button-secondary"
              >
                Compare
              </button>

              <button
                onClick={() => onAddToCart?.(currentVariantId)}
                disabled={!currentVariantId}
                className="product-drawer-button-primary"
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

// Accordion Section Component
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
    <div className="accordion-section">
      <button
        onClick={onToggle}
        className="accordion-header"
      >
        <span className="accordion-title">
          {title}
        </span>
        {isExpanded ? (
          <Minus size={20} className="accordion-icon" />
        ) : (
          <Plus size={20} className="accordion-icon" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="accordion-content-wrapper"
          >
            <div className="accordion-content">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

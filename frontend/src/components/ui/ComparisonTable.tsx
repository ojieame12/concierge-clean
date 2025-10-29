import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Check, Minus, Search, Sparkles } from 'lucide-react';
import './ComparisonTable.css';

type FeatureValue = string | number | boolean | null | undefined;

interface ComparisonProduct {
  id: string;
  title: string;
  image?: string | null;
  features: Record<string, FeatureValue>;
}

interface ComparisonTableProps {
  products: ComparisonProduct[];
  recommendation?: {
    productId: string;
    reason: string;
  };
  actions?: ReactNode;
  /**
   * Fired when the user wants to inspect a product in detail (opens drawer).
   */
  onInspectProduct?: (productId: string) => void;
  /**
   * Optional listener for comparison selection changes.
   */
  onSelectionChange?: (productIds: string[]) => void;
  /**
   * Seed the initially highlighted columns. Defaults to recommendation + first item.
   */
  initialSelectedIds?: string[];
}

const buildInitialSelection = (
  products: ComparisonProduct[],
  recommendation?: { productId: string }
): string[] => {
  if (recommendation?.productId) {
    return [recommendation.productId];
  }
  return products.slice(0, 2).map((product) => product.id);
};

export function ComparisonTable({
  products,
  recommendation,
  actions,
  onInspectProduct,
  onSelectionChange,
  initialSelectedIds,
}: ComparisonTableProps) {
  const allFeatures = useMemo(
    () => Array.from(new Set(products.flatMap((product) => Object.keys(product.features)))),
    [products]
  );

  const [hoveredColumn, setHoveredColumn] = useState<string | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(() => {
    if (initialSelectedIds !== undefined) return initialSelectedIds;
    return buildInitialSelection(products, recommendation);
  });

  useEffect(() => {
    const primed = initialSelectedIds !== undefined
      ? initialSelectedIds
      : buildInitialSelection(products, recommendation);
    setSelectedColumns((prev) => {
      if (primed.length === 0) return [];
      if (primed.every((id) => prev.includes(id))) return prev;
      return primed;
    });
  }, [products, recommendation, initialSelectedIds]);

  useEffect(() => {
    onSelectionChange?.(selectedColumns);
  }, [selectedColumns, onSelectionChange]);

  const toggleColumn = (productId: string) => {
    setSelectedColumns((prev) => {
      const exists = prev.includes(productId);
      if (exists) {
        const next = prev.filter((id) => id !== productId);
        return next.length ? next : [productId];
      }

      const next = [...prev, productId];
      return next.length > 3 ? next.slice(next.length - 3) : next;
    });
  };

  const columnTemplate = useMemo(() => `180px repeat(${products.length}, minmax(0, 1fr))`, [products.length]);

  return (
    <div className="comparison-table-container">
      <div
        className="comparison-table-header"
        style={{ gridTemplateColumns: columnTemplate }}
      >
        <div />
        {products.map((product) => {
          const isSelected = selectedColumns.includes(product.id);
          const isHovered = hoveredColumn === product.id;

          return (
            <div
              key={product.id}
              onMouseEnter={() => setHoveredColumn(product.id)}
              onMouseLeave={() => setHoveredColumn(null)}
              onClick={() => toggleColumn(product.id)}
              className={`comparison-product-card ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
            >
              <div className="comparison-product-content">
                {product.image && (
                  <div className="comparison-product-image">
                    <img src={product.image} alt={product.title} className="comparison-product-img" />
                  </div>
                )}
                <h3 className="comparison-product-title">
                  {product.title}
                </h3>
                {onInspectProduct && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInspectProduct(product.id);
                    }}
                    className="comparison-inspect-button"
                  >
                    <Search size={14} /> Inspect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="comparison-table-rows">
        {allFeatures.map((feature, index) => (
          <div
            key={feature}
            className={`comparison-table-row ${index < allFeatures.length - 1 ? 'bordered' : ''}`}
            style={{ gridTemplateColumns: columnTemplate }}
          >
            <div className="comparison-feature-label">
              {feature}
            </div>

            {products.map((product) => {
              const isSelected = selectedColumns.includes(product.id);
              const isHovered = hoveredColumn === product.id;

              return (
                <div
                  key={`${product.id}-${feature}`}
                  onMouseEnter={() => setHoveredColumn(product.id)}
                  onMouseLeave={() => setHoveredColumn(null)}
                  onClick={() => toggleColumn(product.id)}
                  className={`comparison-feature-value ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
                >
                  <div className="comparison-feature-text">
                    {renderFeatureValue(product.features[feature])}
                  </div>
                </div>
              );
            })}

          </div>
        ))}
      </div>

      {recommendation && (
        <div className="comparison-recommendation">
          <div className="comparison-recommendation-content">
            <div className="comparison-recommendation-text">
              <div className="comparison-recommendation-header">
                <Sparkles size={16} className="comparison-recommendation-icon" />
                <h3 className="comparison-recommendation-title">
                  {products.find((product) => product.id === recommendation.productId)?.title || 'Recommendation'}
                </h3>
              </div>
              <p className="comparison-recommendation-reason">
                {recommendation.reason}
              </p>
            </div>
            {actions && <div className="comparison-recommendation-actions">{actions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function renderFeatureValue(value: FeatureValue) {
  if (value === undefined || value === null || value === '') {
    return <Minus size={16} className="comparison-value-empty" />;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Check size={16} className="comparison-value-check" />
    ) : (
      <Minus size={16} className="comparison-value-empty" />
    );
  }

  return <span className="comparison-value-text">{value}</span>;
}

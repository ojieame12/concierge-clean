import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { Check, Minus, Search, Sparkles } from 'lucide-react';

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
    <div className="max-w-[1000px] space-y-8">
      <div
        className="grid gap-8 pb-4 border-b border-border/30"
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
              className={`rounded-lg transition-all cursor-pointer px-3 py-3 space-y-3
                ${isSelected ? 'bg-brand-primary/5 ring-2 ring-brand-primary' : isHovered ? 'bg-surface-elevated/50' : ''}`}
            >
              <div className="flex flex-col gap-2">
                {product.image && (
                  <div className="relative w-28 h-28 mx-auto rounded-md overflow-hidden bg-surface-elevated">
                    <Image src={product.image} alt={product.title} fill className="object-cover" />
                  </div>
                )}
                <h3 className="text-[15px] font-display font-light text-content-primary text-left leading-tight">
                  {product.title}
                </h3>
                {onInspectProduct && (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onInspectProduct(product.id);
                    }}
                    className="inline-flex items-center gap-2 text-[13px] text-brand-primary hover:text-brand-secondary transition-colors"
                  >
                    <Search size={14} /> Inspect
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="space-y-0">
        {allFeatures.map((feature, index) => (
          <div
            key={feature}
            className={`grid gap-8 py-3 ${index < allFeatures.length - 1 ? 'border-b border-border/20' : ''}`}
            style={{ gridTemplateColumns: columnTemplate }}
          >
            <div className="text-[12px] font-normal text-content-tertiary uppercase tracking-[0.08em]">
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
                  className={`text-left px-3 py-1 rounded transition-all cursor-pointer
                    ${isSelected ? 'bg-brand-primary/5' : isHovered ? 'bg-surface-elevated/50' : ''}`}
                >
                  <div className="text-[16px] font-display font-light text-content-primary">
                    {renderFeatureValue(product.features[feature])}
                  </div>
                </div>
              );
            })}

          </div>
        ))}
      </div>

      {recommendation && (
        <div className="pt-6 opacity-70">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-brand-primary/80 flex-shrink-0" />
                <h3 className="text-[22px] font-display font-light text-content-primary tracking-tight">
                  {products.find((product) => product.id === recommendation.productId)?.title || 'Recommendation'}
                </h3>
              </div>
              <p className="text-[16px] font-normal text-content-secondary leading-relaxed">
                {recommendation.reason}
              </p>
            </div>
            {actions && <div className="flex-shrink-0 self-center">{actions}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function renderFeatureValue(value: FeatureValue) {
  if (value === undefined || value === null || value === '') {
    return <Minus size={16} className="inline text-content-tertiary" />;
  }

  if (typeof value === 'boolean') {
    return value ? (
      <Check size={16} className="inline text-success" />
    ) : (
      <Minus size={16} className="inline text-content-tertiary" />
    );
  }

  return <span className="text-content-primary">{value}</span>;
}

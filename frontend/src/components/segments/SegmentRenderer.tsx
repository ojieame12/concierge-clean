import type { ElementType } from 'react';
import type { Segment } from '@insite/concierge-ui/types/conversation';
import type { ProductCard as ProductCardType } from '@insite/concierge-ui/types';
import { ProductCard } from '../products/ProductCard';
import { ComparisonTable } from '../products/ComparisonTable';
import { OptionButtons } from '../conversation/OptionButtons';
import { Info, AlertCircle, Gift, Tag, ShieldAlert } from 'lucide-react';
import { motion } from 'framer-motion';

interface SegmentRendererProps {
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectProduct?: (product: ProductCardType) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  allowQuickReplies?: boolean;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCardType) => void;
}

export function SegmentRenderer({
  segments,
  onSelectOption,
  onSelectProduct,
  selectedOption = null,
  selectedOptionLabel = null,
  isActive = true,
  allowQuickReplies = true,
  comparisonMode = false,
  comparisonSelections,
  onToggleComparisonProduct,
}: SegmentRendererProps) {
  return (
    <div className="space-y-6">
      {segments.map((segment, index) => (
        <div key={index}>
          {renderSegment(segment, {
            onSelectOption,
            onSelectProduct,
            selectedOption,
            selectedOptionLabel,
            isActive,
            allowQuickReplies,
          })}
        </div>
      ))}
    </div>
  );
}

interface RenderContext {
  onSelectOption?: (value: string, label: string) => void;
  onSelectProduct?: (product: ProductCardType) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  allowQuickReplies: boolean;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCardType) => void;
}

function renderSegment(segment: Segment, ctx: RenderContext) {
  const {
    onSelectOption,
    onSelectProduct,
    selectedOption,
    selectedOptionLabel,
    isActive,
    allowQuickReplies,
    comparisonMode,
    comparisonSelections,
    onToggleComparisonProduct,
  } = ctx;

  switch (segment.type) {
    case 'narrative':
      return (
        <div className="text-[17px] font-normal text-content-primary leading-relaxed max-w-[800px]">
          {segment.text}
        </div>
      );

    case 'evidence':
      return (
        <ul className="space-y-2 text-base text-content-secondary ml-5 max-w-[700px]">
          {segment.bullets.map((bullet, i) => (
            <li key={i} className="list-disc">
              {bullet}
            </li>
          ))}
        </ul>
      );

    case 'products':
      return (
        <div>
          {segment.layout === 'cross_sell' && (
            <h3 className="text-xl font-display mb-4 text-content-primary">
              Complete your setup:
            </h3>
          )}
          {segment.layout === 'threshold_nudge' && (
            <h3 className="text-xl font-display mb-4 text-content-primary">
              Unlock free shipping:
            </h3>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {segment.items.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={product.price}
                currency={product.currency}
                image={product.image}
                badges={product.badges}
                isSelected={comparisonMode ? comparisonSelections?.includes(product.id) ?? false : undefined}
                onSelect={() => {
                  if (comparisonMode) {
                    onToggleComparisonProduct?.(product);
                  } else {
                    onSelectProduct?.(product);
                  }
                }}
              />
            ))}
          </div>
        </div>
      );

    case 'capsule':
      return (
        <div className="grid gap-4 sm:grid-cols-2">
          {segment.rows.map((row, i) => (
            <div
              key={`${row.label}-${i}`}
              className="rounded-lg border border-border/60 bg-surface-elevated/70 p-4 backdrop-blur-sm"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-content-tertiary mb-2">
                {row.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {row.values.map((value) => (
                  <span
                    key={value}
                    className="inline-flex items-center rounded-full border border-border px-3 py-1 text-sm text-content-secondary"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      );

    case 'ask':
      return (
        <h3 className="text-[28px] font-display font-light text-content-primary mb-4 tracking-tight leading-snug">
          {segment.text}
        </h3>
      );

    case 'options': {
      if (!onSelectOption) return null;

      const style = segment.style ?? 'quick_replies';
      const hide = style === 'quick_replies' && (!allowQuickReplies || !isActive);

      return (
        <OptionButtons
          options={segment.items.map((item, index) => ({ ...item, value: item.value ?? item.label, orderIndex: index }))}
          selectedValue={selectedOption}
          isActive={isActive && !hide}
          hide={hide}
          onSelect={onSelectOption}
        />
      );
    }

    case 'chips':
      return (
        <div className="flex flex-wrap gap-2">
          {segment.items.map((chip, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-brand-primary/10 text-brand-primary
                       text-sm font-medium rounded-full border border-brand-primary/20"
            >
              {chip}
            </span>
          ))}
        </div>
      );

    case 'note': {
      const icons: Record<string, ElementType> = {
        soft_fail: AlertCircle,
        relaxation: Info,
        threshold: Gift,
        warning: ShieldAlert,
        info: Info,
        policy: Tag,
      };

      const Icon = segment.variant ? icons[segment.variant] ?? Info : Info;

      const variants: Record<string, string> = {
        soft_fail: 'bg-gray-50 border-gray-200 text-gray-700',
        relaxation: 'bg-blue-50 border-blue-200 text-blue-800',
        threshold: 'bg-green-50 border-green-200 text-green-800',
        warning: 'bg-amber-50 border-amber-200 text-amber-900',
        info: 'bg-blue-50 border-blue-200 text-blue-800',
        policy: 'bg-purple-50 border-purple-200 text-purple-800',
      };

      const variantClass = segment.variant ? variants[segment.variant] ?? variants.info : variants.info;

      return (
        <div className={`flex items-start gap-3 p-4 border rounded-lg ${variantClass}`}>
          {Icon && <Icon size={20} className="mt-0.5 flex-shrink-0" />}
          <p className="text-sm leading-relaxed">{segment.text}</p>
        </div>
      );
    }

    case 'offer':
      return (
        <div className="bg-surface-elevated border-l-4 border-brand-primary p-5 rounded-r-lg">
          <div className="flex items-start gap-3">
            <Tag size={20} className="text-brand-primary mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-content-primary mb-1 uppercase tracking-wide">
                {segment.title ?? segment.style}
              </p>
              <p className="text-base text-content-secondary">{segment.text}</p>
            </div>
          </div>
        </div>
      );

    case 'comparison':
      return (
        <ComparisonTable
          products={segment.products}
          recommendation={segment.recommendation
            ? {
                productId: segment.recommendation.productId,
                reason: segment.recommendation.reason ?? 'Recommended pick',
              }
            : undefined}
        />
      );

    case 'action_suggestion':
      return (
        <div className="flex flex-wrap gap-3">
          {segment.actions.map((action, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-2 rounded-full bg-surface-elevated border border-border text-sm text-content-secondary"
            >
              {(action.label as string) ?? 'Suggested action'}
            </motion.div>
          ))}
        </div>
      );

    default:
      return null;
  }
}

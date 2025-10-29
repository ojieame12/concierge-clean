/**
 * SegmentRenderer - EXACT copy from concierge
 *
 * Renders different segment types with proper components
 */

import type { Segment, ProductCard as ProductCardType } from '../types';
import { ProductCard } from './ProductCard';
import { OptionButtons } from './OptionButtons';
import { ComparisonTable } from './ComparisonTable';
import { KnowledgeCapsule } from './KnowledgeCapsule';
import './SegmentRenderer.css';

export interface SegmentRendererProps {
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectCapsuleValue?: (label: string, value: string) => void;
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
  onSelectCapsuleValue,
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
    <div className="segment-renderer">
      {segments.map((segment, index) => (
        <div key={index} className="segment-renderer__item">
          {renderSegment(segment, {
            onSelectOption,
            onSelectCapsuleValue,
            onSelectProduct,
            selectedOption,
            selectedOptionLabel,
            isActive,
            allowQuickReplies,
            comparisonMode,
            comparisonSelections,
            onToggleComparisonProduct,
          })}
        </div>
      ))}
    </div>
  );
}

interface RenderContext {
  onSelectOption?: (value: string, label: string) => void;
  onSelectCapsuleValue?: (label: string, value: string) => void;
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
    onSelectCapsuleValue,
    onSelectProduct,
    selectedOption,
    isActive,
    allowQuickReplies,
    comparisonMode,
    comparisonSelections,
    onToggleComparisonProduct,
  } = ctx;

  switch (segment.type) {
    case 'narrative':
      return (
        <div className="segment-narrative">
          {segment.text}
        </div>
      );

    case 'evidence':
      return (
        <ul className="segment-evidence">
          {segment.bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      );

    case 'products':
      return (
        <div className="segment-products">
          {segment.layout === 'cross_sell' && (
            <h3 className="segment-products__heading">Complete your setup:</h3>
          )}
          {segment.layout === 'threshold_nudge' && (
            <h3 className="segment-products__heading">Unlock free shipping:</h3>
          )}

          {/* Grid of ProductCard components - EXACT from concierge */}
          <div className="segment-products__grid">
            {segment.items.map((product) => (
              <ProductCard
                key={product.id}
                title={product.title}
                price={product.price}
                currency={product.currency}
                image={product.image}
                badges={product.badges}
                reason={product.reason}
                isSelected={
                  comparisonMode
                    ? comparisonSelections?.includes(product.id) ?? false
                    : undefined
                }
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

    case 'ask':
      return (
        <h3 className="segment-ask">
          {segment.text}
        </h3>
      );

    case 'options': {
      if (!onSelectOption) return null;

      const style = segment.style ?? 'quick_replies';
      const hide = style === 'quick_replies' && (!allowQuickReplies || !isActive);

      return (
        <OptionButtons
          options={segment.items.map((item, index) => ({
            ...item,
            value: item.value ?? item.label,
            orderIndex: index,
          }))}
          selectedValue={selectedOption}
          isActive={isActive}
          onSelect={onSelectOption}
          hide={hide}
        />
      );
    }

    case 'comparison':
      return (
        <ComparisonTable
          products={segment.products}
          recommendation={
            segment.recommendation
              ? {
                  productId: segment.recommendation.productId,
                  reason: segment.recommendation.reason ?? 'Recommended pick',
                }
              : undefined
          }
        />
      );

    case 'chips':
      return (
        <div className="segment-chips">
          {segment.items.map((chip, i) => (
            <span key={i} className="segment-chip">
              {chip}
            </span>
          ))}
        </div>
      );

    case 'note':
      return (
        <div className={`segment-note segment-note--${segment.variant || 'info'}`}>
          <p>{segment.text}</p>
        </div>
      );

    case 'capsule':
      return (
        <KnowledgeCapsule
          rows={segment.rows}
          disabled={!isActive}
          onSelectValue={(label, value) => {
            onSelectCapsuleValue?.(label, value);
            if (onSelectOption) {
              onSelectOption(value, label);
            }
          }}
        />
      );

    case 'offer':
      return (
        <div className="segment-offer">
          <p className="segment-offer__title">{segment.title ?? segment.style}</p>
          <p className="segment-offer__text">{segment.text}</p>
        </div>
      );

    default:
      return null;
  }
}

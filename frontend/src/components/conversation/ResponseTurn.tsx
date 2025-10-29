import { motion } from 'framer-motion';
import type { Segment } from '@insite/concierge-ui/types/conversation';
import type { ProductCard as ProductCardType } from '@insite/concierge-ui/types';
import { SegmentRenderer } from '../segments/SegmentRenderer';
import { TypingText } from '../animations/TypingText';

interface ResponseTurnProps {
  mainLead?: string;
  responseDetail?: string;
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectProduct?: (product: ProductCardType) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  isFirstResponse?: boolean;  // First response = slower animations
  enableAnimations?: boolean;  // Can disable for testing
  allowQuickReplies?: boolean;
  depth?: number;
  depthOpacity?: number;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCardType) => void;
}

/**
 * ResponseTurn — Standardized response with consistent styling & animations
 *
 * Typography:
 * - Main Lead: 42px Optima Light
 * - Detail: 17px Inter Normal (types out)
 *
 * Animation:
 * - Main Lead: Horizontal blur reveal (1.2s or 0.8s)
 * - Detail: Typing effect (starts after lead)
 * - Content: Fades in after detail starts
 */
export function ResponseTurn({
  mainLead,
  responseDetail,
  segments,
  onSelectOption,
  onSelectProduct,
  selectedOption = null,
  selectedOptionLabel = null,
  isActive = true,
  isFirstResponse = false,
  enableAnimations = true,
  allowQuickReplies = true,
  depth = 0,
  depthOpacity,
  comparisonMode = false,
  comparisonSelections,
  onToggleComparisonProduct,
}: ResponseTurnProps) {
  // Animation timing
  const leadDuration = isFirstResponse ? 1.2 : 0.8;
  const leadDelay = isFirstResponse ? 0.3 : 0.1;
  const detailDelay = isFirstResponse ? 1.0 : 0.6;
  const contentDelay = isFirstResponse ? 2.0 : 1.2;

  if (!enableAnimations) {
    return (
      <div className="space-y-6" data-depth={depth} style={{ opacity: depthOpacity ?? 1 }}>
        {mainLead && (
          <div className="max-w-[720px] overflow-visible">
            <h2 className="text-[42px] font-display font-light text-content-primary leading-[1.2] tracking-tight">
              <span className="block pl-6 -ml-6">{mainLead}</span>
            </h2>
          </div>
        )}

        {responseDetail && (
          <div className="max-w-[700px]">
            <p className="text-[17px] font-normal text-content-secondary leading-relaxed">
              {responseDetail}
            </p>
          </div>
        )}

        <SegmentRenderer
          segments={segments}
          onSelectOption={onSelectOption}
          onSelectProduct={onSelectProduct}
          selectedOption={selectedOption}
          selectedOptionLabel={selectedOptionLabel}
          isActive={isActive}
          allowQuickReplies={allowQuickReplies}
        />
      </div>
    );
  }

  const leadVariants = {
    active: {
      opacity: 1,
      y: 0,
      x: 0,
      filter: 'blur(0px)',
      marginBottom: 24,
    },
    collapsed: {
      opacity: 1,
      y: 0,
      x: 0,
      filter: 'blur(0px)',
      marginBottom: 16,
    },
  };

  const detailVariants = {
    active: {
      opacity: 1,
      y: 0,
    },
    collapsed: {
      opacity: 0.85,
      y: -6,
    },
  };

  return (
    <motion.div
      layout
      data-depth={depth}
      className="space-y-6"
      initial={false}
      animate={isActive ? {
        opacity: depthOpacity ?? 1,
        scale: 1,
        y: 0,
      } : {
        opacity: depthOpacity ?? 1,
        scale: 0.985,
        y: -6,
      }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Main Lead — Horizontal blur reveal */}
      {mainLead && (
        <motion.div
          initial={{ opacity: 0.3, x: -30, filter: 'blur(12px)' }}
          animate={isActive ? 'active' : 'collapsed'}
          variants={leadVariants}
          transition={{ duration: leadDuration, delay: leadDelay, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-[720px] overflow-visible"
        >
          <h2 className={`font-display font-light text-content-primary leading-[1.2] tracking-tight transition-all duration-300 ${
            isActive ? 'text-[42px]' : 'text-[32px]'
          }`}>
            <span className="block pl-6 -ml-6">{mainLead}</span>
          </h2>
        </motion.div>
      )}

      {/* Response Detail — Typing effect */}
      {responseDetail && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={isActive ? 'active' : 'collapsed'}
          variants={detailVariants}
          transition={{ duration: 0.25, delay: detailDelay, ease: [0.22, 1, 0.36, 1] }}
          className={`max-w-[700px] text-[17px] font-normal leading-relaxed ${isActive ? 'text-content-secondary' : 'text-content-secondary/80'}`}
        >
          <TypingText text={responseDetail} speed={80} />
        </motion.div>
      )}

      {/* Content — Fades in after detail starts */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: contentDelay }}
      >
        <SegmentRenderer
          segments={segments}
          onSelectOption={onSelectOption}
          onSelectProduct={onSelectProduct}
          selectedOption={selectedOption}
          selectedOptionLabel={selectedOptionLabel}
          isActive={isActive}
          allowQuickReplies={allowQuickReplies}
          comparisonMode={comparisonMode}
          comparisonSelections={comparisonSelections}
          onToggleComparisonProduct={onToggleComparisonProduct}
        />
      </motion.div>
    </motion.div>
  );
}

/**
 * Variant: Compact (no main lead, just content)
 */
export function CompactResponseTurn({
  segments,
  onSelectOption,
  onSelectProduct,
  selectedOption,
  isActive = true,
  allowQuickReplies = true,
  comparisonMode = false,
  comparisonSelections,
  onToggleComparisonProduct,
}: Omit<ResponseTurnProps, 'mainLead' | 'responseDetail'>) {
  return (
    <SegmentRenderer
      segments={segments}
      onSelectOption={onSelectOption}
      onSelectProduct={onSelectProduct}
      selectedOption={selectedOption}
      selectedOptionLabel={null}
      isActive={isActive}
      allowQuickReplies={allowQuickReplies}
      comparisonMode={comparisonMode}
      comparisonSelections={comparisonSelections}
      onToggleComparisonProduct={onToggleComparisonProduct}
    />
  );
}

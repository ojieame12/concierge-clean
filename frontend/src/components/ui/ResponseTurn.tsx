/**
 * ResponseTurn Component
 *
 * Displays assistant responses with polished typography and animations.
 *
 * MAINTAINS (our polish):
 * - Structure: max-width, spacing, layout
 * - Sizing: 42px lead, 17px detail (exact sizes)
 * - Animations: blur reveal, typing effect, timing
 *
 * INHERITS (from store):
 * - Font families: heading font, body font
 * - Text colors: primary, secondary
 * - Background color (transparent to parent)
 */

import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Segment } from '../types/conversation';
import type { ProductCard as ProductCardType } from '../types';
import { SegmentRenderer } from './SegmentRenderer';
import { TypingText } from './TypingText';
import './ResponseTurn.css';

export interface ResponseTurnProps {
  mainLead?: string;
  responseDetail?: string;
  segments: Segment[];
  onSelectOption?: (value: string, label: string) => void;
  onSelectCapsuleValue?: (label: string, value: string) => void;
  onSelectProduct?: (product: ProductCardType) => void;
  selectedOption?: string | null;
  selectedOptionLabel?: string | null;
  isActive?: boolean;
  isFirstResponse?: boolean;
  enableAnimations?: boolean;
  allowQuickReplies?: boolean;
  depth?: number;
  depthOpacity?: number;
  comparisonMode?: boolean;
  comparisonSelections?: string[];
  onToggleComparisonProduct?: (product: ProductCardType) => void;
}

const EMPHASIS_PHRASES = [
  'free shipping',
  'free returns',
  'top pick',
  'best seller',
  'bundle',
  'upgrade',
  'limited-time',
];

const highlightDetail = (detail?: string) => {
  if (!detail) {
    return { nodes: detail, hasHighlight: false };
  }

  const lower = detail.toLowerCase();
  const matchedPhrase = EMPHASIS_PHRASES.find((phrase) => lower.includes(phrase));
  if (!matchedPhrase) {
    return { nodes: detail, hasHighlight: false };
  }

  const regex = new RegExp(`(${matchedPhrase.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'ig');
  const parts = detail.split(regex);
  const nodes: Array<string | ReactNode> = parts.map((part, index) =>
    index % 2 === 1 ? (
      <span key={`hl-${index}`} className="concierge-response-turn__detail-pill">
        {part}
      </span>
    ) : (
      part
    )
  );

  return {
    nodes,
    hasHighlight: nodes.some((node) => typeof node !== 'string'),
  };
};

/**
 * ResponseTurn — Polished assistant response with animations
 *
 * Typography:
 * - Main Lead: 42px (inherits heading font from store)
 * - Detail: 17px (inherits body font from store)
 *
 * Animation:
 * - Main Lead: Horizontal blur reveal (1.2s first, 0.8s subsequent)
 * - Detail: Typing effect
 * - Content: Fades in after detail
 */
export function ResponseTurn({
  mainLead,
  responseDetail,
  segments,
  onSelectOption,
  onSelectCapsuleValue,
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
  // Animation timing (KEEP - our polish)
  const leadDuration = isFirstResponse ? 1.2 : 0.8;
  const leadDelay = isFirstResponse ? 0.3 : 0.1;
  const detailDelay = isFirstResponse ? 1.0 : 0.6;
  const contentDelay = isFirstResponse ? 2.0 : 1.2;

  // No animations (testing mode)
  const { nodes: detailNodes, hasHighlight } = useMemo(() => highlightDetail(responseDetail), [responseDetail]);

  if (!enableAnimations) {
    return (
      <div
        className="concierge-response-turn"
        data-concierge-response
        data-depth={depth}
        style={{ opacity: depthOpacity ?? 1 }}
      >
        {mainLead && (
          <div className="concierge-response-turn__lead-wrapper">
            <h2 className="concierge-response-turn__lead">
              <span className="concierge-response-turn__lead-text">{mainLead}</span>
            </h2>
          </div>
        )}

        {responseDetail && (
          <div className="concierge-response-turn__detail-wrapper concierge-response-turn__detail-wrapper--active">
            <p className={`concierge-response-turn__detail ${hasHighlight ? 'concierge-response-turn__detail--highlighted' : ''}`}>
              {detailNodes}
            </p>
          </div>
        )}

        <SegmentRenderer
          segments={segments}
          onSelectOption={onSelectOption}
          onSelectCapsuleValue={onSelectCapsuleValue}
          onSelectProduct={onSelectProduct}
          selectedOption={selectedOption}
          selectedOptionLabel={selectedOptionLabel}
          isActive={isActive}
          allowQuickReplies={allowQuickReplies}
          comparisonMode={comparisonMode}
          comparisonSelections={comparisonSelections}
          onToggleComparisonProduct={onToggleComparisonProduct}
        />
      </div>
    );
  }

  // Animation variants (KEEP - our polish)
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
      y: -4,
    },
  };

  return (
    <motion.div
      layout
      data-concierge-response
      data-depth={depth}
      className="concierge-response-turn"
      initial={false}
      animate={
        isActive
          ? {
              opacity: depthOpacity ?? 1,
              scale: 1,
              y: 0,
            }
          : {
              opacity: depthOpacity ?? 1,
              scale: 0.985,
              y: -6,
            }
      }
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Main Lead — Horizontal blur reveal (KEEP animations) */}
      {mainLead && (
        <motion.div
          initial={{ opacity: 0.3, x: -30, filter: 'blur(12px)' }}
          animate={isActive ? 'active' : 'collapsed'}
          variants={leadVariants}
          transition={{ duration: leadDuration, delay: leadDelay, ease: [0.22, 1, 0.36, 1] }}
          className="concierge-response-turn__lead-wrapper"
        >
          <h2
            className={`concierge-response-turn__lead ${
              isActive ? 'concierge-response-turn__lead--active' : 'concierge-response-turn__lead--collapsed'
            }`}
          >
            <span className="concierge-response-turn__lead-text">{mainLead}</span>
          </h2>
        </motion.div>
      )}

      {/* Response Detail — Typing effect (KEEP animations) */}
      {responseDetail && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={isActive ? 'active' : 'collapsed'}
          variants={detailVariants}
          transition={{ duration: 0.25, delay: detailDelay, ease: [0.22, 1, 0.36, 1] }}
          className={`concierge-response-turn__detail-wrapper ${
            isActive ? 'concierge-response-turn__detail-wrapper--active' : 'concierge-response-turn__detail-wrapper--collapsed'
          }`}
        >
          {hasHighlight ? (
            <p className="concierge-response-turn__detail concierge-response-turn__detail--highlighted">
              {detailNodes}
            </p>
          ) : (
            <p className="concierge-response-turn__detail">
              <TypingText text={typeof detailNodes === 'string' ? detailNodes : responseDetail} speed={80} />
            </p>
          )}
        </motion.div>
      )}

      {/* Content — Fades in after detail (KEEP animations) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: contentDelay }}
        className="concierge-response-turn__content"
      >
        <SegmentRenderer
          segments={segments}
          onSelectOption={onSelectOption}
          onSelectCapsuleValue={onSelectCapsuleValue}
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
 * Compact variant (no lead/detail, just segments)
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
    <div className="concierge-response-turn concierge-response-turn--compact">
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
    </div>
  );
}

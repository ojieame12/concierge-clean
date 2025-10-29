/**
 * OptionButtons - EXACT copy from concierge
 *
 * Quick reply buttons with:
 * - Lettered labels (A, B, C...)
 * - Selection state with collapse animation
 * - "Working..." indicator
 */

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import './OptionButtons.css';

export interface Option {
  id: string;
  label: string;
  value: string;
  orderIndex?: number;
}

export interface OptionButtonsProps {
  options: Option[];
  selectedValue?: string | null;
  isActive?: boolean;
  onSelect: (value: string, label: string) => void;
  hide?: boolean;
}

export function OptionButtons({
  options,
  selectedValue = null,
  isActive = true,
  onSelect,
  hide = false,
}: OptionButtonsProps) {
  const [pendingSelection, setPendingSelection] = useState<string | null>(null);

  useEffect(() => {
    if (selectedValue == null) {
      setPendingSelection(null);
    } else {
      setPendingSelection(selectedValue);
    }
  }, [selectedValue]);

  const displaySelection = selectedValue ?? pendingSelection;
  const hasSelection = !!displaySelection;

  const handleSelect = (option: Option) => {
    if (hasSelection || !isActive) return;
    const value = option.value;
    setPendingSelection(value);
    onSelect(value, option.label);
  };

  const normalized = options.map((option, index) => ({
    ...option,
    orderIndex: option.orderIndex ?? index,
  }));

  const selectedOptionObj =
    normalized.find((option) => option.value === displaySelection) ?? null;

  const orderedOptions = selectedOptionObj
    ? [
        selectedOptionObj,
        ...normalized.filter((option) => option.value !== selectedOptionObj.value),
      ]
    : normalized;

  return (
    <motion.div
      animate={{ opacity: hide ? 0 : 1, height: hide ? 0 : 'auto' }}
      transition={{ duration: 0.2 }}
      className="option-buttons-container"
      style={{ minHeight: hasSelection ? 120 : undefined }}
    >
      <div className="option-buttons-grid">
        <AnimatePresence initial={false}>
          {orderedOptions.map((option, index) => {
            const value = option.value;
            const isSelected = value === displaySelection;
            const showWorking =
              isSelected && isActive && value !== '__something_else';

            return (
              <motion.div
                key={option.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={
                  isSelected
                    ? { opacity: 1, y: 0, scale: 1 }
                    : hasSelection
                    ? {
                        opacity: 0,
                        y: -10,
                        scale: 0.9,
                        height: 0,
                        marginBottom: 0,
                      }
                    : { opacity: 1, y: 0, scale: 1 }
                }
                exit={{
                  opacity: 0,
                  y: -12,
                  scale: 0.9,
                  height: 0,
                  marginBottom: 0,
                }}
                transition={{
                  duration: 0.28,
                  ease: [0.16, 1, 0.3, 1],
                  delay: index * 0.03,
                }}
                className="option-button-motion"
              >
                <button
                  type="button"
                  disabled={hasSelection && !isSelected}
                  onClick={() => handleSelect(option)}
                  className={`option-button ${
                    isSelected ? 'option-button--selected' : ''
                  }`}
                >
                  <span className={`option-button__letter ${
                    isSelected ? 'option-button__letter--selected' : ''
                  }`}>
                    {String.fromCharCode(65 + option.orderIndex)}
                  </span>

                  <span className="option-button__label">{option.label}</span>

                  {showWorking && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="option-button__working"
                    >
                      <span className="option-button__working-pulse">
                        <span className="option-button__working-pulse-ring" />
                        <span className="option-button__working-pulse-dot" />
                      </span>
                      <span>Working…</span>
                    </motion.span>
                  )}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

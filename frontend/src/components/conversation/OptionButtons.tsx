import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

interface Option {
  id: string;
  label: string;
  value: string;
  orderIndex?: number;
}

interface OptionButtonsProps {
  options: Option[];
  selectedValue?: string | null;
  isActive?: boolean;
  onSelect: (value: string, label: string) => void;
}

export function OptionButtons({
  options,
  selectedValue = null,
  isActive = true,
  onSelect,
  hide = false  // New prop to fade out after selection
}: OptionButtonsProps & { hide?: boolean }) {
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

  const normalized = options.map((option, index) => ({ ...option, orderIndex: option.orderIndex ?? index }));
  const selectedOptionObj = normalized.find((option) => option.value === displaySelection) ?? null;
  const orderedOptions = selectedOptionObj
    ? [selectedOptionObj, ...normalized.filter((option) => option.value !== selectedOptionObj.value)]
    : normalized;

  return (
    <motion.div
      animate={{ opacity: hide ? 0 : 1, height: hide ? 0 : 'auto' }}
      transition={{ duration: 0.2 }}
      className="overflow-visible"
      style={{ minHeight: hasSelection ? 120 : undefined }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[1000px] overflow-visible">
        <AnimatePresence initial={false}>
          {orderedOptions.map((option, index) => {
            const value = option.value;
            const isSelected = value === displaySelection;

            const showWorking = isSelected && isActive && value !== '__something_else';

            return (
              <motion.div
                key={option.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={isSelected
                  ? { opacity: 1, y: 0, scale: 1 }
                  : hasSelection
                    ? { opacity: 0, y: -10, scale: 0.9, height: 0, marginBottom: 0 }
                    : { opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.9, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1], delay: index * 0.03 }}
                className="overflow-hidden"
              >
                <button
                  type="button"
                  disabled={hasSelection && !isSelected}
                  onClick={() => handleSelect(option)}
                  className={`
                    group relative w-full px-5 py-3
                    border rounded-lg
                    text-[17px] font-normal
                    transition-all duration-200
                    flex items-center

                    ${isSelected
                      ? 'bg-[#4a5d47] border-[#4a5d47] text-white shadow-[0_10px_30px_rgba(74,93,71,0.35)]'
                      : 'bg-surface-elevated border-border text-content-primary hover:bg-white hover:border-brand-primary hover:shadow-sm'}
                  `}
                >
                  <span className={`
                    inline-flex items-center justify-center
                    w-6 h-6 mr-3 text-xs font-normal
                    rounded-full
                    transition-all duration-200
                    flex-shrink-0

                    ${isSelected
                      ? 'bg-white text-[#4a5d47] border-0'
                      : 'bg-white border border-border-light text-content-tertiary group-hover:bg-brand-primary group-hover:text-white group-hover:border-brand-primary'}
                  `}>
                    {String.fromCharCode(65 + option.orderIndex)}
                  </span>

                  <span className="flex-1 text-left leading-snug text-base option-label">{option.label}</span>

                  {showWorking && (
                    <motion.span
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-center gap-2 text-sm text-white/90"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white/80 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
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

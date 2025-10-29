import { motion } from 'framer-motion';

interface QuestionBlockProps {
  question: string;
  helperText?: string;
  options: Array<{
    id: string;
    label: string;
    value: string;
  }>;
  onSelect: (value: string) => void;
}

export function QuestionBlock({ question, helperText, options, onSelect }: QuestionBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[800px] mx-auto"
    >
      {/* Question */}
      <h2 className="text-3xl font-display text-content-primary mb-6 text-balance">
        {question}
      </h2>

      {/* Helper text */}
      {helperText && (
        <p className="text-base text-content-secondary mb-6 max-w-[600px]">
          {helperText}
        </p>
      )}

      {/* Options grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
        {options.map((option, index) => (
          <motion.button
            key={option.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.3 }}
            onClick={() => onSelect(option.value)}
            className="group relative min-h-[48px] px-5 py-3
                     bg-surface-elevated border border-border rounded-md
                     text-sm font-body font-medium text-content-primary text-left
                     hover:bg-surface-overlay hover:border-brand-primary hover:-translate-y-0.5
                     hover:shadow-md active:scale-[0.98]
                     transition-all duration-200 ease-out"
          >
            {/* Letter label */}
            <span className="inline-block w-6 h-6 mr-2 text-xs font-semibold
                           bg-border-light rounded text-content-tertiary
                           group-hover:bg-brand-primary group-hover:text-white
                           transition-colors duration-200
                           flex items-center justify-center">
              {String.fromCharCode(65 + index)}
            </span>
            {option.label}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Filter {
  id: string;
  label: string;
  value: string;
}

interface FilterPillsProps {
  filters: Filter[];
  onRemove: (id: string) => void;
}

export function FilterPills({ filters, onRemove }: FilterPillsProps) {
  if (filters.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      <AnimatePresence mode="popLayout">
        {filters.map((filter) => (
          <motion.div
            key={filter.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            className="group flex items-center gap-2 h-8 px-3
                     bg-border-light border border-border rounded-md
                     text-sm text-content-secondary
                     hover:bg-surface-elevated hover:border-brand-primary
                     transition-all duration-200"
          >
            <span className="text-xs font-medium text-content-tertiary">S</span>
            <span>{filter.label}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(filter.id);
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove ${filter.label} filter`}
            >
              <X size={14} className="text-content-tertiary hover:text-content-primary" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

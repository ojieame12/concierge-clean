'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface SomethingElseInputProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function SomethingElseInput({
  prompt = "Give me your suggestion",
  placeholder = "",
  onSubmit,
  onCancel,
  autoFocus = true
}: SomethingElseInputProps) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      onSubmit(value.trim());
      setValue('');
    }
    if (e.key === 'Escape' && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-[700px] space-y-4"
    >
      {/* Prompt */}
      <h3 className="text-[24px] font-display font-light text-content-secondary tracking-tight">
        {prompt}
      </h3>

      {/* Input Field - Minimal bottom border only */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full py-3 px-0
                   bg-transparent
                   border-0 border-b-2 border-border
                   text-[17px] font-normal text-content-primary
                   placeholder:text-content-tertiary placeholder:font-light
                   focus:outline-none focus:border-brand-primary
                   transition-colors duration-200"
        />

        {/* Helper Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-2 text-[13px] font-light text-content-tertiary"
        >
          Press Enter to continue{onCancel && ' · Esc to go back'}
        </motion.p>
      </div>
    </motion.div>
  );
}

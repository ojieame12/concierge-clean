/**
 * SomethingElseInput - EXACT copy from concierge
 *
 * Minimal text input with bottom border only (manual clarifier)
 * Used when user wants to provide custom input instead of selecting options
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import './SomethingElseInput.css';

export interface SomethingElseInputProps {
  prompt?: string;
  placeholder?: string;
  onSubmit: (value: string) => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function SomethingElseInput({
  prompt = 'Give me your suggestion',
  placeholder = '',
  onSubmit,
  onCancel,
  autoFocus = true,
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
      className="something-else-input"
    >
      {/* Prompt */}
      <h3 className="something-else-input__prompt">{prompt}</h3>

      {/* Input Field - Minimal bottom border only */}
      <div className="something-else-input__field">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="something-else-input__input"
        />

        {/* Helper Text */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="something-else-input__helper"
        >
          Press Enter to continue{onCancel && ' · Esc to go back'}
        </motion.p>
      </div>
    </motion.div>
  );
}

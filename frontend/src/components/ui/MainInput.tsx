/**
 * MainInput - EXACT copy from concierge
 *
 * The main search input with two states:
 * - Full: Large rounded box with 4 rows (hero state)
 * - Compact: Small pill with 1 row (sticky bottom state)
 */

'use client';

import { useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import './MainInput.css';

export interface MainInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  isCompact?: boolean;
}

export function MainInput({
  value,
  onChange,
  onSend,
  placeholder = 'What are you looking for?',
  disabled = false,
  autoFocus = false,
  isCompact = false,
}: MainInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={`main-input-wrapper ${isCompact ? 'main-input-wrapper--compact' : ''}`}>
      <div className="main-input-container">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={isCompact ? 1 : 4}
          className="main-input-textarea"
          data-concierge-input
        />

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className={`main-input-send-button ${
            isCompact ? 'main-input-send-button--compact' : ''
          }`}
          aria-label="Send message"
        >
          <ArrowUp size={isCompact ? 18 : 22} />
        </button>
      </div>
    </div>
  );
}

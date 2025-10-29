'use client';

import { useRef } from 'react';
import { ArrowUp } from 'lucide-react';

interface MainInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  isCompact?: boolean;  // For mini state
}

export function MainInput({
  value,
  onChange,
  onSend,
  placeholder = 'What are you looking for today?',
  disabled = false,
  autoFocus = false,
  isCompact = false
}: MainInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && value.trim()) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className={`w-full transition-all duration-500 ${isCompact ? 'mb-4' : 'mb-8'}`}>
      {/* Wrapper for styling */}
      <div className={`
        relative bg-surface-overlay border-2 border-border pr-20
        shadow-[0_12px_48px_-8px_rgba(0,0,0,0.12)]
        focus-within:border-brand-primary focus-within:shadow-[0_16px_64px_-8px_rgba(0,0,0,0.16)]
        transition-all duration-500
        ${isCompact
          ? 'rounded-full p-4 py-3'
          : 'rounded-[20px] p-6'
        }
      `}>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          rows={isCompact ? 1 : 4}
          className="w-full resize-none
                   bg-transparent border-0
                   text-[18px] font-light text-content-primary
                   placeholder:text-content-tertiary placeholder:font-light
                   focus:outline-none focus:ring-0
                   disabled:opacity-50 disabled:cursor-not-allowed
                   leading-relaxed
                   transition-all duration-500"
        />

        {/* Send Button - Animates position and size */}
        <button
          onClick={onSend}
          disabled={!value.trim() || disabled}
          className={`
            absolute flex items-center justify-center
            bg-brand-primary hover:bg-brand-secondary
            text-white
            transition-all duration-500 shadow-md
            disabled:opacity-40 disabled:cursor-not-allowed
            ${isCompact
              ? 'top-1/2 -translate-y-1/2 right-3 w-10 h-10 rounded-full'
              : 'bottom-4 right-4 w-14 h-14 rounded-[12px]'
            }
          `}
        >
          <ArrowUp size={isCompact ? 18 : 22} />
        </button>
      </div>
    </div>
  );
}

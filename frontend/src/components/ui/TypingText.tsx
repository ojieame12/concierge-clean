/**
 * TypingText Animation Component
 *
 * MAINTAINS (our polish):
 * - Animation timing and effect
 * - Cursor blink animation
 *
 * INHERITS (from store):
 * - Cursor color from --concierge-text
 */

'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import './TypingText.css';

interface TypingTextProps {
  text: string;
  speed?: number; // characters per second
  className?: string;
  onComplete?: () => void;
}

export function TypingText({ text, speed = 40, className = '', onComplete }: TypingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayedText('');
    setIsComplete(false);

    const totalChars = text.length;
    const delayPerChar = 1000 / speed;
    let currentIndex = 0;

    const interval = setInterval(() => {
      if (currentIndex < totalChars) {
        setDisplayedText(text.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, delayPerChar);

    return () => clearInterval(interval);
  }, [text, speed, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          className="concierge-typing-cursor"
        />
      )}
    </span>
  );
}

/**
 * Instant reveal variant (for skipping animation)
 */
export function InstantText({ text, className }: { text: string; className?: string }) {
  return <span className={className}>{text}</span>;
}

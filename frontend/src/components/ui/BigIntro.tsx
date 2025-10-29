/**
 * BigIntro - EXACT copy from concierge
 *
 * Hero section with staggered animation sequence
 */

'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { TypingText } from './TypingText';
import './BigIntro.css';

export interface BigIntroProps {
  greeting?: string;
  userName?: string;
  description?: string;
  logoSrc?: string;
  samplePrompts?: Array<{ id: string; text: string }>;
  onPromptClick?: (text: string) => void;
  children?: React.ReactNode;
}

export function BigIntro({
  greeting = 'Welcome',
  userName,
  description = "Tell me what you're shopping for—budget, style, brand, or occasion—and I'll curate the perfect shortlist for you.",
  logoSrc = '/logo-icon.svg',
  samplePrompts = [
    { id: '1', text: 'Show me popular picks' },
    { id: '2', text: "What’s new this week?" },
    { id: '3', text: 'Help me compare a couple of options' },
  ],
  onPromptClick,
  children,
}: BigIntroProps) {
  const heading = userName ? `${greeting} ${userName}!` : `${greeting}!`;
  return (
    <div className="big-intro-container">
      {/* Logo Icon */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="big-intro-logo"
      >
        <img src={logoSrc} alt="Logo" className="big-intro-logo-img" />
      </motion.div>

      {/* Greeting - Horizontal blur reveal (EXACT timing) */}
      <motion.h1
        initial={{ opacity: 0.3, x: -30, filter: 'blur(12px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="big-intro-greeting"
      >
        {heading}
      </motion.h1>

      {/* Description - Types after greeting (EXACT delay) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 1.0 }}
        className="big-intro-description"
      >
        <TypingText text={description} speed={80} />
      </motion.div>

      {/* Main Input - Fades in (EXACT delay) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.5 }}
      >
        {children}
      </motion.div>

      {/* Sample Prompts - Appear after input (EXACT delay + stagger) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 3.0 }}
        className="big-intro-prompts-section"
      >
        <p className="big-intro-prompts-label">GET STARTED</p>

        <div className="big-intro-prompts-grid">
          {samplePrompts.map((prompt, index) => (
            <motion.button
              key={prompt.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 3.2 + index * 0.1 }}
              onClick={() => onPromptClick?.(prompt.text)}
              className="big-intro-prompt-card"
            >
              <div className="big-intro-prompt-icon">
                <Sparkles size={14} fill="currentColor" />
              </div>
              <div className="big-intro-prompt-text">{prompt.text}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { TypingText } from '../animations/TypingText';

interface BigIntroProps {
  greeting?: string;
  userName?: string;
  description?: string;
  icon?: string;
  samplePrompts?: Array<{ id: string; text: string }>;
  onPromptClick?: (text: string) => void;
  children?: React.ReactNode;
}

export function BigIntro({
  greeting = 'Welcome',
  userName,
  description = "Tell me what you're shopping for—budget, style, brand, or occasion—and I'll curate the perfect shortlist for you.",
  icon = '10↑',
  samplePrompts = [
    { id: '1', text: 'Show me popular picks' },
    { id: '2', text: "What’s new this week?" },
    { id: '3', text: 'Help me compare a couple of options' },
  ],
  onPromptClick,
  children
}: BigIntroProps) {
  const heading = userName ? `${greeting} ${userName}!` : `${greeting}!`;

  return (
    <div className="min-h-[calc(100vh-140px)] flex flex-col justify-center px-6 max-w-[1000px] mx-auto">
      {/* Logo Icon - Left */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="mb-4"
      >
        <Image
          src="/logo-icon.svg"
          alt="Insite"
          width={48}
          height={48}
          className="w-12 h-12"
        />
      </motion.div>

      {/* Greeting - Horizontal blur reveal (smooth, premium) */}
      <motion.h1
        initial={{ opacity: 0.3, x: -30, filter: 'blur(12px)' }}
        animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="text-[52px] font-display font-light text-content-primary mb-3 tracking-tight leading-tight"
        onAnimationComplete={() => {}}
      >
        {heading}
      </motion.h1>

      {/* Description - Types after greeting */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, delay: 1.0 }}
        className="text-[18px] font-normal text-content-secondary max-w-[800px] leading-relaxed mb-6"
      >
        <TypingText
          text={description}
          speed={80}
        />
      </motion.div>

      {/* Main Input - Fades in */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 2.5 }}
      >
        {children}
      </motion.div>

      {/* Sample Prompts - Appear after input */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 3.0 }}
        className="mt-6"
      >
        <p className="text-[11px] uppercase tracking-[0.14em] text-content-tertiary/70 mb-4 font-normal">
          GET STARTED
        </p>

        <div className="grid grid-cols-3 gap-4">
          {samplePrompts.map((prompt, index) => (
            <motion.button
              key={prompt.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 3.2 + (index * 0.1) }}
              onClick={() => onPromptClick?.(prompt.text)}
              className="group prompt-card backdrop-blur-md rounded-lg p-5
                       hover:-translate-y-1
                       hover:shadow-xl transition-all duration-300 min-h-[100px]
                       flex flex-col"
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-brand-primary group-hover:text-brand-primary transition-colors" fill="currentColor" />
              </div>
              <div className="text-[14px] font-normal text-content-primary leading-snug text-left mt-auto">
                {prompt.text}
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

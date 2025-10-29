'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface MiniIntroProps {
  greeting?: string;
  userName?: string;
  description?: string;
  icon?: string;
}

export function MiniIntro({
  greeting = "Good Morning",
  userName = "Priya",
  description = "Hi there! I'm your personal shopping concierge. Describe what you're looking for.",
  icon = "10↑"
}: MiniIntroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center px-6 py-6 text-center"
    >
      {/* Compact Header - Logo + Greeting - Centered */}
      <div className="flex items-center gap-3 mb-2">
        <Image
          src="/logo-icon.svg"
          alt="Insite"
          width={32}
          height={32}
          className="w-8 h-8"
        />
        <h1 className="text-[32px] font-display font-light text-content-primary tracking-tight">
          {greeting} {userName}!
        </h1>
      </div>

      {/* Shorter Description - Centered */}
      <p className="text-[16px] font-normal text-content-secondary max-w-[700px] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

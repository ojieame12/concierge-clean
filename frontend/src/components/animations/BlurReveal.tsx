'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface BlurRevealProps {
  children: ReactNode;
  delay?: number;
  duration?: number;
  blur?: number;
}

/**
 * Blur-to-Focus Reveal (Premium)
 * Elements start blurred and come into focus
 */
export function BlurReveal({
  children,
  delay = 0,
  duration = 0.8,
  blur = 10
}: BlurRevealProps) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        filter: `blur(${blur}px)`,
        y: 20
      }}
      animate={{
        opacity: 1,
        filter: 'blur(0px)',
        y: 0
      }}
      transition={{
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1]  // Ease-out-expo (luxurious)
      }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggered Grid Reveal
 * For product grids - each item reveals with delay
 */
export function StaggeredBlurReveal({
  children,
  staggerDelay = 0.15,
  startDelay = 0
}: {
  children: ReactNode[];
  staggerDelay?: number;
  startDelay?: number;
}) {
  return (
    <>
      {children.map((child, index) => (
        <BlurReveal
          key={index}
          delay={startDelay + (index * staggerDelay)}
          duration={0.8}
          blur={8}
        >
          {child}
        </BlurReveal>
      ))}
    </>
  );
}

/**
 * Magnetic Button Hover
 * Button subtly follows cursor
 */
export function MagneticButton({
  children,
  onClick,
  className = ''
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      onClick={onClick}
      className={className}
      whileHover={{
        scale: 1.02,
        transition: { duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }
      }}
      whileTap={{
        scale: 0.98,
        transition: { duration: 0.1 }
      }}
    >
      {children}
    </motion.button>
  );
}

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

interface CTAButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: ReactNode;
  disabled?: boolean;
}

export function CTAButton({
  children,
  onClick,
  variant = 'primary',
  icon,
  disabled = false
}: CTAButtonProps) {
  const styles = {
    primary: 'bg-brand-primary text-white hover:bg-brand-secondary shadow-md',
    secondary: 'bg-surface-elevated border border-border text-content-primary hover:border-brand-primary hover:bg-white',
    ghost: 'bg-transparent text-brand-primary hover:bg-brand-primary/5'
  };

  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className={`
        px-6 py-4 rounded-lg
        text-[15px] font-medium
        transition-all duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        flex items-center justify-center gap-2
        ${styles[variant]}
      `}
    >
      {icon}
      {children}
    </motion.button>
  );
}

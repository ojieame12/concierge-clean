'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from localStorage
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const preferred = saved || 'light';
    setTheme(preferred);
    document.documentElement.setAttribute('data-theme', preferred);
  }, []);

  const toggle = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="w-14 h-7 rounded-full bg-surface-elevated border border-border" />
    );
  }

  return (
    <button
      onClick={toggle}
      className="relative w-14 h-7 rounded-full bg-surface-elevated/80 backdrop-blur-sm border border-border transition-colors hover:bg-surface-overlay"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      <motion.div
        animate={{
          x: theme === 'dark' ? 28 : 2,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-5 h-5 bg-brand-primary rounded-full flex items-center justify-center shadow-sm"
      >
        {theme === 'light' ? (
          <Sun size={12} className="text-white" />
        ) : (
          <Moon size={12} className="text-white" />
        )}
      </motion.div>
    </button>
  );
}

'use client';

import { motion } from 'framer-motion';
import { User } from 'lucide-react';

interface UserMessageProps {
  message: string;
  timestamp?: Date;
  userName?: string;
  userInitial?: string;
  isLatest?: boolean;
  depth?: number;
  depthOpacity?: number;
}

export function UserMessage({
  message,
  timestamp,
  userName,
  userInitial,
  isLatest = true,
  depth = 0,
  depthOpacity,
}: UserMessageProps) {
  const fallbackOpacity = depth <= 0 ? 1 : depth === 1 ? 0.7 : depth === 2 ? 0.6 : 0.5;
  const appliedOpacity = depthOpacity ?? fallbackOpacity;
  const borderClass = depth <= 0
    ? 'border-[#2c3e50]'
    : depth === 1
      ? 'border-[#2c3e50]/50'
      : 'border-[#2c3e50]/25';
  const borderTone = isLatest ? 'border-[#2c3e50]' : borderClass;
  const textTone = depth <= 0 ? 'text-content-primary' : 'text-content-secondary/80';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: appliedOpacity, y: 0, scale: depth <= 0 ? 1 : 0.985 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="flex justify-end mb-8"
    >
      <div className="max-w-[700px] flex flex-col items-end">
        {/* Timestamp ABOVE bubble */}
        {timestamp && (
          <p className="text-[12px] font-light text-content-tertiary mb-2">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Message Bubble with Avatar Inside */}
        <div className={`bg-transparent border rounded-[20px] rounded-tr-none px-4 py-3 inline-flex items-center gap-4 transition-colors duration-500 ${borderTone}`}>
          {/* Avatar Circle */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-elevated border border-border
                        flex items-center justify-center">
            {userInitial || userName ? (
              <span className="text-[13px] font-medium text-content-primary">
                {userInitial || userName?.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User size={16} className="text-content-tertiary" />
            )}
          </div>

          {/* Message Text */}
          <p className={`text-[17px] font-normal leading-[1.8] ${textTone}`}>
            {message}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

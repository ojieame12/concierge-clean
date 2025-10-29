import { motion } from 'framer-motion';
import { User } from 'lucide-react';
import './UserMessage.css';

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
    ? 'user-message-border-default'
    : depth === 1
      ? 'user-message-border-depth-1'
      : 'user-message-border-depth-2';
  const borderTone = isLatest ? 'user-message-border-default' : borderClass;
  const textTone = depth <= 0 ? 'user-message-text-primary' : 'user-message-text-secondary';
  const scale = depth <= 0 ? 1 : 0.985;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.94 }}
      animate={{ opacity: appliedOpacity, y: 0, scale }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      className="user-message-container"
    >
      <div className="user-message-wrapper">
        {/* Timestamp ABOVE bubble */}
        {timestamp && (
          <p className="user-message-timestamp">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}

        {/* Message Bubble with Avatar Inside */}
        <div className={`user-message-bubble ${borderTone}`}>
          {/* Avatar Circle */}
          <div className="user-message-avatar">
            {userInitial || userName ? (
              <span className="user-message-avatar-text">
                {userInitial || userName?.charAt(0).toUpperCase()}
              </span>
            ) : (
              <User size={16} className="user-message-avatar-icon" />
            )}
          </div>

          {/* Message Text */}
          <p className={`user-message-text ${textTone}`}>
            {message}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

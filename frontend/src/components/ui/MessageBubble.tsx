/**
 * MessageBubble - Generic chat bubble (user or assistant)
 *
 * Used for simple back-and-forth chat UI
 */

import { motion } from 'framer-motion';
import './MessageBubble.css';

export interface MessageBubbleProps {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
}

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`message-bubble-wrapper ${
        isUser ? 'message-bubble-wrapper--user' : 'message-bubble-wrapper--assistant'
      }`}
    >
      <div
        className={`message-bubble ${
          isUser ? 'message-bubble--user' : 'message-bubble--assistant'
        }`}
      >
        <p className="message-bubble__content">{content}</p>
        {timestamp && (
          <p className="message-bubble__timestamp">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </motion.div>
  );
}

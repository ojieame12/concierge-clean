import { motion } from 'framer-motion';

interface MessageBubbleProps {
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
      className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`max-w-[80%] px-5 py-3 rounded-2xl ${
          isUser
            ? 'bg-brand-primary text-content-inverse rounded-br-sm'
            : 'bg-surface-overlay border border-border text-content-primary rounded-bl-sm'
        }`}
      >
        <p className="text-base leading-relaxed whitespace-pre-wrap">
          {content}
        </p>
        {timestamp && (
          <p className="text-xs mt-2 opacity-60">
            {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
    </motion.div>
  );
}

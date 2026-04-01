import type { Message } from '../types/interview';
import { User, LockKeyhole } from 'lucide-react';
import { motion } from 'framer-motion';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-start gap-3 w-full max-w-[800px] mb-6 ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
    >
      <div className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 shadow-sm ${
        isUser 
          ? 'bg-gradient-to-tr from-orange-400 to-orange-500 text-white' 
          : 'bg-[var(--c-surface-3)] text-[var(--c-text)] border border-[var(--c-border)]'
      }`}>
        {isUser ? <User size={16} strokeWidth={2.5} /> : <LockKeyhole size={16} strokeWidth={2.5} />}
      </div>
      
      <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <span className="text-[12px] font-bold text-[var(--c-text-dim)] mb-1 px-1">
          {isUser ? 'You' : 'Interviewer'}
        </span>
        <div className={`relative px-4 py-3 leading-relaxed text-[15px] shadow-sm rounded-2xl ${
          isUser 
            ? 'bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-text)] rounded-tr-sm' 
            : 'bg-[var(--c-surface-2)] border border-[var(--c-border-2)] text-[var(--c-text)] rounded-tl-sm'
        }`}>
          <p className="m-0 whitespace-pre-wrap">{message.text}</p>
        </div>
      </div>
    </motion.div>
  );
}

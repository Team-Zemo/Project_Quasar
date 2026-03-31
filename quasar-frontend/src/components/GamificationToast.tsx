import { useEffect, useState } from 'react';
import type { GamificationResult } from '../hooks/useGamificationStats';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, ChevronDown, ChevronUp, Star, Flame } from 'lucide-react';

interface GamificationToastProps {
  gamification: GamificationResult;
  onClose:      () => void;
}

export function GamificationToast({ gamification, onClose }: GamificationToastProps) {
  const [visible, setVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 400); // wait for fade-out
    }, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 400);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 100, scale: 0.9 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 100, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className={`fixed bottom-6 right-6 z-[9999] w-[340px] max-w-[calc(100vw-48px)] bg-[var(--c-surface-2)] border border-[var(--c-border-2)] rounded-[16px] backdrop-blur-[12px] overflow-hidden ${
            gamification.levelUp 
              ? 'border-yellow-500/40 shadow-[0_0_40px_rgba(234,179,8,0.2)] bg-gradient-to-br from-[var(--c-surface-2)] to-yellow-500/10' 
              : 'shadow-[0_8px_32px_rgba(0,0,0,0.5)]'
          }`}
          style={{ padding: '16px' }}
        >
          {gamification.levelUp && (
            <div className="absolute inset-0 bg-yellow-500/20 opacity-0 animate-[shimmer_3s_infinite_linear]" style={{ transform: 'skewX(-20deg)', width: '200%' }} />
          )}

          <button 
            className="absolute top-2.5 right-2.5 p-1 text-[var(--c-text-mute)] hover:text-[var(--c-text)] hover:bg-white/10 rounded-full transition-colors z-10 cursor-pointer" 
            onClick={handleClose}
          >
            <X size={16} strokeWidth={2.5} />
          </button>

          {/* XP header */}
          <div className="flex items-center gap-2.5 relative z-10">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--c-accent-dim)] border border-[var(--c-accent-glow)] text-[var(--c-accent)] shadow-sm">
              <Zap size={18} strokeWidth={2.5} />
            </div>
            <span className="text-[18px] font-extrabold text-[var(--c-accent)] drop-shadow-sm">+{gamification.xpEarned} XP</span>
            <span className="ml-auto px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-widest uppercase bg-white/10 text-[var(--c-text)] border border-[var(--c-border)] shadow-sm">
              Lvl {gamification.level}
            </span>
          </div>

          {/* XP breakdown (collapsible) */}
          {gamification.xpBreakdown.length > 0 && (
            <div className="mt-3 relative z-10">
              <button 
                className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors cursor-pointer bg-transparent border-none p-0 outline-none"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expanded ? 'Hide details' : 'Show details'}
              </button>
              
              <AnimatePresence>
                {expanded && (
                  <motion.ul 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden m-0 p-0 list-none mt-2 space-y-1.5 border-t border-[var(--c-border)] pt-2"
                  >
                    {gamification.xpBreakdown.map((b, i) => (
                      <li key={i} className="flex justify-between items-center text-[13px] text-[var(--c-text-dim)]">
                        <span className="truncate pr-3">{b.event}</span>
                        <span className="font-bold text-[var(--c-text)] shrink-0">+{b.xp}</span>
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Level up indicator */}
          {gamification.levelUp && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-3 flex items-center gap-2 relative z-10 text-[13px] text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-[8px]"
              style={{ padding: '8px 12px' }}
            >
              <Star size={16} fill="currentColor" />
              <span>Level Up! You reached <strong className="font-bold text-yellow-400">Level {gamification.level}</strong></span>
            </motion.div>
          )}

          {/* Streak */}
          {gamification.currentStreak >= 2 && (
            <div className="mt-3 flex items-center gap-2 relative z-10 text-[13px] font-bold text-orange-500 tracking-wide bg-orange-500/10 border border-orange-500/20 rounded-[8px]" style={{ padding: '6px 12px' }}>
              <Flame size={14} fill="currentColor" />
              {gamification.currentStreak}-day streak
            </div>
          )}

          {/* New badges */}
          {gamification.newBadges.length > 0 && (
            <div className="mt-3 flex flex-col gap-2 relative z-10">
              {gamification.newBadges.map((b, i) => (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, type: 'spring' }}
                  key={b.id} 
                  className="flex items-center gap-2 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[10px] shadow-sm"
                  style={{ padding: '8px 12px' }}
                >
                  <span className="text-[18px]">{b.icon}</span>
                  <span className="text-[13px] text-[var(--c-text-dim)]">
                    <strong className="text-[var(--c-text)]">{b.name}</strong> unlocked
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

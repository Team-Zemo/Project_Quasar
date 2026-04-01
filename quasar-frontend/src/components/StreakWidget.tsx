import { Flame, TrendingUp, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

interface StreakWidgetProps {
  currentStreak:    number;
  longestStreak:    number;
  lastPracticeDate: string | null;
}

export function StreakWidget({ currentStreak, longestStreak, lastPracticeDate }: StreakWidgetProps) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const practicedToday = lastPracticeDate === todayUTC;
  const isHot = currentStreak >= 3;

  return (
    <div className={`relative flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] transition-all overflow-hidden ${isHot ? 'shadow-[0_4px_20px_rgba(249,115,22,0.15)] border-orange-500/30' : ''}`} style={{ padding: '20px' }}>
      {isHot && (
        <div className="absolute inset-x-0 top-0 h-[30px] bg-gradient-to-b from-orange-500/20 to-transparent pointer-events-none" />
      )}
      <div className="flex items-center gap-2 mb-1 z-10">
        <motion.div 
          animate={isHot ? { scale: [1, 1.15, 1], rotate: [-5, 5, -5] } : {}} 
          transition={isHot ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } : {}}
          className={isHot ? 'text-orange-500 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]' : 'text-[var(--c-text-mute)]'}
        >
          <Flame size={28} strokeWidth={isHot ? 2.5 : 2} />
        </motion.div>
        <span className={`text-[40px] font-black tracking-tighter leading-none ${isHot ? 'text-[var(--c-text)] drop-shadow-sm' : 'text-[var(--c-text-mute)]'}`}>{currentStreak}</span>
      </div>
      <span className={`text-[13px] font-bold uppercase tracking-wider mb-3 ${isHot ? 'text-orange-400' : 'text-[var(--c-text-dim)]'}`}>day streak</span>
      
      <div className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-text-dim)] bg-[var(--c-surface-2)] rounded-full border border-[var(--c-border)]" style={{ padding: '4px 10px' }}>
        <TrendingUp size={12} strokeWidth={2.5} />
        Best: {longestStreak}
      </div>
      
      {!practicedToday && currentStreak > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 mt-4 text-[11px] font-bold tracking-wide uppercase text-orange-500 bg-orange-500/10 rounded-[8px] border border-orange-500/20"
          style={{ padding: '6px 12px' }}
        >
          <AlertCircle size={12} strokeWidth={2.5} />
          Practice today!
        </motion.div>
      )}
    </div>
  );
}

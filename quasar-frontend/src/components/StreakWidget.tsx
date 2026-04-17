import { Flame, TrendingUp, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

interface StreakWidgetProps {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
}

export function StreakWidget({
  currentStreak,
  longestStreak,
  lastPracticeDate,
}: StreakWidgetProps) {
  const todayUTC = new Date().toISOString().slice(0, 10);
  const practicedToday = lastPracticeDate === todayUTC;

  return (
    <div
      className="relative flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[14px] overflow-hidden"
      style={{ padding: "20px" }}
    >
      <div className="flex items-center gap-2 mb-1">
        <Flame
          size={24}
          strokeWidth={2}
          className="text-[var(--c-text-mute)]"
        />
        <span className="text-[34px] font-black tracking-tighter leading-none text-[var(--c-text)]">
          {currentStreak}
        </span>
      </div>
      <span className="text-[11px] font-bold uppercase tracking-wider mb-3 text-[var(--c-text-dim)]">
        day streak
      </span>

      <div
        className="flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-text-dim)] bg-[var(--c-surface-2)] rounded-full border border-[var(--c-border)]"
        style={{ padding: "4px 10px" }}
      >
        <TrendingUp size={12} strokeWidth={2.5} />
        Best: {longestStreak}
      </div>

      {!practicedToday && currentStreak > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 mt-4 text-[11px] font-bold tracking-wide uppercase text-[var(--c-accent)] bg-[var(--c-surface-2)] rounded-[8px] border border-[var(--c-border)]"
          style={{ padding: "6px 12px" }}
        >
          <AlertCircle size={12} strokeWidth={2.5} />
          Practice today!
        </motion.div>
      )}
    </div>
  );
}

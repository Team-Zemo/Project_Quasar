import { Star } from "lucide-react";
import { motion } from "framer-motion";

const LEVELS = [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000];

interface XPBarProps {
  xp: number;
  level: number;
  xpToNext: number | null;
  compact?: boolean;
}

export function XPBar({ xp, level, xpToNext, compact }: XPBarProps) {
  const color = "var(--c-accent)";
  const isMax = xpToNext === null || level >= 10;

  // Calculate progress percentage within current level
  const currentLevelThreshold = LEVELS[level - 1] ?? 0;
  const nextLevelThreshold = LEVELS[level] ?? LEVELS[LEVELS.length - 1];
  const xpInLevel = xp - currentLevelThreshold;
  const xpNeeded = nextLevelThreshold - currentLevelThreshold;
  const pct = isMax
    ? 100
    : Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

  if (compact) {
    return (
      <div
        className="flex items-center gap-3 w-full"
        title={`Level ${level} · ${xp} XP`}
      >
        <span
          className="flex items-center justify-center h-6 px-2 rounded-full text-white text-[11px] font-bold tracking-wider uppercase shrink-0"
          style={{ background: color }}
        >
          Lvl {level}
        </span>
        <div className="flex-1 h-2 bg-[var(--c-surface-3)] rounded-full overflow-hidden flex self-center border border-[var(--c-border)]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", bounce: 0, duration: 1.5 }}
            className="h-full rounded-full shrink-0"
            style={{ background: color }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex items-center justify-between pointer-events-none">
        <span
          className="flex items-center justify-center gap-1.5 h-7 px-3 rounded-full text-white text-[12px] font-bold tracking-wider uppercase shrink-0"
          style={{ background: color }}
        >
          <Star size={12} strokeWidth={2.5} className="mt-[-1px]" />
          Level {level}
        </span>
        <span className="text-[12px] font-medium text-[var(--c-text-mute)] tracking-wider">
          {isMax ? (
            <>
              <span className="text-[var(--c-text)] font-semibold">
                {xp.toLocaleString()}
              </span>{" "}
              XP · <span className="text-[var(--c-text)]">MAX</span>
            </>
          ) : (
            <>
              <span className="text-[var(--c-text)] font-semibold">
                {xp.toLocaleString()}
              </span>{" "}
              / {nextLevelThreshold.toLocaleString()} XP
            </>
          )}
        </span>
      </div>
      <div className="w-full h-3 bg-[var(--c-surface-3)] rounded-full overflow-hidden flex border border-[var(--c-border)] shadow-inner">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", bounce: 0, duration: 1.5 }}
          className="h-full rounded-full shrink-0"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

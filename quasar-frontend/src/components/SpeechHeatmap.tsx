import { motion } from 'framer-motion';

interface FillerBucket {
  t: number;
  count: number;
  words?: string[];
}

interface SpeechHeatmapProps {
  buckets: FillerBucket[];
}

export function SpeechHeatmap({ buckets }: SpeechHeatmapProps) {
  if (!buckets || buckets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] text-[var(--c-text-dim)]">
        <p className="m-0 text-[14px]">No speech data available</p>
      </div>
    );
  }

  const maxCount = Math.max(...buckets.map(b => b.count), 1);

  const getColor = (count: number): string => {
    if (count === 0) return 'rgba(255, 255, 255, 0.05)';
    const intensity = count / maxCount;
    if (intensity < 0.3) return 'rgba(251, 191, 36, 0.3)';  // light amber
    if (intensity < 0.6) return 'rgba(245, 158, 11, 0.6)';  // amber
    if (intensity < 0.8) return 'rgba(239, 68, 68, 0.6)';   // light red
    return 'rgba(220, 38, 38, 0.9)';                         // deep red
  };

  // Find peak segments
  const peakThreshold = maxCount * 0.7;

  return (
    <div className="flex flex-col gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px]" style={{ padding: '24px' }}>
      <div className="flex flex-col mb-2">
        <h4 className="text-[14px] font-bold text-[var(--c-text)] tracking-wide uppercase m-0">Filler Word Heatmap</h4>
        <p className="text-[12px] text-[var(--c-text-dim)] m-0 mt-1">10-second segments • Darker = more fillers</p>
      </div>

      <div className="flex items-end gap-1 overflow-x-auto pb-4 scrollbar-hidden">
        {buckets.map((bucket, i) => {
          const isPeak = bucket.count >= peakThreshold && bucket.count > 0;
          return (
            <div key={i} className="flex flex-col items-center gap-2 group min-w-[32px] shrink-0">
              {isPeak && bucket.words && bucket.words.length > 0 && (
                <div className="text-[10px] font-bold text-[var(--c-text-dim)] uppercase tracking-wider text-center rotate-[-45deg] origin-bottom-left max-w-[40px] truncate">
                  {[...new Set(bucket.words)].slice(0, 2).join(', ')}
                </div>
              )}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: isPeak ? 48 : 32 }}
                title={`${bucket.t}s–${bucket.t + 10}s: ${bucket.count} fillers`}
                className={`w-full rounded-sm flex items-center justify-center transition-all duration-300 ${isPeak ? 'ring-2 ring-red-500/50 shadow-[0_4px_12px_rgba(220,38,38,0.2)]' : 'opacity-80 hover:opacity-100 hover:scale-y-110'}`}
                style={{ backgroundColor: getColor(bucket.count), transformOrigin: 'bottom' }}
              >
                {bucket.count > 0 && (
                  <span className="text-[10px] font-bold text-white drop-shadow-md">{bucket.count}</span>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-4 mt-2 pt-4 border-t border-[var(--c-border)]">
        {[
          { label: 'None', color: 'rgba(255, 255, 255, 0.05)' },
          { label: 'Low', color: 'rgba(251, 191, 36, 0.3)' },
          { label: 'Medium', color: 'rgba(245, 158, 11, 0.6)' },
          { label: 'High', color: 'rgba(220, 38, 38, 0.9)' }
        ].map((legend, i) => (
          <span key={i} className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--c-text-dim)] tracking-wide uppercase">
            <span className="block w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: legend.color }} />
            {legend.label}
          </span>
        ))}
      </div>
    </div>
  );
}

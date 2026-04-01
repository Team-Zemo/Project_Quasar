import { motion } from 'framer-motion';
import { Mic } from 'lucide-react';

interface AudioVisualizerProps {
  isActive: boolean;
  size?: number;
}

export function AudioVisualizer({ isActive, size = 72 }: AudioVisualizerProps) {
  return (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
      aria-label={isActive ? 'Microphone active' : 'Microphone inactive'}
    >
      {/* Background container */}
      <div 
        className={`absolute inset-0 rounded-full transition-colors duration-500 ease-in-out ${
          isActive ? 'bg-orange-500/10' : 'bg-[var(--c-surface-3)]'
        }`}
      />

      {/* Glow ring */}
      {isActive && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 rounded-full bg-orange-500/20 blur-md pointer-events-none"
        />
      )}

      {/* Mic icon */}
      <div className={`relative z-10 transition-colors duration-300 ${
        isActive ? 'text-orange-500' : 'text-[var(--c-text-dim)]'
      }`}>
        <Mic size={size * 0.4} strokeWidth={2} />
      </div>

      {/* Animated bars */}
      {isActive && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-[3px] pointer-events-none" aria-hidden="true" style={{ padding: '20%' }}>
          {[
            { delay: 0.1, duration: 0.8 },
            { delay: 0.3, duration: 0.6 },
            { delay: 0, duration: 1.2 },
            { delay: 0.4, duration: 0.7 },
            { delay: 0.2, duration: 0.9 },
          ].map((anim, i) => (
            <motion.span
              key={i}
              className="w-[10%] h-[20%] max-h-full rounded-full bg-orange-500/80"
              animate={{ height: ['20%', '80%', '20%'] }}
              transition={{
                duration: anim.duration,
                repeat: Infinity,
                delay: anim.delay,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

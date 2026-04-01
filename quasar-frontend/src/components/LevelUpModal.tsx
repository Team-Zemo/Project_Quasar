import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy } from 'lucide-react';

interface LevelUpModalProps {
  level:   number;
  onClose: () => void;
}

export function LevelUpModal({ level, onClose }: LevelUpModalProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-dismiss after 5s
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onClose, 500);
    }, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const handleClick = () => {
    setVisible(false);
    setTimeout(onClose, 500);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 backdrop-blur-sm cursor-pointer"
          onClick={handleClick}
        >
          <motion.div 
            initial={{ scale: 0.8, y: 50, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.8, y: 50, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="flex flex-col items-center gap-2 bg-[var(--c-surface)] border-2 border-yellow-500/50 rounded-[32px] shadow-[0_20px_60px_rgba(234,179,8,0.2)] bg-gradient-to-b from-yellow-500/10 to-[var(--c-surface)] relative overflow-hidden cursor-default"
            style={{ padding: '48px 56px' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Particles background layer */}
            <div className="absolute inset-0 pointer-events-none opacity-50">
               {Array.from({ length: 20 }).map((_, i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-yellow-400 opacity-60 animate-[float_3s_ease-in-out_infinite]"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 1.5}s`,
                    animationDuration: `${2 + Math.random() * 2}s`,
                  }}
                />
              ))}
            </div>

            <motion.div 
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 12 }}
              className="flex items-center justify-center w-24 h-24 bg-yellow-400 text-yellow-900 rounded-full shadow-[0_0_40px_rgba(250,204,21,0.6)] mb-4"
            >
              <Trophy size={48} strokeWidth={2.5} />
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-[36px] font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400 m-0 tracking-tight drop-shadow-sm"
            >
              LEVEL UP!
            </motion.h2>

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-[14px] font-bold text-yellow-500/80 uppercase tracking-widest mt-2"
            >
              You reached
            </motion.p>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6, type: 'spring' }}
              className="text-[48px] font-black text-white m-0 leading-none drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] flex items-center gap-2 mb-6"
            >
              Level 
              <span className="text-yellow-400">{level}</span>
            </motion.div>

            <motion.button 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="mt-4 px-8 py-3 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 font-bold text-[16px] rounded-full shadow-[0_4px_14px_rgba(250,204,21,0.39)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
              onClick={handleClick}
            >
              Continue Practicing
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

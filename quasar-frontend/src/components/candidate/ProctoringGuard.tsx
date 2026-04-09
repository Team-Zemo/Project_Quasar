import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Maximize, Eye, AlertTriangle,
  XCircle, Shield,
} from 'lucide-react';
import { useProctoring, type ProctoringRound } from '../../hooks/useProctoring';

interface Props {
  appId: string;
  round: ProctoringRound;
  roundNumber?: number;
  /** Called when auto-termination threshold is reached — component should submit/end the exam */
  onAutoTerminate: () => void;
  children: React.ReactNode;
}

/**
 * ProctoringGuard
 *
 * Wraps exam content and provides:
 * 1. Fullscreen overlay warning when candidate exits fullscreen (with countdown)
 * 2. Violation count badge (corner)
 * 3. Auto-termination modal when threshold is exceeded
 * 4. All anti-cheat detection via useProctoring hook
 */
export function ProctoringGuard({
  appId,
  round,
  roundNumber = 1,
  onAutoTerminate,
  children,
}: Props) {
  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateCountdown, setTerminateCountdown] = useState(5);
  const terminateTriggered = useRef(false);
  const [fullscreenCountdown, setFullscreenCountdown] = useState(10);

  const handleAutoTerminate = () => {
    if (terminateTriggered.current) return;
    terminateTriggered.current = true;
    setShowTerminateModal(true);
  };

  const {
    violationCount,
    criticalCount,
    trustScore,
    isFullscreen,
    requestFullscreen,
  } = useProctoring({
    appId,
    round,
    roundNumber,
    onAutoTerminate: handleAutoTerminate,
    enabled: true,
  });

  // ── Auto-termination countdown ──────────────────────────────────────

  useEffect(() => {
    if (!showTerminateModal) return;

    setTerminateCountdown(5);
    const interval = setInterval(() => {
      setTerminateCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Actually trigger the auto-submit/end
          onAutoTerminate();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showTerminateModal, onAutoTerminate]);

  // ── Fullscreen re-entry countdown ──────────────────────────────────

  useEffect(() => {
    if (isFullscreen || showTerminateModal) {
      setFullscreenCountdown(10);
      return;
    }

    // Start countdown when not fullscreen
    setFullscreenCountdown(10);
    const interval = setInterval(() => {
      setFullscreenCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFullscreen, showTerminateModal]);

  // Severity color for the violation badge
  const getBadgeColor = () => {
    if (criticalCount >= 3) return 'var(--c-error)';
    if (violationCount >= 5) return 'var(--c-accent)';
    if (violationCount > 0) return 'var(--c-text-mute)';
    return 'transparent';
  };

  return (
    <div className="relative w-full h-full" style={{ userSelect: 'none' }}>
      {/* Main exam content */}
      {children}

      {/* Violation badge — top right corner */}
      <AnimatePresence>
        {violationCount > 0 && !showTerminateModal && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-3 right-3 z-[9999] flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md"
            style={{
              background: 'rgba(0, 0, 0, 0.7)',
              borderColor: getBadgeColor(),
            }}
          >
            <Eye size={13} style={{ color: getBadgeColor() }} />
            <span
              className="text-[11px] font-bold tracking-wide"
              style={{ color: getBadgeColor() }}
            >
              {violationCount} {violationCount === 1 ? 'violation' : 'violations'}
            </span>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: getBadgeColor() }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Proctoring active indicator — bottom center */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-[9998] flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm border border-white/5">
        <Shield size={10} className="text-emerald-400" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-emerald-400/80">
          Proctored
        </span>
      </div>

      {/* Fullscreen exit warning overlay */}
      <AnimatePresence>
        {!isFullscreen && !showTerminateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            style={{ background: 'rgba(0, 0, 0, 0.92)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="max-w-md w-full mx-4 bg-[#1a1a2e] border border-red-500/30 rounded-3xl p-8 text-center shadow-2xl"
            >
              {/* Warning icon */}
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl mx-auto mb-6 bg-red-500/10 border border-red-500/20">
                <ShieldAlert size={40} className="text-red-400" />
              </div>

              <h2 className="text-xl font-black text-white mb-2">
                Fullscreen Required
              </h2>
              <p className="text-[14px] text-gray-400 mb-2 leading-relaxed">
                You have exited fullscreen mode. This has been logged as a
                <span className="ml-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 text-[12px] font-bold">
                  critical violation
                </span>
              </p>
              <p className="text-[13px] text-gray-500 mb-6">
                Please return to fullscreen immediately to continue your exam.
                Multiple violations may result in automatic termination.
              </p>

              {/* Countdown */}
              {fullscreenCountdown > 0 && (
                <div className="text-[12px] text-gray-500 mb-4">
                  Auto-requesting fullscreen in{' '}
                  <span className="font-bold text-red-400">{fullscreenCountdown}s</span>
                </div>
              )}

              <button
                onClick={requestFullscreen}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-bold text-white bg-gradient-to-r from-red-500 to-rose-600 hover:brightness-110 transition-all shadow-lg active:scale-[0.98]"
              >
                <Maximize size={18} />
                Return to Fullscreen
              </button>

              {/* Violation counter */}
              <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <AlertTriangle size={10} className="text-amber-400" />
                  {violationCount} total violations
                </span>
                <span className="flex items-center gap-1">
                  <XCircle size={10} className="text-red-400" />
                  {criticalCount} critical
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auto-termination modal */}
      <AnimatePresence>
        {showTerminateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10001] flex items-center justify-center"
            style={{ background: 'rgba(0, 0, 0, 0.95)' }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring', damping: 20 }}
              className="max-w-md w-full mx-4 bg-[#1a1a2e] border border-red-500/50 rounded-3xl p-8 text-center shadow-2xl"
            >
              {/* Danger icon with pulse */}
              <div className="relative flex items-center justify-center w-24 h-24 rounded-3xl mx-auto mb-6 bg-red-500/15 border border-red-500/30">
                <XCircle size={48} className="text-red-500" />
                <div className="absolute inset-0 rounded-3xl border-2 border-red-500/30 animate-ping" />
              </div>

              <h2 className="text-2xl font-black text-red-400 mb-3">
                Exam Auto-Terminated
              </h2>
              <p className="text-[14px] text-gray-400 mb-4 leading-relaxed">
                Too many proctoring violations have been detected. Your exam is
                being automatically submitted with your current progress.
              </p>

              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-[20px] font-black text-red-400">{violationCount}</p>
                    <p className="text-[10px] font-bold uppercase text-gray-500">Violations</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-black text-red-400">{criticalCount}</p>
                    <p className="text-[10px] font-bold uppercase text-gray-500">Critical</p>
                  </div>
                  <div>
                    <p className="text-[20px] font-black text-red-400">{trustScore}%</p>
                    <p className="text-[10px] font-bold uppercase text-gray-500">Trust</p>
                  </div>
                </div>
              </div>

              <p className="text-[13px] text-gray-500">
                Submitting in{' '}
                <span className="text-[20px] font-black text-red-400 mx-1">
                  {terminateCountdown}
                </span>
                seconds...
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  Maximize,
  Eye,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useProctoring, type ProctoringRound } from "../../hooks/useProctoring";

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
  const terminateTriggered = useRef(false);
  const [fullscreenCountdown, setFullscreenCountdown] = useState(10);

  const handleAutoTerminate = () => {
    if (terminateTriggered.current) return;
    terminateTriggered.current = true;
    onAutoTerminate();
  };

  const { violationCount, criticalCount, isFullscreen, requestFullscreen } =
    useProctoring({
      appId,
      round,
      roundNumber,
      onAutoTerminate: handleAutoTerminate,
      enabled: true,
    });

  // ── Fullscreen re-entry countdown ──────────────────────────────────

  useEffect(() => {
    if (isFullscreen) {
      setFullscreenCountdown(10);
      return;
    }

    // Start countdown when not fullscreen
    setFullscreenCountdown(10);
    const interval = setInterval(() => {
      setFullscreenCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isFullscreen]);

  // Severity color for the violation badge
  const getBadgeColor = () => {
    if (criticalCount >= 3) return "var(--c-error)";
    if (violationCount >= 5) return "var(--c-accent)";
    if (violationCount > 0) return "var(--c-text-mute)";
    return "transparent";
  };

  return (
    <div className="relative w-full h-full" style={{ userSelect: "none" }}>
      {/* Main exam content */}
      {children}

      {/* Violation badge — moved away from action buttons */}
      <AnimatePresence>
        {violationCount > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed top-4 left-4 z-[9999] pointer-events-none flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md"
            style={{
              background: "rgba(15, 15, 26, 0.86)",
              borderColor: getBadgeColor(),
            }}
          >
            <Eye size={13} style={{ color: getBadgeColor() }} />
            <span
              className="text-[11px] font-bold tracking-wide"
              style={{ color: getBadgeColor() }}
            >
              {violationCount}{" "}
              {violationCount === 1 ? "violation" : "violations"}
            </span>
            <div
              className="w-2 h-2 rounded-full animate-pulse"
              style={{ background: getBadgeColor() }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen exit warning overlay */}
      <AnimatePresence>
        {!isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[10000] flex items-center justify-center"
            style={{ background: "rgba(8, 8, 16, 0.94)" }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="max-w-md w-full mx-4 bg-[var(--c-surface)] border border-[var(--c-border-2)] rounded-3xl p-8 text-center shadow-[var(--shadow-glass)]"
            >
              {/* Warning icon */}
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl mx-auto mb-6 bg-[var(--c-error-dim)] border border-red-500/20">
                <ShieldAlert size={40} className="text-[var(--c-error)]" />
              </div>

              <h2 className="text-xl font-black text-[var(--c-text)] mb-2">
                Fullscreen Required
              </h2>
              <p className="text-[14px] text-[var(--c-text-dim)] mb-2 leading-relaxed">
                You have exited fullscreen mode. This has been logged as a
                <span className="ml-1 px-1.5 py-0.5 rounded bg-[var(--c-error-dim)] text-[var(--c-error)] text-[12px] font-bold">
                  critical violation
                </span>
              </p>
              <p className="text-[13px] text-[var(--c-text-mute)] mb-6">
                Please return to fullscreen immediately to continue your exam.
                Multiple violations may result in automatic termination.
              </p>

              {/* Countdown */}
              {fullscreenCountdown > 0 && (
                <div className="text-[12px] text-[var(--c-text-mute)] mb-4">
                  Returning to fullscreen in{" "}
                  <span className="font-black text-[var(--c-accent)]">
                    {fullscreenCountdown}s
                  </span>
                </div>
              )}

              <button
                onClick={requestFullscreen}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-black text-black bg-[var(--c-accent)] hover:brightness-110 transition-all shadow-[var(--shadow-accent)] active:scale-[0.98]"
              >
                <Maximize size={18} />
                Return to Fullscreen
              </button>

              {/* Violation counter */}
              <div className="mt-5 flex items-center justify-center gap-4 text-[11px] text-[var(--c-text-mute)]">
                <span className="flex items-center gap-1.5">
                  <AlertTriangle size={10} className="text-[var(--c-accent)]" />
                  {violationCount} total violations
                </span>
                <span className="flex items-center gap-1.5">
                  <XCircle size={10} className="text-[var(--c-error)]" />
                  {criticalCount} critical
                </span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useEffect, useRef, useCallback, useState } from 'react';
import { apiPost } from '../lib/api';

// ── Types ────────────────────────────────────────────────────────────────

export type ViolationType =
  | 'fullscreen_exit'
  | 'right_click'
  | 'tab_switch'
  | 'copy_paste'
  | 'keyboard_shortcut'
  | 'devtools_open'
  | 'multi_monitor'
  | 'print_screen'
  | 'multiple_faces';  // 2+ faces detected in camera frame

export type ProctoringRound = 'mcq' | 'tech' | 'hr';

interface Violation {
  type: ViolationType;
  round: ProctoringRound;
  roundNumber: number;
  timestamp: string;
  details: string;
}

interface ProctoringConfig {
  appId: string;
  round: ProctoringRound;
  roundNumber?: number;
  /** Called when auto-termination threshold is reached */
  onAutoTerminate: () => void;
  /** Whether proctoring is actively enforced */
  enabled?: boolean;
}

interface ProctoringState {
  violationCount: number;
  criticalCount: number;
  trustScore: number;
  isFullscreen: boolean;
  violations: Violation[];
  requestFullscreen: () => void;
  /** Inject an arbitrary violation from outside the hook (e.g. multi-face from EmotionAnalyzer) */
  reportViolation: (type: ViolationType, details?: string) => void;
}

// ── Severity classification ──────────────────────────────────────────

const SEVERITY_MAP: Record<ViolationType, 'warning' | 'critical'> = {
  fullscreen_exit:  'critical',
  right_click:      'warning',
  tab_switch:       'critical',
  copy_paste:       'warning',
  keyboard_shortcut:'warning',
  devtools_open:    'critical',
  multi_monitor:    'warning',
  print_screen:     'warning',
  multiple_faces:   'critical', // person getting help = immediate flag
};

const TRUST_PENALTY: Record<string, number> = {
  warning: 2,
  critical: 5,
};

// ── Blocked keyboard shortcuts ───────────────────────────────────────

const BLOCKED_KEYS: { key: string; ctrl?: boolean; shift?: boolean; alt?: boolean; meta?: boolean }[] = [
  { key: 'c', ctrl: true },           // Ctrl+C (copy)
  { key: 'v', ctrl: true },           // Ctrl+V (paste)
  { key: 'x', ctrl: true },           // Ctrl+X (cut)
  { key: 'a', ctrl: true },           // Ctrl+A (select all)
  { key: 'p', ctrl: true },           // Ctrl+P (print)
  { key: 's', ctrl: true },           // Ctrl+S (save page)
  { key: 'u', ctrl: true },           // Ctrl+U (view source)
  { key: 'i', ctrl: true, shift: true }, // Ctrl+Shift+I (devtools)
  { key: 'j', ctrl: true, shift: true }, // Ctrl+Shift+J (devtools console)
  { key: 'c', ctrl: true, shift: true }, // Ctrl+Shift+C (devtools inspect)
  { key: 'F12', ctrl: false },        // F12 (devtools)
  { key: 'F5', ctrl: false },         // F5 (refresh)
  { key: 'r', ctrl: true },           // Ctrl+R (refresh)
  { key: 'r', ctrl: true, shift: true }, // Ctrl+Shift+R (hard refresh)
  { key: 'Tab', alt: true },          // Alt+Tab (switch window)
  { key: 'PrintScreen', ctrl: false }, // PrintScreen
];

// ── Hook ─────────────────────────────────────────────────────────────

export function useProctoring({
  appId,
  round,
  roundNumber = 1,
  onAutoTerminate,
  enabled = true,
}: ProctoringConfig): ProctoringState {
  const [violationCount, setViolationCount] = useState(0);
  const [criticalCount, setCriticalCount] = useState(0);
  const [trustScore, setTrustScore] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);

  // Queue for batching violations to avoid flooding the backend
  const violationQueue = useRef<Violation[]>([]);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const autoTerminated = useRef(false);

  // ── Stable refs for callbacks used inside the main effect ──────────
  // This prevents the effect from re-running when these functions get
  // new identities due to state updates, which was causing fullscreen
  // to exit and re-enter (the old cleanup would call exitFullscreen).

  const onAutoTerminateRef = useRef(onAutoTerminate);
  useEffect(() => { onAutoTerminateRef.current = onAutoTerminate; }, [onAutoTerminate]);

  const appIdRef = useRef(appId);
  useEffect(() => { appIdRef.current = appId; }, [appId]);

  const roundRef = useRef(round);
  useEffect(() => { roundRef.current = round; }, [round]);

  const roundNumberRef = useRef(roundNumber);
  useEffect(() => { roundNumberRef.current = roundNumber; }, [roundNumber]);

  // ── Fullscreen request (stable, no deps) ──────────────────────────

  const requestFullscreen = useCallback(() => {
    const el = document.documentElement;
    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => {});
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    } else if ((el as any).msRequestFullscreen) {
      (el as any).msRequestFullscreen();
    }
  }, []);

  // ── Setup all proctoring listeners (runs ONCE on mount) ───────────

  useEffect(() => {
    if (!enabled) return;

    // Internal flush helper — reads current appId from ref
    const flushBatch = async () => {
      if (violationQueue.current.length === 0) return;

      const batch = [...violationQueue.current];
      violationQueue.current = [];

      try {
        const res = await apiPost<{
          totalViolations: number;
          criticalViolations: number;
          trustScore: number;
          shouldAutoTerminate: boolean;
        }>(`/api/candidate/applications/${appIdRef.current}/proctor/violations/batch`, {
          violations: batch,
        });

        if (res.success && res.data) {
          setViolationCount(res.data.totalViolations);
          setCriticalCount(res.data.criticalViolations);
          setTrustScore(res.data.trustScore);

          if (res.data.shouldAutoTerminate && !autoTerminated.current) {
            autoTerminated.current = true;
            onAutoTerminateRef.current();
          }
        }
      } catch (err) {
        // Re-queue failed violations
        violationQueue.current.unshift(...batch);
        console.error('[Proctor] Failed to flush violations:', err);
      }
    };

    // Internal record helper — reads round/roundNumber from refs
    const record = (type: ViolationType, details = '') => {
      if (autoTerminated.current) return;

      const v: Violation = {
        type,
        round: roundRef.current,
        roundNumber: roundNumberRef.current,
        timestamp: new Date().toISOString(),
        details,
      };

      violationQueue.current.push(v);
      setViolations(prev => [...prev, v]);

      // Update local counts immediately for UI
      const severity = SEVERITY_MAP[type];
      const penalty = TRUST_PENALTY[severity];

      setViolationCount(c => c + 1);
      if (severity === 'critical') {
        setCriticalCount(c => {
          const next = c + 1;
          if (next >= 5 && !autoTerminated.current) {
            autoTerminated.current = true;
            setTimeout(() => onAutoTerminateRef.current(), 100);
          }
          return next;
        });
      }
      setTrustScore(s => {
        const next = Math.max(0, s - penalty);
        if (next <= 0 && !autoTerminated.current) {
          autoTerminated.current = true;
          setTimeout(() => onAutoTerminateRef.current(), 100);
        }
        return next;
      });

      // Debounced flush (250ms)
      clearTimeout(flushTimer.current);
      flushTimer.current = setTimeout(flushBatch, 250);
    };

    // ── Wire external reporter so reportViolation() works outside the effect
    externalRecordRef.current = record;

    // -- Fullscreen change detection --
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      if (!isFull) {
        record('fullscreen_exit', 'Exited fullscreen mode');
      }
    };

    // -- Right-click prevention --
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      record('right_click', 'Attempted right-click');
    };

    // -- Tab/window visibility detection --
    const handleVisibilityChange = () => {
      if (document.hidden) {
        record('tab_switch', 'Tab became hidden (visibilitychange)');
      }
    };

    const handleWindowBlur = () => {
      record('tab_switch', 'Window lost focus (blur)');
    };

    // -- Copy/Cut/Paste prevention --
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      record('copy_paste', 'Attempted copy');
    };

    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      record('copy_paste', 'Attempted cut');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      record('copy_paste', 'Attempted paste');
    };

    // -- Keyboard shortcut blocking --
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const blocked of BLOCKED_KEYS) {
        const keyMatch = e.key === blocked.key || e.key.toLowerCase() === blocked.key.toLowerCase();
        const ctrlMatch = blocked.ctrl ? (e.ctrlKey || e.metaKey) : !e.ctrlKey && !e.metaKey;
        const shiftMatch = blocked.shift ? e.shiftKey : !blocked.shift;
        const altMatch = blocked.alt ? e.altKey : !blocked.alt;

        // More flexible matching for function keys
        const isFunctionKey = blocked.key.startsWith('F') && blocked.key.length <= 3;

        if (keyMatch && (isFunctionKey || (ctrlMatch && shiftMatch && altMatch))) {
          e.preventDefault();
          e.stopPropagation();
          record(
            blocked.key === 'PrintScreen' ? 'print_screen' : 'keyboard_shortcut',
            `Blocked: ${e.ctrlKey ? 'Ctrl+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.altKey ? 'Alt+' : ''}${e.key}`,
          );
          return;
        }
      }
    };

    // -- Multi-monitor detection --
    const checkMultiMonitor = () => {
      if ('screen' in window && (window.screen as any).isExtended) {
        record('multi_monitor', 'External display detected');
      }
    };

    // -- Drag prevention --
    const handleDragStart = (e: DragEvent) => {
      e.preventDefault();
    };

    // -- Select prevention for text --
    const handleSelectStart = (e: Event) => {
      e.preventDefault();
    };

    // Register all listeners
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('selectstart', handleSelectStart);

    // Enter fullscreen on mount (with a small delay so the DOM is settled)
    const fsTimer = setTimeout(() => {
      requestFullscreen();
    }, 300);

    // Check multi-monitor on mount
    checkMultiMonitor();

    // DevTools check interval (every 2 seconds, deduplicated)
    let lastDevToolsViolation = 0;
    const devtoolsInterval = setInterval(() => {
      const now = Date.now();
      // Only flag once every 30 seconds max
      if (now - lastDevToolsViolation < 30000) return;
      const threshold = 160;
      const widthDiff = window.outerWidth - window.innerWidth;
      const heightDiff = window.outerHeight - window.innerHeight;
      if (widthDiff > threshold || heightDiff > threshold) {
        lastDevToolsViolation = now;
        record('devtools_open', `Window size discrepancy: w=${widthDiff}, h=${heightDiff}`);
      }
    }, 2000);

    // Multi-monitor change event (if supported)
    const screenChangeHandler = () => checkMultiMonitor();
    if ('screen' in window && 'addEventListener' in window.screen) {
      (window.screen as any).addEventListener?.('change', screenChangeHandler);
    }

    // Cleanup — only runs on actual unmount
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('selectstart', handleSelectStart);

      clearInterval(devtoolsInterval);
      clearTimeout(flushTimer.current);
      clearTimeout(fsTimer);

      if ('screen' in window && 'removeEventListener' in window.screen) {
        (window.screen as any).removeEventListener?.('change', screenChangeHandler);
      }

      // Exit fullscreen on unmount
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      // Clear external reporter so stale callers can't fire into dead effect
      externalRecordRef.current = null;

      // Final flush
      flushBatch();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]); // Only re-run if enabled flag changes — all other deps are stable refs

  // ── External violation reporter (stable ref, safe to call from effects) ──
  // This ref is populated inside the main effect where `record` is in scope.
  const externalRecordRef = useRef<((type: ViolationType, details?: string) => void) | null>(null);

  const reportViolation = useCallback((type: ViolationType, details = '') => {
    externalRecordRef.current?.(type, details);
  }, []);

  return {
    violationCount,
    criticalCount,
    trustScore,
    isFullscreen,
    violations,
    requestFullscreen,
    reportViolation,
  };
}

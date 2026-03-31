import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message, SessionStatus, EmotionSnapshot, CodingQuestion } from '../types/interview';
import { MessageBubble } from './MessageBubble';
import { AudioVisualizer } from './AudioVisualizer';
import { EmotionAnalyzer } from './EmotionAnalyzer';
import { FillerDetector } from './FillerDetector';
import { PostSessionResults } from './PostSessionResults';
import { CodeEditor } from './CodeEditor';
import { apiPost, apiFetchRaw } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, Mic, MessageSquare, CheckCircle2, RefreshCw, Loader2 } from 'lucide-react';

const logger = (...args: unknown[]) => console.log('[InterviewRoom]', ...args);

interface InterviewRoomProps {
  messages: Message[];
  status: SessionStatus;
  isRecording: boolean;
  domain: string;
  sessionId: string | null;
  activeCodingQuestion: CodingQuestion | null;
  onEnd: () => void;
  onNewInterview: () => void;
  onSubmitCode: (code: string, language: string) => void;
  getTranscript: () => string;
}

export function InterviewRoom({
  messages,
  status,
  isRecording,
  domain,
  sessionId,
  activeCodingQuestion,
  onEnd,
  onNewInterview,
  onSubmitCode,
  getTranscript,
}: InterviewRoomProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isEnded = status === 'ended' || status === 'error';
  const metricsSubmittedRef = useRef(false);

  const [emotionSnapshots, setEmotionSnapshots] = useState<EmotionSnapshot[]>([]);
  const [fillerData, setFillerData] = useState<{
    totalFillers: number;
    fillerRate: number;
    transcript: string;
    fillerBuckets: { t: number; count: number; words?: string[] }[];
  } | null>(null);
  const [reportDownloading, setReportDownloading] = useState(false);
  const [metricsReady, setMetricsReady] = useState(false);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleEmotionSnapshot = useCallback((snapshot: EmotionSnapshot) => {
    setEmotionSnapshots(prev => [...prev, snapshot]);
  }, []);

  const handleFillerUpdate = useCallback((data: {
    totalFillers: number;
    fillerRate: number;
    transcript: string;
    fillerBuckets: { t: number; count: number; words?: string[] }[];
  }) => {
    setFillerData(data);
  }, []);

  // Save metrics when session ends (run once), then signal readiness for evaluation
  useEffect(() => {
    if (!isEnded || !sessionId || metricsSubmittedRef.current) return;
    metricsSubmittedRef.current = true;

    const saveAllMetrics = async () => {
      logger('Session ended — saving metrics before evaluation…');

      const promises: Promise<unknown>[] = [];

      // Save emotion metrics
      if (emotionSnapshots.length > 0) {
        promises.push(
          apiPost(`/api/sessions/${sessionId}/emotion-metrics`, { metrics: emotionSnapshots })
            .then(() => logger('Emotion metrics saved'))
            .catch((err) => logger('Emotion metrics save failed:', err))
        );
      }

      // Save speech metrics (include FULL conversation transcript, not just browser speech-recognition)
      const transcript = getTranscript();
      promises.push(
        apiPost(`/api/sessions/${sessionId}/speech-metrics`, {
          transcript,
          fillerBuckets: fillerData?.fillerBuckets || [],
          totalFillers: fillerData?.totalFillers || 0,
          wordsPerMinute: 0,
        })
          .then(() => logger('Speech metrics saved'))
          .catch((err) => logger('Speech metrics save failed:', err))
      );

      // Also save the transcript directly to the session as a fallback,
      // so the evaluator always has access to it
      if (transcript) {
        promises.push(
          apiPost(`/api/sessions/${sessionId}/end`, {
            transcript,
            durationSeconds: 0, // will be recalculated by evaluator
          })
            .then(() => logger('Session transcript persisted'))
            .catch((err) => logger('Session transcript persist failed:', err))
        );
      }

      await Promise.allSettled(promises);
      logger('All metrics saved — evaluation can proceed');
      setMetricsReady(true);
    };

    saveAllMetrics();
  }, [isEnded, sessionId]);

  const handleDownloadReport = async () => {
    if (!sessionId) return;
    setReportDownloading(true);

    try {
      const response = await apiFetchRaw(`/api/sessions/${sessionId}/report`);

      if (!response.ok) throw new Error('Failed to generate report');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `interview-report-${sessionId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Report download failed:', err);
    } finally {
      setReportDownloading(false);
    }
  };

  return (
    <div className={`flex flex-col w-full h-full max-h-[100vh] overflow-hidden ${!isEnded ? 'max-w-6xl mx-auto' : 'max-w-4xl mx-auto'}`}>
      {/* Header bar */}
      <header className="flex items-center justify-between shrink-0 p-4 lg:p-6 bg-[var(--c-surface)] border-b border-[var(--c-border)] z-10 sticky top-0 shadow-sm backdrop-blur-md bg-opacity-90">
        <div className="flex flex-col justify-center">
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center w-2.5 h-2.5">
              <div className={`absolute inset-0 rounded-full transition-colors ${
                isRecording ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-[pulse-dot_1.5s_infinite]' : 'bg-[var(--c-text-mute)]'
              }`} />
            </div>
            <p className="text-[16px] font-bold tracking-tight text-[var(--c-text)] m-0 leading-tight">
              {domain}
            </p>
          </div>
          <p className="text-[12px] font-medium text-[var(--c-text-dim)] m-0 mt-0.5 ml-5 max-w-[300px] truncate">
            {status === 'active' && activeCodingQuestion && 'Write your code solution — microphone paused'}
            {status === 'active' && !activeCodingQuestion && isRecording && 'Session active — speak to respond'}
            {status === 'active' && !activeCodingQuestion && !isRecording && 'Connecting audio…'}
            {status === 'connecting' && 'Connecting to Gemini…'}
            {status === 'ended' && 'Session completed — reviewing performance'}
            {status === 'error' && 'Connection error'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          {/* Filler counter inline in header */}
          <FillerDetector
            isActive={status === 'active' && isRecording}
            onUpdate={handleFillerUpdate}
          />

          {!isEnded && (
            <button 
              id="end-session-btn" 
              onClick={onEnd} 
              className="flex items-center gap-2 px-4 py-2 font-bold text-[13px] bg-red-500 hover:bg-red-600 text-white border border-red-500/20 rounded-xl transition-all shadow-[0_2px_10px_rgba(239,68,68,0.2)] active:scale-95"
            >
              <Square size={14} fill="currentColor" />
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Main content: webcam sidebar + transcript */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden h-full">
        {/* Webcam + Emotion sidebar — visible during active session */}
        <AnimatePresence>
          {!isEnded && (
            <motion.aside 
              initial={{ opacity: 0, x: -20, width: 0 }}
              animate={{ opacity: 1, x: 0, width: '280px' }}
              exit={{ opacity: 0, x: -20, width: 0 }}
              className="flex flex-col shrink-0 w-full md:w-[280px] border-r border-[var(--c-border)] bg-[var(--c-surface-2)] overflow-y-auto hidden md:flex custom-scrollbar"
            >
              <div className="p-4 flex flex-col gap-4 sticky top-0">
                <EmotionAnalyzer
                  isActive={status === 'active' && isRecording}
                  onSnapshot={handleEmotionSnapshot}
                />

                {/* Session info below webcam */}
                <div className="flex items-center gap-4 p-3.5 bg-[var(--c-surface-3)] border border-[var(--c-border)] rounded-2xl shadow-sm">
                  <div className="shrink-0 flex items-center justify-center p-2 rounded-xl bg-[var(--c-surface)] text-[var(--c-text)]">
                    <AudioVisualizer isActive={isRecording} size={32} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] m-0">Microphone</p>
                    <p className="text-[13px] font-semibold text-[var(--c-text)] m-0 mt-0.5 truncate">
                      {isRecording ? 'Listening…' : 'Connecting…'}
                    </p>
                  </div>
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>

        {/* Transcript / Results area */}
        <div className="flex-1 flex flex-col min-w-0 bg-[var(--c-surface)] relative">
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 flex flex-col gap-6">
            {/* Live interview transcript */}
            {messages.length === 0 && !isEnded && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center m-auto text-center gap-3 mt-20"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-[20px] bg-orange-500/10 text-orange-500 border border-orange-500/20 shadow-inner">
                  <MessageSquare size={32} strokeWidth={2} />
                </div>
                <p className="text-[15px] font-medium text-[var(--c-text)] m-0 mt-2">Waiting for the interviewer to speak…</p>
                <span className="flex items-center gap-1.5 text-[13px] text-[var(--c-text-dim)] bg-[var(--c-surface-2)] px-3 py-1.5 border border-[var(--c-border)] rounded-full">
                  <Mic size={14} className="text-orange-400" />
                  Make sure your microphone is enabled
                </span>
              </motion.div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* Post-session: saving metrics indicator */}
            {isEnded && sessionId && !metricsReady && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 gap-5 text-center m-auto"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-[20px] bg-blue-500/10 text-blue-500 border border-blue-500/20">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-[var(--c-text)] m-0 mb-2">Saving session data…</h3>
                  <p className="text-[14px] text-[var(--c-text-dim)] m-0">Preparing your responses for evaluation</p>
                </div>
              </motion.div>
            )}

            {/* Post-session: full evaluation results (only after metrics are saved) */}
            {isEnded && sessionId && metricsReady && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <PostSessionResults
                  sessionId={sessionId}
                  fillerBuckets={fillerData?.fillerBuckets || []}
                  onDownloadReport={handleDownloadReport}
                  reportDownloading={reportDownloading}
                  onNewInterview={onNewInterview}
                />
              </motion.div>
            )}

            {/* Fallback if no sessionId */}
            {isEnded && !sessionId && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center text-center p-8 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-[24px] max-w-sm mx-auto shadow-sm mt-10"
              >
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-[var(--c-success-dim)] text-[var(--c-success)] text-[28px] font-bold mb-4">
                  <CheckCircle2 size={32} />
                </div>
                <h3 className="text-[20px] font-bold text-[var(--c-text)] mb-2">Interview Complete</h3>
                <p className="text-[14px] text-[var(--c-text-dim)] mb-6">Session successfully ended.</p>
                <button 
                  id="new-interview-btn" 
                  onClick={onNewInterview} 
                  className="flex items-center justify-center gap-2 px-6 py-2.5 font-bold text-[14px] bg-[var(--c-surface)] hover:bg-[var(--c-surface-3)] text-[var(--c-text)] border border-[var(--c-border-2)] rounded-xl transition-colors shadow-sm w-full active:scale-95"
                >
                  <RefreshCw size={16} />
                  Start New Interview
                </button>
              </motion.div>
            )}

            <div ref={bottomRef} className="h-8" />
          </div>
        </div>
      </div>

      {/* Code editor overlay — shown when AI presents a coding question */}
      <AnimatePresence>
        {activeCodingQuestion && (
          <CodeEditor
            question={activeCodingQuestion}
            onSubmit={onSubmitCode}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

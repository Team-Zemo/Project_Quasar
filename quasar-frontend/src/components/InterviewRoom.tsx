import { useEffect, useRef, useState, useCallback } from 'react';
import type { Message, SessionStatus, EmotionSnapshot, CodingQuestion } from '../types/interview';
import { MessageBubble } from './MessageBubble';
import { AudioVisualizer } from './AudioVisualizer';
import { EmotionAnalyzer } from './EmotionAnalyzer';
import { FillerDetector } from './FillerDetector';
import { PostSessionResults } from './PostSessionResults';
import { CodeEditor } from './CodeEditor';
import { apiPost } from '../lib/api';

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
      const response = await fetch(`/api/sessions/${sessionId}/report`, {
        credentials: 'include',
      });

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
    <div className={`interview-room ${!isEnded ? 'interview-room--with-cam' : ''}`}>
      {/* Header bar */}
      <header className="room-header">
        <div className="room-header__info">
          <div className={`status-dot ${isRecording ? 'status-dot--live' : 'status-dot--idle'}`} />
          <div>
            <p className="room-header__domain">{domain}</p>
            <p className="room-header__status">
          {status === 'active' && activeCodingQuestion && 'Write your code solution — microphone paused'}
              {status === 'active' && !activeCodingQuestion && isRecording && 'Session active — speak to respond'}
              {status === 'active' && !activeCodingQuestion && !isRecording && 'Connecting audio…'}
              {status === 'connecting' && 'Connecting to Gemini…'}
              {status === 'ended' && 'Session completed — reviewing performance'}
              {status === 'error' && 'Connection error'}
            </p>
          </div>
        </div>

        <div className="room-header__right">
          {/* Filler counter inline in header */}
          <FillerDetector
            isActive={status === 'active' && isRecording}
            onUpdate={handleFillerUpdate}
          />

          {!isEnded && (
            <button id="end-session-btn" onClick={onEnd} className="btn-danger">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
              </svg>
              End Session
            </button>
          )}
        </div>
      </header>

      {/* Main content: webcam sidebar + transcript */}
      <div className="room-body">
        {/* Webcam + Emotion sidebar — visible during active session */}
        {!isEnded && (
          <aside className="room-sidebar">
            <EmotionAnalyzer
              isActive={status === 'active' && isRecording}
              onSnapshot={handleEmotionSnapshot}
            />

            {/* Session info below webcam */}
            <div className="sidebar-info">
              <AudioVisualizer isActive={isRecording} size={48} />
              <div className="sidebar-info__text">
                <p className="sidebar-info__label">Microphone</p>
                <p className="sidebar-info__value">{isRecording ? 'Listening…' : 'Connecting…'}</p>
              </div>
            </div>
          </aside>
        )}

        {/* Transcript / Results area */}
        <div className="transcript-area">
          {/* Live interview transcript */}
          {messages.length === 0 && !isEnded && (
            <div className="transcript-empty">
              <div className="transcript-empty__icon">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <p>Waiting for the interviewer to speak…</p>
              <span>Make sure your microphone is enabled</span>
            </div>
          )}

          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Post-session: saving metrics indicator */}
          {isEnded && sessionId && !metricsReady && (
            <div className="post-session">
              <div className="eval-loading">
                <div className="eval-loading__spinner">
                  <div className="spinner spinner--large" />
                </div>
                <h3>Saving session data…</h3>
                <p>Preparing your responses for evaluation</p>
              </div>
            </div>
          )}

          {/* Post-session: full evaluation results (only after metrics are saved) */}
          {isEnded && sessionId && metricsReady && (
            <PostSessionResults
              sessionId={sessionId}
              fillerBuckets={fillerData?.fillerBuckets || []}
              onDownloadReport={handleDownloadReport}
              reportDownloading={reportDownloading}
              onNewInterview={onNewInterview}
            />
          )}

          {/* Fallback if no sessionId */}
          {isEnded && !sessionId && (
            <div className="session-ended-card">
              <div className="session-ended-card__icon">✓</div>
              <h3>Interview Complete</h3>
              <p>Session ended.</p>
              <div className="session-ended-actions">
                <button id="new-interview-btn" onClick={onNewInterview} className="btn-secondary">
                  Start New Interview
                </button>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Code editor overlay — shown when AI presents a coding question */}
      {activeCodingQuestion && (
        <CodeEditor
          question={activeCodingQuestion}
          onSubmit={onSubmitCode}
        />
      )}
    </div>
  );
}

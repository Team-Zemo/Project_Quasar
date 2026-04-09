import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, ChevronLeft, ChevronRight, Flag, CheckCircle,
  AlertTriangle, Send,
} from 'lucide-react';
import { apiPost, apiGet } from '../../lib/api';
import type { McqTestQuestion, McqTestStartData } from '../../types/recruitment';
import { ProctoringGuard } from './ProctoringGuard';

interface Props {
  appId: string;
  onComplete: (result: { passed: boolean; percentage: number }) => void;
  onBack: () => void;
}

export function McqTestPage({ appId, onComplete, onBack }: Props) {
  const [testData, setTestData] = useState<McqTestStartData | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, number>>(new Map());
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [error, setError] = useState('');
  const [testStarted, setTestStarted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  const startTest = async () => {
    setLoading(true);
    try {
      const res = await apiPost<McqTestStartData>(`/api/candidate/applications/${appId}/mcq/start`, {});
      if (res.success) {
        setTestData(res.data);
        setTimeLeft(res.data.durationMinutes * 60);
        setTestStarted(true);
      } else {
        setError(res.message || 'Failed to start test');
      }
    } catch {
      setError('Failed to start test');
    } finally {
      setLoading(false);
    }
  };

  // Timer
  useEffect(() => {
    if (!testStarted || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [testStarted]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers(prev => new Map(prev).set(questionId, optionIndex));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!testData) return;
    setSubmitting(true);
    clearInterval(timerRef.current);

    const answerPayload = testData.questions.map(q => ({
      questionId: q._id,
      selectedOption: answers.get(q._id) ?? -1,
      timeTakenSeconds: 0,
    }));

    try {
      const res = await apiPost<{ passed: boolean; percentage: number }>(`/api/candidate/applications/${appId}/mcq/submit`, { answers: answerPayload });
      if (res.success) {
        onComplete(res.data);
      } else {
        setError(res.message || 'Submission failed');
      }
    } catch {
      setError('Failed to submit test');
    } finally {
      setSubmitting(false);
    }
  }, [testData, answers, appId, onComplete]);

  if (loading && !testStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[var(--c-text)] mb-4">MCQ Assessment</h2>
          <p className="text-[var(--c-text-dim)] text-[14px] mb-6">When you start, the timer begins. You cannot pause.</p>
          {error && <p className="text-[var(--c-error)] text-[13px] mb-4">{error}</p>}
          <button onClick={startTest} className="btn-primary flex items-center gap-2 mx-auto">
            Start Test <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  if (!testData) return null;

  const currentQuestion = testData.questions[currentIndex];
  const answered = answers.size;
  const total = testData.totalQuestions;
  const isLowTime = timeLeft < 60;

  return (
    <ProctoringGuard appId={appId} round="mcq" onAutoTerminate={handleSubmit}>
    <div className="min-h-screen bg-[var(--c-bg)] flex">
      {/* Sidebar — Question Navigator */}
      <div className="w-64 bg-[var(--c-surface)] border-r border-[var(--c-border)] p-4 flex flex-col">
        <div className={`text-center py-3 px-4 rounded-xl mb-4 ${isLowTime ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]' : 'bg-[var(--c-surface-2)] text-[var(--c-text)]'}`}>
          <div className="flex items-center justify-center gap-2">
            <Clock size={16} />
            <span className="text-xl font-mono font-bold">{formatTime(timeLeft)}</span>
          </div>
        </div>

        <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-3">
          Questions ({answered}/{total} answered)
        </p>

        <div className="grid grid-cols-5 gap-1.5 mb-4 overflow-y-auto flex-1">
          {testData.questions.map((q, i) => {
            const isAnswered = answers.has(q._id);
            const isFlagged = flagged.has(q._id);
            const isCurrent = i === currentIndex;

            return (
              <button
                key={q._id}
                onClick={() => setCurrentIndex(i)}
                className={`w-9 h-9 rounded-lg text-[11px] font-bold transition-all relative ${
                  isCurrent
                    ? 'bg-[var(--c-accent)] text-black'
                    : isAnswered
                    ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]'
                    : 'bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)]'
                }`}
              >
                {i + 1}
                {isFlagged && <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[var(--c-accent)]" />}
              </button>
            );
          })}
        </div>

        {!showSubmitConfirm ? (
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={submitting}
            className="btn-primary btn-full flex items-center gap-2 justify-center mt-auto"
          >
            {submitting ? <div className="spinner" /> : <><Send size={14} /> Submit Test</>}
          </button>
        ) : (
          <div className="mt-auto flex flex-col gap-2">
            <div className="bg-[var(--c-accent-dim)] border border-[var(--c-accent)]/20 rounded-xl p-3 text-center">
              <AlertTriangle size={18} className="text-[var(--c-accent)] mx-auto mb-1.5" />
              <p className="text-[12px] font-bold text-[var(--c-text)] mb-0.5">Submit Test?</p>
              <p className="text-[11px] text-[var(--c-text-dim)]">
                {total - answered > 0
                  ? `${total - answered} question${total - answered > 1 ? 's' : ''} unanswered`
                  : 'All questions answered'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] text-[var(--c-text-dim)] border border-[var(--c-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 py-2 rounded-xl text-[12px] font-bold bg-[var(--c-error)] hover:bg-red-600 text-white transition-colors flex items-center justify-center gap-1.5 active:scale-95"
              >
                {submitting ? <div className="spinner" /> : <><CheckCircle size={13} /> Confirm</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Question Area */}
      <div className="flex-1 p-8 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="flex-1"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-bold text-[var(--c-text-mute)]">Question {currentIndex + 1}/{total}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  currentQuestion.difficulty === 1 ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]' :
                  currentQuestion.difficulty === 3 ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]' :
                  'bg-[var(--c-accent-dim)] text-[var(--c-accent)]'
                }`}>
                  {currentQuestion.difficulty === 1 ? 'Easy' : currentQuestion.difficulty === 3 ? 'Hard' : 'Medium'}
                </span>
                {currentQuestion.topic && <span className="text-[11px] text-[var(--c-text-mute)]">{currentQuestion.topic}</span>}
              </div>
              <button
                onClick={() => toggleFlag(currentQuestion._id)}
                className={`p-2 rounded-lg transition-colors ${
                  flagged.has(currentQuestion._id)
                    ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)]'
                    : 'text-[var(--c-text-mute)] hover:text-[var(--c-accent)]'
                }`}
              >
                <Flag size={16} />
              </button>
            </div>

            <h2 className="text-lg font-bold text-[var(--c-text)] mb-6 leading-relaxed">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((opt, oi) => {
                const isSelected = answers.get(currentQuestion._id) === oi;
                return (
                  <button
                    key={oi}
                    onClick={() => selectAnswer(currentQuestion._id, oi)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      isSelected
                        ? 'border-[var(--c-accent)] bg-[var(--c-accent-dim)]'
                        : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)]'
                    }`}
                  >
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg mr-3 text-[12px] font-bold ${
                      isSelected
                        ? 'bg-[var(--c-accent)] text-black'
                        : 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)]'
                    }`}>
                      {String.fromCharCode(65 + oi)}
                    </span>
                    <span className={`text-[14px] ${isSelected ? 'text-[var(--c-text)] font-semibold' : 'text-[var(--c-text-dim)]'}`}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--c-border)]">
          <button
            onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
            disabled={currentIndex === 0}
            className="btn-secondary flex items-center gap-2"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-[12px] text-[var(--c-text-mute)]">{answered} of {total} answered</span>
          <button
            onClick={() => setCurrentIndex(i => Math.min(total - 1, i + 1))}
            disabled={currentIndex === total - 1}
            className="btn-secondary flex items-center gap-2"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
    </ProctoringGuard>
  );
}

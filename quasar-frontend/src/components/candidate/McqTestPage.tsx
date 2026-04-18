import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  CheckCircle,
  AlertTriangle,
  Send,
} from "lucide-react";
import { apiPost } from "../../lib/api";
import type { McqTestStartData } from "../../types/recruitment";
import { ProctoringGuard } from "./ProctoringGuard";

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
  const [error, setError] = useState("");
  const [testStarted, setTestStarted] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const submitRef = useRef<() => Promise<void>>(async () => {});

  const startTest = async () => {
    setLoading(true);
    try {
      const res = await apiPost<McqTestStartData>(
        `/api/candidate/applications/${appId}/mcq/start`,
        {},
      );
      if (res.success) {
        setTestData(res.data);
        setTimeLeft(res.data.durationMinutes * 60);
        setTestStarted(true);
      } else {
        setError(res.message || "Failed to start test");
      }
    } catch {
      setError("Failed to start test");
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const selectAnswer = (questionId: string, optionIndex: number) => {
    setAnswers((prev) => new Map(prev).set(questionId, optionIndex));
  };

  const toggleFlag = (questionId: string) => {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const handleSubmit = useCallback(async () => {
    if (!testData || submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current);

    const answerPayload = testData.questions.map((q) => ({
      questionId: q._id,
      selectedOption: answers.get(q._id) ?? -1,
      timeTakenSeconds: 0,
    }));

    try {
      const res = await apiPost<{ passed: boolean; percentage: number }>(
        `/api/candidate/applications/${appId}/mcq/submit`,
        { answers: answerPayload },
      );
      if (res.success) {
        onComplete(res.data);
      } else {
        setError(res.message || "Submission failed");
      }
    } catch {
      setError("Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  }, [testData, answers, appId, onComplete]);

  useEffect(() => {
    submitRef.current = handleSubmit;
  }, [handleSubmit]);

  // Timer
  useEffect(() => {
    if (!testStarted || timeLeft <= 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [testStarted, timeLeft]);

  if (loading && !testStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="w-full max-w-2xl bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-8">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-[var(--c-accent)] mb-3">
            Assessment Round
          </p>
          <h2 className="text-3xl font-black text-[var(--c-text)] mb-3">
            MCQ Challenge
          </h2>
          <p className="text-[var(--c-text-dim)] text-[14px] mb-6">
            Timer starts immediately after launch. Fullscreen, tab focus, and
            visibility checks are active during this round.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7">
            <div className="rounded-2xl bg-[var(--c-bg)] border border-[var(--c-border)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--c-text-mute)]">
                Questions
              </p>
              <p className="text-[18px] font-black text-[var(--c-text)]">
                Dynamic Set
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--c-bg)] border border-[var(--c-border)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--c-text-mute)]">
                Mode
              </p>
              <p className="text-[18px] font-black text-[var(--c-text)]">
                Single Answer
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--c-bg)] border border-[var(--c-border)] p-3">
              <p className="text-[10px] uppercase tracking-wider text-[var(--c-text-mute)]">
                Rules
              </p>
              <p className="text-[18px] font-black text-[var(--c-text)]">
                Secure
              </p>
            </div>
          </div>

          {error && (
            <p className="text-[var(--c-error)] text-[13px] mb-5">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onBack}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)]"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <button
              onClick={startTest}
              className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            >
              Start Test <ChevronRight size={16} />
            </button>
          </div>
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
      <div className="h-screen bg-[var(--c-bg)] overflow-hidden flex flex-col">
        <header className="shrink-0 border-b border-[var(--c-border)] bg-[var(--c-surface)]/95 backdrop-blur px-4 md:px-6 py-3">
          <div className="flex flex-wrap items-center gap-3 justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[var(--c-accent)]">
                MCQ Assessment Round
              </p>
              <p className="text-[14px] font-bold text-[var(--c-text)]">
                Question {currentIndex + 1} of {total}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[12px] font-bold ${
                  isLowTime
                    ? "bg-[var(--c-error-dim)] border-red-500/30 text-[var(--c-error)]"
                    : "bg-[var(--c-surface-2)] border-[var(--c-border)] text-[var(--c-text)]"
                }`}
              >
                <Clock size={13} /> {formatTime(timeLeft)}
              </div>

              {!showSubmitConfirm ? (
                <button
                  onClick={() => setShowSubmitConfirm(true)}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl text-[12px] font-black uppercase tracking-wide bg-[var(--c-accent)] text-black hover:brightness-110 transition-all disabled:opacity-60"
                >
                  Submit Test
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-2 py-1.5">
                  <button
                    onClick={() => setShowSubmitConfirm(false)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="px-3 py-1 rounded-lg text-[11px] font-bold bg-[var(--c-error)] text-white hover:brightness-110"
                  >
                    {submitting ? "Submitting..." : "Confirm"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-semibold text-[var(--c-error)]">
              {error}
            </div>
          )}

          <div className="mt-3 h-1.5 rounded-full bg-[var(--c-surface-3)] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[var(--c-accent)] to-[#fb923c]"
              style={{ width: `${(answered / total) * 100}%` }}
            />
          </div>
        </header>

        <div className="flex-1 min-h-0 p-4 md:p-6">
          <div className="h-full grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
            <section className="min-h-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl flex flex-col overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-[var(--c-border)] flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        currentQuestion.difficulty === 1
                          ? "bg-[var(--c-success-dim)] text-[var(--c-success)]"
                          : currentQuestion.difficulty === 3
                            ? "bg-[var(--c-error-dim)] text-[var(--c-error)]"
                            : "bg-[var(--c-accent-dim)] text-[var(--c-accent)]"
                      }`}
                    >
                      {currentQuestion.difficulty === 1
                        ? "Easy"
                        : currentQuestion.difficulty === 3
                          ? "Hard"
                          : "Medium"}
                    </span>
                    {currentQuestion.topic && (
                      <span className="text-[11px] text-[var(--c-text-mute)] truncate">
                        {currentQuestion.topic}
                      </span>
                    )}
                  </div>
                  <h2 className="text-[18px] md:text-[20px] font-black text-[var(--c-text)] leading-snug">
                    {currentQuestion.question}
                  </h2>
                </div>

                <button
                  onClick={() => toggleFlag(currentQuestion._id)}
                  className={`shrink-0 px-3 py-2 rounded-xl border text-[12px] font-bold flex items-center gap-1.5 ${
                    flagged.has(currentQuestion._id)
                      ? "bg-[var(--c-accent-dim)] text-[var(--c-accent)] border-[var(--c-accent)]/25"
                      : "bg-[var(--c-surface-2)] text-[var(--c-text-dim)] border-[var(--c-border)] hover:text-[var(--c-accent)]"
                  }`}
                >
                  <Flag size={14} />{" "}
                  {flagged.has(currentQuestion._id) ? "Flagged" : "Flag"}
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 py-5 space-y-3">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQuestion._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-3"
                  >
                    {currentQuestion.options.map((opt, oi) => {
                      const isSelected =
                        answers.get(currentQuestion._id) === oi;
                      return (
                        <button
                          key={oi}
                          onClick={() => selectAnswer(currentQuestion._id, oi)}
                          className={`w-full text-left p-4 rounded-2xl border transition-all ${
                            isSelected
                              ? "border-[var(--c-accent)] bg-[var(--c-accent-dim)] shadow-[0_8px_24px_rgba(249,115,22,0.12)]"
                              : "border-[var(--c-border)] bg-[var(--c-bg)] hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)]"
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span
                              className={`inline-flex items-center justify-center w-8 h-8 rounded-xl text-[12px] font-black ${
                                isSelected
                                  ? "bg-[var(--c-accent)] text-black"
                                  : "bg-[var(--c-surface-3)] text-[var(--c-text-mute)]"
                              }`}
                            >
                              {String.fromCharCode(65 + oi)}
                            </span>
                            <span
                              className={`text-[14px] leading-relaxed ${isSelected ? "text-[var(--c-text)] font-semibold" : "text-[var(--c-text-dim)]"}`}
                            >
                              {opt.text}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="shrink-0 border-t border-[var(--c-border)] px-4 md:px-6 py-3 bg-[var(--c-surface)]">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1">
                      <ChevronLeft size={14} /> Previous
                    </span>
                  </button>

                  <span className="text-[12px] text-[var(--c-text-mute)] font-semibold">
                    {answered}/{total} answered
                  </span>

                  <button
                    onClick={() =>
                      setCurrentIndex((i) => Math.min(total - 1, i + 1))
                    }
                    disabled={currentIndex === total - 1}
                    className="px-4 py-2 rounded-xl text-[13px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] disabled:opacity-40"
                  >
                    <span className="inline-flex items-center gap-1">
                      Next <ChevronRight size={14} />
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <aside className="hidden xl:flex min-h-0 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl flex-col overflow-hidden">
              <div className="p-4 border-b border-[var(--c-border)]">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[var(--c-text-mute)] mb-2">
                  Navigator
                </p>
                <div className="grid grid-cols-3 gap-2 text-[12px]">
                  <div className="rounded-xl bg-[var(--c-bg)] border border-[var(--c-border)] p-2 text-center">
                    <p className="text-[10px] text-[var(--c-text-mute)]">
                      Answered
                    </p>
                    <p className="text-[15px] font-black text-[var(--c-success)]">
                      {answered}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--c-bg)] border border-[var(--c-border)] p-2 text-center">
                    <p className="text-[10px] text-[var(--c-text-mute)]">
                      Flagged
                    </p>
                    <p className="text-[15px] font-black text-[var(--c-accent)]">
                      {flagged.size}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--c-bg)] border border-[var(--c-border)] p-2 text-center">
                    <p className="text-[10px] text-[var(--c-text-mute)]">
                      Left
                    </p>
                    <p className="text-[15px] font-black text-[var(--c-text)]">
                      {total - answered}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto p-4">
                <div className="grid grid-cols-5 gap-2">
                  {testData.questions.map((q, i) => {
                    const isAnswered = answers.has(q._id);
                    const isFlagged = flagged.has(q._id);
                    const isCurrent = i === currentIndex;
                    return (
                      <button
                        key={q._id}
                        onClick={() => setCurrentIndex(i)}
                        className={`relative h-10 rounded-xl text-[12px] font-black border transition-all ${
                          isCurrent
                            ? "bg-[var(--c-accent)] text-black border-[var(--c-accent)]"
                            : isAnswered
                              ? "bg-[var(--c-success-dim)] text-[var(--c-success)] border-green-500/25"
                              : "bg-[var(--c-bg)] text-[var(--c-text-mute)] border-[var(--c-border)] hover:text-[var(--c-text)]"
                        }`}
                      >
                        {i + 1}
                        {isFlagged && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-[var(--c-accent)] border border-[var(--c-surface)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {showSubmitConfirm && (
                <div className="m-4 p-3 rounded-2xl border border-[var(--c-accent)]/25 bg-[var(--c-accent-dim)]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle
                      size={16}
                      className="text-[var(--c-accent)] mt-0.5"
                    />
                    <div>
                      <p className="text-[12px] font-bold text-[var(--c-text)]">
                        Ready to submit?
                      </p>
                      <p className="text-[11px] text-[var(--c-text-dim)]">
                        {total - answered > 0
                          ? `${total - answered} unanswered question${total - answered > 1 ? "s" : ""} (will be marked unattempted)`
                          : "All questions answered"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </ProctoringGuard>
  );
}

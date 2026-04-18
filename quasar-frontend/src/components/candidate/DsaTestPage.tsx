import { useState, useEffect, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Code2, Play, Send, CheckCircle2, XCircle, Clock, AlertCircle,
  ChevronLeft, ChevronRight, Loader2, Terminal, Trophy, ArrowLeft,
  Zap, MemoryStick, Timer,
} from 'lucide-react';
import { apiPost } from '../../lib/api';
import type { DsaQuestion, DsaTestStartData, DsaTestCaseResult } from '../../types/recruitment';

interface Props {
  appId: string;
  onComplete: () => void;
  onBack: () => void;
}

const LANG_OPTIONS: { key: string; label: string; monacoLang: string }[] = [
  { key: 'javascript', label: 'JavaScript', monacoLang: 'javascript' },
  { key: 'java', label: 'Java', monacoLang: 'java' },
  { key: 'c', label: 'C', monacoLang: 'c' },
  { key: 'cpp', label: 'C++', monacoLang: 'cpp' },
  { key: 'kotlin', label: 'Kotlin', monacoLang: 'kotlin' },
  { key: 'go', label: 'Go', monacoLang: 'go' },
  { key: 'python', label: 'Python', monacoLang: 'python' },
];

const DIFFICULTY_COLORS = {
  easy: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e', border: 'rgba(34,197,94,0.25)' },
  medium: { bg: 'rgba(249,115,22,0.12)', text: '#f97316', border: 'rgba(249,115,22,0.25)' },
  hard: { bg: 'rgba(239,68,68,0.12)', text: '#ef4444', border: 'rgba(239,68,68,0.25)' },
};

export function DsaTestPage({ appId, onComplete, onBack }: Props) {
  const [testData, setTestData] = useState<DsaTestStartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);

  // Per-question state
  const [codeMap, setCodeMap] = useState<Record<string, string>>({});
  const [langMap, setLangMap] = useState<Record<string, string>>({});
  const [resultMap, setResultMap] = useState<Record<string, { results: DsaTestCaseResult[]; passedCount: number; totalCount: number; score?: number }>>({});
  const [submittedSet, setSubmittedSet] = useState<Set<string>>(new Set());

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showConfirmFinish, setShowConfirmFinish] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [showResults, setShowResults] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start the test
  useEffect(() => {
    apiPost<DsaTestStartData>(`/api/candidate/applications/${appId}/dsa/start`)
      .then(res => {
        if (res.success) {
          setTestData(res.data);
          // Initialize code/lang maps with starter code
          const cMap: Record<string, string> = {};
          const lMap: Record<string, string> = {};
          const defaultLang = res.data.allowedLanguages?.[0] || 'javascript';
          for (const q of res.data.questions) {
            lMap[q._id] = defaultLang;
            cMap[q._id] = q.starterCode?.[defaultLang] || '';
          }
          setCodeMap(cMap);
          setLangMap(lMap);

          // Calculate time left
          const deadline = new Date(res.data.deadline).getTime();
          setTimeLeft(Math.max(0, Math.floor((deadline - Date.now()) / 1000)));
        } else {
          setError(res.message || 'Failed to start DSA test');
        }
      })
      .catch(() => setError('Failed to connect. Please try again.'))
      .finally(() => setLoading(false));
  }, [appId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          // Auto-finish when time runs out
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timeLeft > 0]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  const question = testData?.questions[currentQ];

  const handleLangChange = useCallback((qId: string, lang: string) => {
    setLangMap(prev => ({ ...prev, [qId]: lang }));
    // Set starter code if user hasn't typed anything yet OR if current code is a starter
    setCodeMap(prev => {
      const q = testData?.questions.find(q => q._id === qId);
      const oldLang = langMap[qId] || 'javascript';
      const wasStarter = prev[qId] === (q?.starterCode?.[oldLang] || '') || !prev[qId];
      if (wasStarter) {
        return { ...prev, [qId]: q?.starterCode?.[lang] || '' };
      }
      return prev;
    });
  }, [testData, langMap]);

  // Run code (sample test cases only)
  const handleRun = useCallback(async () => {
    if (!question || running) return;
    setRunning(true);
    setShowResults(true);
    try {
      const res = await apiPost<{ results: DsaTestCaseResult[]; passedCount: number; totalCount: number }>(`/api/candidate/applications/${appId}/dsa/run`, {
        questionId: question._id,
        language: langMap[question._id] || 'javascript',
        code: codeMap[question._id] || '',
      });
      if (res.success) {
        setResultMap(prev => ({ ...prev, [question._id]: res.data }));
      } else {
        setError(res.message || 'Run failed');
      }
    } catch {
      setError('Failed to run code');
    } finally {
      setRunning(false);
    }
  }, [question, appId, langMap, codeMap, running]);

  // Submit solution (all test cases)
  const handleSubmit = useCallback(async () => {
    if (!question || submitting) return;
    setSubmitting(true);
    setShowResults(true);
    try {
      const res = await apiPost<{ results: DsaTestCaseResult[]; passedCount: number; totalCount: number; score: number }>(`/api/candidate/applications/${appId}/dsa/submit`, {
        questionId: question._id,
        language: langMap[question._id] || 'javascript',
        code: codeMap[question._id] || '',
      });
      if (res.success) {
        setResultMap(prev => ({ ...prev, [question._id]: res.data }));
        setSubmittedSet(prev => new Set(prev).add(question._id));
      } else {
        setError(res.message || 'Submit failed');
      }
    } catch {
      setError('Failed to submit solution');
    } finally {
      setSubmitting(false);
    }
  }, [question, appId, langMap, codeMap, submitting]);

  // Finish test
  const handleFinish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    try {
      await apiPost(`/api/candidate/applications/${appId}/dsa/complete`);
      onComplete();
    } catch {
      setError('Failed to finish test');
      setFinishing(false);
    }
  }, [appId, finishing, onComplete]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="bg-blob bg-blob--1" aria-hidden="true" />
        <div className="bg-blob bg-blob--2" aria-hidden="true" />
        <Loader2 size={36} className="text-[var(--c-accent)] animate-spin mb-4" />
        <p className="text-[var(--c-text-dim)] text-[14px] font-medium">Loading DSA Challenge...</p>
      </div>
    );
  }

  if (error && !testData) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[var(--bg-app)]">
        <div className="bg-blob bg-blob--1" aria-hidden="true" />
        <AlertCircle size={48} className="text-[var(--c-error)] mb-4" />
        <p className="text-[var(--c-text)] text-[16px] font-bold mb-2">Cannot Start Test</p>
        <p className="text-[var(--c-text-dim)] text-[14px] max-w-md text-center">{error}</p>
        <button onClick={onBack} className="mt-6 flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold text-[var(--c-text)] bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] transition-colors">
          <ArrowLeft size={14} /> Go Back
        </button>
      </div>
    );
  }

  if (!testData || !question) return null;

  const qDiffColors = DIFFICULTY_COLORS[question.difficulty] || DIFFICULTY_COLORS.easy;
  const allowedLangs = LANG_OPTIONS.filter(l => testData.allowedLanguages.includes(l.key));
  const currentLang = langMap[question._id] || 'javascript';
  const currentCode = codeMap[question._id] || '';
  const currentResult = resultMap[question._id];
  const isTimeLow = timeLeft < 300 && timeLeft > 0; // < 5 min

  return (
    <div className="flex flex-col h-screen w-full bg-[#0e0e11] overflow-hidden">
      {/* ── Header Bar ── */}
      <div className="flex items-center justify-between h-[52px] px-4 bg-[#16161a] border-b border-[#2a2a33] shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-500/10 border border-violet-500/20 text-violet-400 text-[10px] font-bold uppercase tracking-widest rounded-full">
            <Code2 size={12} strokeWidth={2.5} />
            DSA Challenge
          </div>
          <span className="text-[13px] font-bold text-[#e4e4e7]">
            {currentQ + 1}/{testData.questions.length} Problems
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Timer */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-bold tracking-wide ${isTimeLow ? 'bg-red-500/15 text-red-400 animate-pulse' : 'bg-[#1f1f26] text-[#a1a1aa]'} border border-[#2a2a33]`}>
            <Timer size={14} strokeWidth={2.5} />
            {formatTime(timeLeft)}
          </div>

          {/* Finish button */}
          <AnimatePresence mode="wait">
            {!showConfirmFinish ? (
              <motion.button
                key="finish"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowConfirmFinish(true)}
                className="px-4 py-1.5 rounded-lg text-[12px] font-bold text-[#a1a1aa] hover:text-white bg-[#1f1f26] hover:bg-[#2a2a33] border border-[#2a2a33] transition-all"
              >
                Finish Test
              </motion.button>
            ) : (
              <motion.div
                key="confirm"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="flex items-center gap-2 bg-[#1f1f26] border border-[#2a2a33] rounded-lg p-1 pl-3"
              >
                <span className="text-[12px] font-bold text-[#e4e4e7]">Submit all & finish?</span>
                <button onClick={() => setShowConfirmFinish(false)} className="px-3 py-1 rounded-md text-[12px] font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#2a2a33] transition-colors">No</button>
                <button onClick={handleFinish} disabled={finishing} className="flex items-center gap-1 px-3 py-1 rounded-md text-[12px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50">
                  {finishing ? <Loader2 size={12} className="animate-spin" /> : <Trophy size={12} />} Yes, Finish
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Main Content: Three Panel Split ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left: Question List Sidebar ── */}
        <div className="w-[56px] bg-[#13131a] border-r border-[#2a2a33] flex flex-col items-center py-3 gap-1.5 shrink-0 overflow-y-auto">
          {testData.questions.map((q, i) => {
            const diff = DIFFICULTY_COLORS[q.difficulty];
            const isActive = i === currentQ;
            const isSubmitted = submittedSet.has(q._id);
            return (
              <button
                key={q._id}
                onClick={() => { setCurrentQ(i); setShowResults(false); }}
                className={`relative flex items-center justify-center w-[40px] h-[40px] rounded-xl text-[13px] font-bold transition-all border ${isActive ? 'text-white border-violet-500/50 shadow-[0_0_16px_rgba(139,92,246,0.2)]' : 'text-[#a1a1aa] border-transparent hover:border-[#2a2a33] hover:bg-[#1f1f26]'}`}
                style={isActive ? { background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.05))' } : {}}
                title={`${q.title} (${q.difficulty})`}
              >
                {i + 1}
                {/* Difficulty dot */}
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full" style={{ background: diff.text }} />
                {/* Submitted check */}
                {isSubmitted && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <CheckCircle2 size={8} className="text-white" />
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Center: Problem Description ── */}
        <div className="w-[380px] lg:w-[420px] flex flex-col bg-[#16161a] border-r border-[#2a2a33] shrink-0 overflow-hidden">
          {/* Problem header */}
          <div className="p-5 pb-3 border-b border-[#2a2a33]">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider" style={{ background: qDiffColors.bg, color: qDiffColors.text, border: `1px solid ${qDiffColors.border}` }}>
                {question.difficulty}
              </span>
              <span className="text-[11px] text-[#71717a] font-medium">{question.domain}</span>
            </div>
            <h2 className="text-[17px] font-bold text-[#e4e4e7] leading-tight">{question.title}</h2>
          </div>

          {/* Problem body — scrollable */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar">
            {/* Description */}
            <div className="text-[13px] leading-relaxed text-[#d4d4d8] whitespace-pre-wrap">
              {question.description}
            </div>

            {/* Constraints */}
            {question.constraints && (
              <div className="bg-[#1f1f26] rounded-xl p-3 border border-[#2a2a33]">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] mb-1.5">Constraints</p>
                <pre className="text-[12px] text-[#a1a1aa] whitespace-pre-wrap font-mono">{question.constraints}</pre>
              </div>
            )}

            {/* Sample I/O */}
            <div className="space-y-3">
              {question.sampleInput && (
                <div className="bg-[#1f1f26] rounded-xl p-3 border border-[#2a2a33]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] mb-1.5">Sample Input</p>
                  <pre className="text-[12px] text-[#d4d4d8] whitespace-pre-wrap font-mono">{question.sampleInput}</pre>
                </div>
              )}
              {question.sampleOutput && (
                <div className="bg-[#1f1f26] rounded-xl p-3 border border-[#2a2a33]">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#71717a] mb-1.5">Sample Output</p>
                  <pre className="text-[12px] text-[#d4d4d8] whitespace-pre-wrap font-mono">{question.sampleOutput}</pre>
                </div>
              )}
            </div>

            {/* Tags */}
            {question.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {question.tags.map(tag => (
                  <span key={tag} className="px-2 py-0.5 rounded-md text-[10px] font-semibold text-[#71717a] bg-[#1f1f26] border border-[#2a2a33]">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Problem navigation */}
          <div className="flex items-center justify-between p-3 border-t border-[#2a2a33]">
            <button
              disabled={currentQ === 0}
              onClick={() => { setCurrentQ(prev => prev - 1); setShowResults(false); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#1f1f26] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              disabled={currentQ === testData.questions.length - 1}
              onClick={() => { setCurrentQ(prev => prev + 1); setShowResults(false); }}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#a1a1aa] hover:text-white hover:bg-[#1f1f26] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* ── Right: Code Editor + Results ── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Language tabs */}
          <div className="flex items-center gap-1 px-3 py-2 bg-[#16161a] border-b border-[#2a2a33] overflow-x-auto custom-scrollbar shrink-0">
            {allowedLangs.map(lang => (
              <button
                key={lang.key}
                onClick={() => handleLangChange(question._id, lang.key)}
                className={`px-3 py-1.5 text-[12px] font-bold rounded-md transition-all whitespace-nowrap shrink-0 ${currentLang === lang.key
                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                    : 'text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#1f1f26] border border-transparent'
                  }`}
              >
                {lang.label}
              </button>
            ))}
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-h-0 bg-[#1e1e1e] relative">
            <Editor
              height="100%"
              language={LANG_OPTIONS.find(l => l.key === currentLang)?.monacoLang || 'javascript'}
              value={currentCode}
              onChange={(val) => setCodeMap(prev => ({ ...prev, [question._id]: val ?? '' }))}
              theme="vs-dark"
              options={{
                fontSize: 14,
                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: 'on',
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'line',
                cursorBlinking: 'smooth',
                smoothScrolling: true,
                automaticLayout: true,
                tabSize: 4,
                wordWrap: 'on',
              }}
            />
          </div>

          {/* Results panel (collapsible) */}
          <AnimatePresence>
            {showResults && currentResult && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1, maxHeight: '35vh' }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-[#13131a] border-t border-[#2a2a33] overflow-y-auto custom-scrollbar"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Terminal size={14} className="text-[#71717a]" />
                    <span className="text-[12px] font-bold text-[#a1a1aa]">
                      Test Results: {currentResult.passedCount}/{currentResult.totalCount} passed
                    </span>
                    {currentResult.score !== undefined && (
                      <span className="ml-auto text-[12px] font-bold" style={{ color: currentResult.score >= 60 ? '#22c55e' : '#ef4444' }}>
                        Score: {currentResult.score}%
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {currentResult.results.map((r, i) => (
                      <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${r.passed ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-red-500/5 border-red-500/15'}`}>
                        <div className="flex-shrink-0 mt-0.5">
                          {r.passed
                            ? <CheckCircle2 size={14} className="text-emerald-400" />
                            : <XCircle size={14} className="text-red-400" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-[12px] font-bold text-[#e4e4e7]">
                              Test Case {i + 1}
                            </span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${r.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                              {r.status}
                            </span>
                            {r.isHidden && (
                              <span className="text-[10px] font-semibold text-[#71717a] bg-[#1f1f26] px-1.5 py-0.5 rounded">Hidden</span>
                            )}
                          </div>
                          {!r.isHidden && (
                            <div className="grid grid-cols-3 gap-2 text-[11px] font-mono">
                              <div>
                                <p className="text-[10px] font-bold text-[#71717a] mb-0.5">Input</p>
                                <pre className="text-[#a1a1aa] whitespace-pre-wrap break-all">{r.input || '(empty)'}</pre>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#71717a] mb-0.5">Expected</p>
                                <pre className="text-[#a1a1aa] whitespace-pre-wrap break-all">{r.expected}</pre>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-[#71717a] mb-0.5">Your Output</p>
                                <pre className={`whitespace-pre-wrap break-all ${r.passed ? 'text-emerald-400' : 'text-red-400'}`}>{r.actual}</pre>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-4 mt-1.5 text-[10px] text-[#71717a]">
                            <span className="flex items-center gap-1"><Zap size={10} />{r.time?.toFixed(0) || 0}ms</span>
                            <span className="flex items-center gap-1"><MemoryStick size={10} />{(r.memory / 1024).toFixed(1) || 0}MB</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Action bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-[#16161a] border-t border-[#2a2a33] shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowResults(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-[#71717a] hover:text-[#a1a1aa] hover:bg-[#1f1f26] border border-[#2a2a33] transition-colors"
              >
                <Terminal size={13} /> {showResults ? 'Hide' : 'Show'} Results
              </button>
              {submittedSet.has(question._id) && (
                <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                  <CheckCircle2 size={12} /> Submitted
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Run (sample tests only) */}
              <button
                onClick={handleRun}
                disabled={running || !currentCode.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-[#e4e4e7] bg-[#1f1f26] hover:bg-[#2a2a33] border border-[#2a2a33] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                Run
              </button>

              {/* Submit (all test cases) */}
              <button
                onClick={handleSubmit}
                disabled={submitting || !currentCode.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 shadow-[0_4px_12px_rgba(139,92,246,0.25)] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Submit
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error toast */}
      <AnimatePresence>
        {error && testData && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-[13px] font-semibold shadow-xl backdrop-blur-md z-50"
          >
            <AlertCircle size={16} />
            {error}
            <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-white text-[12px] font-bold">✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

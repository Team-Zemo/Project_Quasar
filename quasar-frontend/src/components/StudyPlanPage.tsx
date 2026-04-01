import { useState, useRef, useCallback } from 'react';
import { apiFetchRaw } from '../lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Clock, Layers, Target, Sparkles, ChevronRight,
  Download, RotateCcw, X, Plus, Loader2, AlertCircle,
  GraduationCap, Calendar,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlanForm {
  skillToLearn: string;
  techStack: string[];
  weeks: number;
  currentLevel: string;
  dailyHours: number;
  goals: string;
}

type PlanState = 'idle' | 'streaming' | 'done' | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_OPTIONS = [
  { value: '', label: 'Select level (optional)' },
  { value: 'Complete Beginner', label: '🌱 Complete Beginner' },
  { value: 'Beginner', label: '🪴 Beginner' },
  { value: 'Intermediate', label: '🌿 Intermediate' },
  { value: 'Advanced', label: '🌳 Advanced' },
];

const PRESET_STACKS = [
  'React', 'Node.js', 'Python', 'TypeScript', 'MongoDB', 'PostgreSQL',
  'Docker', 'AWS', 'GraphQL', 'Next.js', 'Vue.js', 'Java', 'Go', 'Rust',
];

const INITIAL_FORM: PlanForm = {
  skillToLearn: '',
  techStack: [],
  weeks: 4,
  currentLevel: '',
  dailyHours: 2,
  goals: '',
};

// ─── Markdown prose styles (reused from CoachChat) ────────────────────────────
const PROSE_CLASSES = `
  text-[15px] leading-relaxed
  [&_p]:mb-4 [&_p:last-child]:mb-0
  [&_h1]:text-[24px] [&_h1]:font-extrabold [&_h1]:mb-5 [&_h1]:mt-2 [&_h1]:text-[var(--c-text)] [&_h1]:tracking-tight
  [&_h2]:text-[19px] [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[var(--c-text)]
  [&_h3]:text-[16px] [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[var(--c-accent)]
  [&_h4]:text-[14px] [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-[var(--c-text-dim)]
  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
  [&_li]:mb-1.5 [&_li::marker]:text-[var(--c-accent)]
  [&_strong]:font-bold [&_strong]:text-[var(--c-text)]
  [&_a]:text-orange-400 [&_a]:underline [&_a:hover]:text-orange-300
  [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--c-accent)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--c-text-dim)] [&_blockquote]:my-4
  [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--c-surface-3)] [&_code]:text-orange-300 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md
  [&_pre]:bg-[#0d0d12] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:border [&_pre]:border-[var(--c-border)]
  [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-[#a9b1d6]
  [&_table]:w-full [&_table]:mb-6 [&_table]:border-collapse [&_table]:text-[14px]
  [&_thead]:bg-[var(--c-surface-2)]
  [&_th]:text-left [&_th]:border [&_th]:border-[var(--c-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-[var(--c-text)] [&_th]:font-bold
  [&_td]:border [&_td]:border-[var(--c-border)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[var(--c-text-dim)]
  [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[var(--c-border-2)] [&_hr]:my-8
  [&_input[type=checkbox]]:accent-orange-500
`.trim().replace(/\s+/g, ' ');

// ─── Component ────────────────────────────────────────────────────────────────
export function StudyPlanPage() {
  const [form, setForm] = useState<PlanForm>(INITIAL_FORM);
  const [tagInput, setTagInput] = useState('');
  const [planState, setPlanState] = useState<PlanState>('idle');
  const [planContent, setPlanContent] = useState('');
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  // ── Tag management ──────────────────────────────────────────────────────────
  const addTag = useCallback((tag: string) => {
    const clean = tag.trim();
    if (!clean || form.techStack.includes(clean)) return;
    setForm(f => ({ ...f, techStack: [...f.techStack, clean] }));
    setTagInput('');
  }, [form.techStack]);

  const removeTag = useCallback((tag: string) => {
    setForm(f => ({ ...f, techStack: f.techStack.filter(t => t !== tag) }));
  }, []);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === 'Backspace' && !tagInput && form.techStack.length > 0) {
      setForm(f => ({ ...f, techStack: f.techStack.slice(0, -1) }));
    }
  };

  // ── Form helpers ────────────────────────────────────────────────────────────
  const isFormValid = form.skillToLearn.trim().length > 0 && form.techStack.length > 0;

  const resetForm = () => {
    abortRef.current?.abort();
    setPlanState('idle');
    setPlanContent('');
    setError('');
    setForm(INITIAL_FORM);
    setTagInput('');
  };

  // ── Generate plan ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!isFormValid || planState === 'streaming') return;

    setPlanState('streaming');
    setPlanContent('');
    setError('');

    try {
      abortRef.current = new AbortController();

      const res = await apiFetchRaw('/api/study-plan/generate', {
        method: 'POST',
        body: JSON.stringify({
          skillToLearn: form.skillToLearn.trim(),
          techStack: form.techStack,
          weeks: form.weeks,
          currentLevel: form.currentLevel || undefined,
          dailyHours: form.dailyHours,
          goals: form.goals.trim() || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            const payload = line.slice(6);
            if (payload === '[DONE]') continue;
            try {
              const parsed = JSON.parse(payload);
              if (parsed.content) {
                accumulated += parsed.content;
                setPlanContent(accumulated);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch {
              // skip malformed chunks
            }
          }
        }
      }

      setPlanState('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError('Failed to generate study plan. Please try again.');
      setPlanState('error');
    }
  };

  // ── Download plan ───────────────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([planContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const slug = form.skillToLearn.toLowerCase().replace(/\s+/g, '-');
    a.href = url;
    a.download = `study-plan-${slug}-${form.weeks}w.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showPlan = planState === 'streaming' || planState === 'done';

  return (
    <div className="w-full max-w-[900px] mx-auto px-4 pb-16">

      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="pt-8 pb-6"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 shadow-[0_4px_16px_rgba(249,115,22,0.35)] shrink-0">
            <GraduationCap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h1 className="text-[26px] font-black tracking-tight text-[var(--c-text)] leading-none">
              Study Plan Generator
            </h1>
            <p className="text-[13px] text-[var(--c-text-dim)] mt-0.5">
              AI-generated, week-by-week learning roadmaps tailored to you
            </p>
          </div>
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── Form view ──────────────────────────────────────────────────────── */}
        {!showPlan && (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-5"
          >
            {/* Required fields card */}
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-[13px] font-black uppercase tracking-widest text-[var(--c-accent)] mb-5">
                Required
              </h2>

              <div className="flex flex-col gap-5">
                {/* Skill to learn */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                    <Target size={14} className="text-orange-500" strokeWidth={2.5} />
                    What do you want to learn?
                  </label>
                  <input
                    id="skill-input"
                    type="text"
                    className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[15px] text-[var(--c-text)] placeholder:text-[var(--c-text-mute)] outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 transition-all"
                    placeholder="e.g. Full-Stack Web Development, Machine Learning, System Design…"
                    value={form.skillToLearn}
                    onChange={e => setForm(f => ({ ...f, skillToLearn: e.target.value }))}
                  />
                </div>

                {/* Tech stack */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                    <Layers size={14} className="text-orange-500" strokeWidth={2.5} />
                    Tech stack / tools
                  </label>

                  {/* Tag input */}
                  <div
                    className="flex flex-wrap gap-2 w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 focus-within:border-orange-500/60 focus-within:ring-2 focus-within:ring-orange-500/10 transition-all cursor-text min-h-[48px]"
                    onClick={() => document.getElementById('tag-input')?.focus()}
                  >
                    {form.techStack.map(tag => (
                      <span
                        key={tag}
                        className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[12px] font-bold rounded-lg shrink-0"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); removeTag(tag); }}
                          className="text-orange-400/60 hover:text-orange-400 transition-colors"
                        >
                          <X size={11} strokeWidth={3} />
                        </button>
                      </span>
                    ))}
                    <input
                      id="tag-input"
                      type="text"
                      className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-text-mute)] py-0.5"
                      placeholder={form.techStack.length === 0 ? 'Type a technology and press Enter…' : 'Add more…'}
                      value={tagInput}
                      onChange={e => setTagInput(e.target.value)}
                      onKeyDown={handleTagKeyDown}
                      onBlur={() => tagInput.trim() && addTag(tagInput)}
                    />
                  </div>

                  {/* Preset chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_STACKS.filter(s => !form.techStack.includes(s)).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => addTag(s)}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[var(--c-text-dim)] bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-lg hover:border-orange-500/40 hover:text-orange-400 transition-all"
                      >
                        <Plus size={9} strokeWidth={3} />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Weeks */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                      <Calendar size={14} className="text-orange-500" strokeWidth={2.5} />
                      Duration
                    </span>
                    <span className="text-[15px] font-black text-[var(--c-accent)]">
                      {form.weeks} {form.weeks === 1 ? 'week' : 'weeks'}
                    </span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={24}
                    step={1}
                    value={form.weeks}
                    onChange={e => setForm(f => ({ ...f, weeks: Number(e.target.value) }))}
                    className="w-full h-2 accent-orange-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[11px] text-[var(--c-text-mute)] font-medium">
                    <span>1 week</span>
                    <span>6 months</span>
                    <span>24 weeks</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Optional fields card */}
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm">
              <h2 className="text-[13px] font-black uppercase tracking-widest text-[var(--c-text-mute)] mb-5">
                Optional — helps personalize the plan
              </h2>

              <div className="flex flex-col gap-5">
                {/* Level + Daily hours in a row */}
                <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                      <BookOpen size={14} className="text-[var(--c-text-mute)]" strokeWidth={2.5} />
                      Current level
                    </label>
                    <select
                      className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[14px] text-[var(--c-text)] outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 transition-all appearance-none cursor-pointer"
                      value={form.currentLevel}
                      onChange={e => setForm(f => ({ ...f, currentLevel: e.target.value }))}
                    >
                      {LEVEL_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                        <Clock size={14} className="text-[var(--c-text-mute)]" strokeWidth={2.5} />
                        Daily study hours
                      </span>
                      <span className="text-[13px] font-bold text-[var(--c-text-dim)]">
                        {form.dailyHours}h / day
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.5}
                      value={form.dailyHours}
                      onChange={e => setForm(f => ({ ...f, dailyHours: Number(e.target.value) }))}
                      className="mt-2 w-full h-2 accent-orange-500 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-[var(--c-text-mute)] font-medium">
                      <span>30 min</span>
                      <span>4h</span>
                      <span>8h</span>
                    </div>
                  </div>
                </div>

                {/* Goals */}
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-2 text-[13px] font-bold text-[var(--c-text)]">
                    <Sparkles size={14} className="text-[var(--c-text-mute)]" strokeWidth={2.5} />
                    Goals / additional context
                  </label>
                  <textarea
                    className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl px-4 py-3 text-[14px] text-[var(--c-text)] placeholder:text-[var(--c-text-mute)] outline-none focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10 transition-all resize-none"
                    rows={3}
                    placeholder="e.g. Preparing for a FAANG interview in 3 months. I know Python basics but want to master DSA and system design…"
                    value={form.goals}
                    onChange={e => setForm(f => ({ ...f, goals: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            {/* Error state */}
            {planState === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[13px] text-red-400"
              >
                <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
                {error}
              </motion.div>
            )}

            {/* Generate button */}
            <button
              id="generate-plan-btn"
              disabled={!isFormValid}
              onClick={handleGenerate}
              className={`flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl text-[15px] font-black tracking-wide transition-all ${
                isFormValid
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_4px_20px_rgba(249,115,22,0.35)] hover:shadow-[0_6px_28px_rgba(249,115,22,0.45)] hover:-translate-y-0.5 active:scale-[0.98]'
                  : 'bg-[var(--c-surface-2)] text-[var(--c-text-mute)] cursor-not-allowed border border-[var(--c-border)]'
              }`}
            >
              <Sparkles size={18} strokeWidth={2.5} />
              Generate My Study Plan
              {isFormValid && <ChevronRight size={18} strokeWidth={2.5} />}
            </button>

            <p className="text-center text-[12px] text-[var(--c-text-mute)]">
              Plan is generated using AI. Review and adapt to your specific context.
            </p>
          </motion.div>
        )}

        {/* ── Plan view (streaming / done) ────────────────────────────────────── */}
        {showPlan && (
          <motion.div
            key="plan"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-4"
          >
            {/* Plan toolbar */}
            <div className="flex items-center justify-between gap-3 p-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl shadow-sm">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/20 shrink-0">
                  <GraduationCap size={16} className="text-orange-400" strokeWidth={2.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-[14px] font-black text-[var(--c-text)] truncate">{form.skillToLearn}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
                      {form.weeks}-week plan
                    </span>
                    {form.techStack.slice(0, 3).map(t => (
                      <span key={t} className="text-[10px] font-bold px-2 py-0.5 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-full text-[var(--c-text-dim)]">
                        {t}
                      </span>
                    ))}
                    {form.techStack.length > 3 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-full text-[var(--c-text-dim)]">
                        +{form.techStack.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {planState === 'streaming' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl text-[12px] font-bold text-orange-400">
                    <Loader2 size={13} className="animate-spin" />
                    Generating…
                  </div>
                )}
                {planState === 'done' && (
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[12px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:border-[var(--c-border-2)] transition-all"
                  >
                    <Download size={13} strokeWidth={2.5} />
                    Download .md
                  </button>
                )}
                <button
                  onClick={resetForm}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[12px] font-bold text-[var(--c-text-dim)] hover:text-[var(--c-text)] hover:border-[var(--c-border-2)] transition-all"
                >
                  <RotateCcw size={13} strokeWidth={2.5} />
                  New Plan
                </button>
              </div>
            </div>

            {/* Markdown output */}
            <div
              ref={planRef}
              className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 md:p-8 shadow-sm min-h-[200px]"
            >
              {planContent ? (
                <div className={PROSE_CLASSES}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {planContent}
                  </ReactMarkdown>
                  {/* Blinking cursor while streaming */}
                  {planState === 'streaming' && (
                    <span className="inline-block w-[2px] h-[18px] bg-orange-400 ml-0.5 align-middle animate-[pulse_0.8s_ease-in-out_infinite]" />
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full border-4 border-[var(--c-surface-3)] border-t-orange-500 animate-spin" />
                    <Sparkles size={18} className="absolute inset-0 m-auto text-orange-500" />
                  </div>
                  <p className="text-[14px] text-[var(--c-text-dim)] font-medium">
                    Crafting your personalized study plan…
                  </p>
                  <p className="text-[12px] text-[var(--c-text-mute)]">
                    This usually takes 10–20 seconds
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

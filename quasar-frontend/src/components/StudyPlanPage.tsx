import { useState, useRef, useCallback, type CSSProperties } from "react";
import { apiFetchRaw } from "../lib/api";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen,
  Clock,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PlanForm {
  skillToLearn: string;
  techStack: string[];
  weeks: number;
  currentLevel: string;
  dailyHours: number;
  goals: string;
}

type PlanState = "idle" | "streaming" | "done" | "error";

// ─── Constants ────────────────────────────────────────────────────────────────
const LEVEL_OPTIONS = [
  { value: "", label: "Select level (optional)" },
  { value: "Complete Beginner", label: "🌱 Complete Beginner" },
  { value: "Beginner", label: "🪴 Beginner" },
  { value: "Intermediate", label: "🌿 Intermediate" },
  { value: "Advanced", label: "🌳 Advanced" },
];

const PRESET_STACKS = [
  "React",
  "Node.js",
  "Python",
  "TypeScript",
  "MongoDB",
  "PostgreSQL",
  "Docker",
  "AWS",
  "GraphQL",
  "Next.js",
  "Vue.js",
  "Java",
  "Go",
  "Rust",
];

const INITIAL_FORM: PlanForm = {
  skillToLearn: "",
  techStack: [],
  weeks: 4,
  currentLevel: "",
  dailyHours: 2,
  goals: "",
};

const STUDY_PLAN_THEME: CSSProperties = {
  "--sp-bg": "#080810",
  "--sp-surface": "#10111c",
  "--sp-surface-soft": "#171a2a",
  "--sp-border": "rgba(255, 255, 255, 0.09)",
  "--sp-text": "#f2f4fb",
  "--sp-text-soft": "rgba(242, 244, 251, 0.72)",
  "--sp-text-mute": "rgba(242, 244, 251, 0.45)",
  "--sp-accent": "#f97316",
  "--sp-accent-soft": "rgba(249, 115, 22, 0.14)",
  "--sp-shadow": "0 24px 50px rgba(0, 0, 0, 0.35)",
} as CSSProperties;

// ─── Markdown prose styles (reused from CoachChat) ────────────────────────────
const PROSE_CLASSES = `
  text-[15px] leading-relaxed text-[var(--sp-text-soft)]
  [&_p]:mb-4 [&_p:last-child]:mb-0
  [&_h1]:text-[30px] [&_h1]:font-black [&_h1]:mb-5 [&_h1]:mt-2 [&_h1]:text-[var(--sp-text)] [&_h1]:tracking-tight
  [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-[var(--sp-text)]
  [&_h3]:text-[17px] [&_h3]:font-bold [&_h3]:mb-2 [&_h3]:mt-6 [&_h3]:text-[var(--sp-accent)]
  [&_h4]:text-[14px] [&_h4]:font-bold [&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-[var(--sp-text-soft)]
  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4
  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4
  [&_li]:mb-1.5 [&_li::marker]:text-[var(--sp-accent)]
  [&_strong]:font-bold [&_strong]:text-[var(--sp-text)]
  [&_a]:text-[#ff934c] [&_a]:underline [&_a:hover]:text-[#ffb27f]
  [&_blockquote]:border-l-[3px] [&_blockquote]:border-[var(--sp-accent)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--sp-text-soft)] [&_blockquote]:my-4
  [&_code]:font-mono [&_code]:text-[13px] [&_code]:bg-[var(--sp-surface-soft)] [&_code]:text-[#ff9c63] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md
  [&_pre]:bg-[#0d101a] [&_pre]:p-4 [&_pre]:rounded-xl [&_pre]:overflow-x-auto [&_pre]:mb-4 [&_pre]:border [&_pre]:border-[var(--sp-border)]
  [&_pre_code]:bg-transparent [&_pre_code]:px-0 [&_pre_code]:py-0 [&_pre_code]:text-[#d8deea]
  [&_table]:w-full [&_table]:mb-6 [&_table]:border-collapse [&_table]:text-[14px]
  [&_thead]:bg-[var(--sp-surface-soft)]
  [&_th]:text-left [&_th]:border [&_th]:border-[var(--sp-border)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-[var(--sp-text)] [&_th]:font-bold
  [&_td]:border [&_td]:border-[var(--sp-border)] [&_td]:px-3 [&_td]:py-2 [&_td]:text-[var(--sp-text-soft)]
  [&_hr]:border-none [&_hr]:border-t [&_hr]:border-[var(--sp-border)] [&_hr]:my-8
  [&_input[type=checkbox]]:accent-orange-500
`
  .trim()
  .replace(/\s+/g, " ");

// ─── Component ────────────────────────────────────────────────────────────────
export function StudyPlanPage() {
  const [form, setForm] = useState<PlanForm>(INITIAL_FORM);
  const [tagInput, setTagInput] = useState("");
  const [planState, setPlanState] = useState<PlanState>("idle");
  const [planContent, setPlanContent] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const planRef = useRef<HTMLDivElement>(null);

  // ── Tag management ──────────────────────────────────────────────────────────
  const addTag = useCallback(
    (tag: string) => {
      const clean = tag.trim();
      if (!clean || form.techStack.includes(clean)) return;
      setForm((f) => ({ ...f, techStack: [...f.techStack, clean] }));
      setTagInput("");
    },
    [form.techStack],
  );

  const removeTag = useCallback((tag: string) => {
    setForm((f) => ({ ...f, techStack: f.techStack.filter((t) => t !== tag) }));
  }, []);

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    }
    if (e.key === "Backspace" && !tagInput && form.techStack.length > 0) {
      setForm((f) => ({ ...f, techStack: f.techStack.slice(0, -1) }));
    }
  };

  // ── Form helpers ────────────────────────────────────────────────────────────
  const isFormValid =
    form.skillToLearn.trim().length > 0 && form.techStack.length > 0;

  const resetForm = () => {
    abortRef.current?.abort();
    setPlanState("idle");
    setPlanContent("");
    setError("");
    setForm(INITIAL_FORM);
    setTagInput("");
  };

  // ── Generate plan ───────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!isFormValid || planState === "streaming") return;

    setPlanState("streaming");
    setPlanContent("");
    setError("");

    try {
      abortRef.current = new AbortController();

      const res = await apiFetchRaw("/api/study-plan/generate", {
        method: "POST",
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
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          for (const line of text.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
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

      setPlanState("done");
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError("Failed to generate study plan. Please try again.");
      setPlanState("error");
    }
  };

  // ── Download plan ───────────────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([planContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const slug = form.skillToLearn.toLowerCase().replace(/\s+/g, "-");
    a.href = url;
    a.download = `study-plan-${slug}-${form.weeks}w.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const showPlan = planState === "streaming" || planState === "done";

  return (
    <div style={STUDY_PLAN_THEME} className="w-full  pb-16">
      <div className="mx-auto max-w-[1180px] px-4 md:px-6">
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-8 pb-7"
        >
          <article className="md:col-span-7 p-6 md:p-8">
            <h1 className="mt-4 text-[44px] leading-[1.02] font-black tracking-tight text-[var(--sp-text)] md:text-[64px]">
              Build a clear path. Move week by week.
            </h1>
            <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-[var(--sp-text-soft)]">
              Tell us what you want to learn, set your pace, and get one focused
              roadmap that keeps each week intentional and practical.
            </p>
          </article>

          <article className="md:col-span-5 p-4">
            <img
              src="/ui/plan.svg"
              alt="Study planning illustration"
              className="h-[260px] w-full rounded-[22px] object-contain p-3 md:h-[280px]"
            />
          </article>
        </motion.section>

        <AnimatePresence mode="wait">
          {!showPlan && (
            <motion.section
              key="form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-4"
            >
              <article className="md:col-span-7 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 md:p-7 shadow-[var(--sp-shadow)]">
                <h2 className="text-[25px] font-black tracking-tight text-[var(--sp-text)]">
                  1. Define your learning target
                </h2>
                <p className="mt-1 text-[13px] text-[var(--sp-text-soft)]">
                  One goal. One stack. Clear direction.
                </p>

                <div className="mt-6 space-y-6">
                  <div className="space-y-2">
                    <label className="text-[13px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                      What do you want to learn?
                    </label>
                    <input
                      id="skill-input"
                      type="text"
                      className="w-full rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-4 py-3.5 text-[15px] font-medium text-[var(--sp-text)] outline-none transition-all placeholder:text-[var(--sp-text-mute)] focus:border-[var(--sp-accent)] focus:ring-4 focus:ring-orange-500/20"
                      placeholder="e.g. Full-Stack Web Development, Machine Learning, System Design"
                      value={form.skillToLearn}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, skillToLearn: e.target.value }))
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="text-[13px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                      Tech stack and tools
                    </label>
                    <div
                      className="min-h-[52px] w-full cursor-text rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-2.5 transition-all focus-within:border-[var(--sp-accent)] focus-within:ring-4 focus-within:ring-orange-500/20"
                      onClick={() =>
                        document.getElementById("tag-input")?.focus()
                      }
                    >
                      <div className="flex flex-wrap gap-2">
                        {form.techStack.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1.5 rounded-full border border-[#66301a] bg-[var(--sp-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[#ffb07f]"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                removeTag(tag);
                              }}
                              className="text-[#ff934c] transition-colors hover:text-[#ffb98f]"
                              aria-label={`Remove ${tag}`}
                            >
                              <X size={12} strokeWidth={2.8} />
                            </button>
                          </span>
                        ))}
                        <input
                          id="tag-input"
                          type="text"
                          className="min-w-[130px] flex-1 border-none bg-transparent py-1 text-[14px] text-[var(--sp-text)] outline-none placeholder:text-[var(--sp-text-mute)]"
                          placeholder={
                            form.techStack.length === 0
                              ? "Type a technology and press Enter"
                              : "Add one more"
                          }
                          value={tagInput}
                          onChange={(e) => setTagInput(e.target.value)}
                          onKeyDown={handleTagKeyDown}
                          onBlur={() => tagInput.trim() && addTag(tagInput)}
                        />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {PRESET_STACKS.filter(
                        (s) => !form.techStack.includes(s),
                      ).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addTag(s)}
                          className="rounded-full border border-[var(--sp-border)] bg-[var(--sp-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--sp-text-soft)] transition-all hover:border-[#66301a] hover:bg-[var(--sp-accent-soft)] hover:text-[#ffb07f]"
                        >
                          + {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </article>

              <article className="md:col-span-5 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 shadow-[var(--sp-shadow)]">
                <h2 className="text-[23px] font-black tracking-tight text-[var(--sp-text)]">
                  2. Set your pace
                </h2>
                <p className="mt-1 text-[13px] text-[var(--sp-text-soft)]">
                  Give the timeline and effort level once.
                </p>

                <div className="mt-6 space-y-6">
                  <div>
                    <div className="mb-2 flex items-end justify-between">
                      <span className="text-[12px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                        Duration
                      </span>
                      <span className="text-[27px] font-black leading-none text-[var(--sp-accent)]">
                        {form.weeks}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={24}
                      step={1}
                      value={form.weeks}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          weeks: Number(e.target.value),
                        }))
                      }
                      className="h-2 w-full cursor-pointer accent-[#e56d2f]"
                    />
                    <div className="mt-2 flex justify-between text-[11px] font-semibold text-[var(--sp-text-mute)]">
                      <span>1 week</span>
                      <span>12 weeks</span>
                      <span>24 weeks</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-3 text-center">
                      <p className="text-[19px] font-black text-[var(--sp-accent)]">
                        {form.weeks}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sp-text-mute)]">
                        Weeks
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-3 text-center">
                      <p className="text-[19px] font-black text-[var(--sp-accent)]">
                        {form.dailyHours}h
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sp-text-mute)]">
                        Daily
                      </p>
                    </div>
                    <div className="rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-3 text-center">
                      <p className="text-[19px] font-black text-[var(--sp-accent)]">
                        {form.techStack.length}
                      </p>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--sp-text-mute)]">
                        Tools
                      </p>
                    </div>
                  </div>
                </div>
              </article>

              <article className="md:col-span-8 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 md:p-7 shadow-[var(--sp-shadow)]">
                <h2 className="text-[23px] font-black tracking-tight text-[var(--sp-text)]">
                  3. Personalize the plan
                </h2>
                <p className="mt-1 text-[13px] text-[var(--sp-text-soft)]">
                  Add context so the roadmap feels realistic for your routine.
                </p>

                <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                      <BookOpen
                        size={14}
                        className="text-[var(--sp-text-mute)]"
                        strokeWidth={2.3}
                      />
                      Current level
                    </label>
                    <select
                      className="w-full appearance-none rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-4 py-3 text-[14px] text-[var(--sp-text)] outline-none transition-all focus:border-[var(--sp-accent)] focus:ring-4 focus:ring-orange-500/20"
                      value={form.currentLevel}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, currentLevel: e.target.value }))
                      }
                    >
                      {LEVEL_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center justify-between gap-2 text-[13px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                      <span className="inline-flex items-center gap-2">
                        <Clock
                          size={14}
                          className="text-[var(--sp-text-mute)]"
                          strokeWidth={2.3}
                        />
                        Daily study hours
                      </span>
                      <span className="text-[13px] text-[var(--sp-text)]">
                        {form.dailyHours}h/day
                      </span>
                    </label>
                    <input
                      type="range"
                      min={0.5}
                      max={8}
                      step={0.5}
                      value={form.dailyHours}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          dailyHours: Number(e.target.value),
                        }))
                      }
                      className="h-2 w-full cursor-pointer accent-[#e56d2f]"
                    />
                    <div className="flex justify-between text-[11px] font-semibold text-[var(--sp-text-mute)]">
                      <span>30 min</span>
                      <span>4h</span>
                      <span>8h</span>
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <label className="text-[13px] font-bold uppercase tracking-wide text-[var(--sp-text-soft)]">
                      Goals and context
                    </label>
                    <textarea
                      className="w-full resize-none rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-4 py-3 text-[14px] text-[var(--sp-text)] outline-none transition-all placeholder:text-[var(--sp-text-mute)] focus:border-[var(--sp-accent)] focus:ring-4 focus:ring-orange-500/20"
                      rows={3}
                      placeholder="e.g. I am preparing for interviews in 3 months and want daily DSA + system design focus."
                      value={form.goals}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, goals: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </article>

              <article className="md:col-span-4 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 shadow-[var(--sp-shadow)]">
                <h2 className="text-[22px] font-black tracking-tight text-[var(--sp-text)]">
                  What you get
                </h2>
                <p className="mt-1 text-[13px] text-[var(--sp-text-soft)]">
                  Every section in the final plan has one job.
                </p>
                <ul className="mt-5 space-y-3 text-[14px] text-[var(--sp-text-soft)]">
                  <li>Weekly goals with daily execution</li>
                  <li>Real resources aligned with your stack</li>
                  <li>Milestones that signal actual progress</li>
                </ul>
                <div className="mt-5 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sp-text-mute)]">
                    Plan quality
                  </p>
                  <div className="mt-3 space-y-2 text-[12px] text-[var(--sp-text-soft)]">
                    <p>One idea per section</p>
                    <p>Clear weekly learning arc</p>
                    <p>Actionable daily steps</p>
                    <p>Resource-backed milestones</p>
                  </div>
                </div>
              </article>

              {planState === "error" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="md:col-span-12 rounded-2xl border border-[#5b1f1f] bg-[#2a1111] px-4 py-3 text-[13px] font-semibold text-[#ff9a9a]"
                >
                  {error}
                </motion.div>
              )}

              <article className="md:col-span-12 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 md:p-7 shadow-[var(--sp-shadow)]">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-12 md:items-center">
                  <div className="md:col-span-8">
                    <h3 className="text-[28px] leading-tight font-black tracking-tight text-[var(--sp-text)]">
                      Generate your full roadmap
                    </h3>
                    <p className="mt-2 text-[14px] text-[var(--sp-text-soft)]">
                      The result opens in a readable long-form view with export
                      support and clean markdown formatting.
                    </p>
                  </div>
                  <div className="md:col-span-4 md:justify-self-end w-full md:w-auto">
                    <button
                      id="generate-plan-btn"
                      disabled={!isFormValid}
                      onClick={handleGenerate}
                      className={`inline-flex w-full items-center justify-center gap-2 rounded-2xl px-8 py-4 text-[15px] font-black tracking-wide transition-all md:w-auto ${
                        isFormValid
                          ? "bg-[var(--sp-accent)] text-white hover:bg-[#fb8a38] hover:-translate-y-0.5"
                          : "cursor-not-allowed border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] text-[var(--sp-text-mute)]"
                      }`}
                    >
                      <Sparkles size={17} strokeWidth={2.4} />
                      Generate Study Plan
                    </button>
                  </div>
                </div>
              </article>
            </motion.section>
          )}

          {showPlan && (
            <motion.section
              key="plan"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-12 gap-4"
            >
              <article className="md:col-span-12 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 md:p-6 shadow-[var(--sp-shadow)]">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--sp-text-mute)]">
                      Generated Roadmap
                    </p>
                    <h2 className="mt-1 text-[24px] font-black tracking-tight text-[var(--sp-text)]">
                      {form.skillToLearn}
                    </h2>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-full border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-1 text-[12px] font-semibold text-[var(--sp-text-soft)]">
                        {form.weeks}-week timeline
                      </span>
                      {form.techStack.slice(0, 3).map((t) => (
                        <span
                          key={t}
                          className="rounded-full border border-[#66301a] bg-[var(--sp-accent-soft)] px-3 py-1 text-[12px] font-semibold text-[#ffb07f]"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {planState === "streaming" && (
                      <span className="inline-flex items-center gap-2 rounded-full border border-[#66301a] bg-[var(--sp-accent-soft)] px-3 py-1.5 text-[12px] font-bold text-[#ffb07f]">
                        <Loader2 size={13} className="animate-spin" />
                        Generating
                      </span>
                    )}
                    {planState === "done" && (
                      <button
                        onClick={handleDownload}
                        className="inline-flex items-center gap-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-2 text-[12px] font-bold text-[var(--sp-text-soft)] transition-all hover:border-[#2c3145] hover:text-[var(--sp-text)]"
                      >
                        <Download size={13} strokeWidth={2.5} />
                        Download .md
                      </button>
                    )}
                    <button
                      onClick={resetForm}
                      className="inline-flex items-center gap-2 rounded-xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-3 py-2 text-[12px] font-bold text-[var(--sp-text-soft)] transition-all hover:border-[#2c3145] hover:text-[var(--sp-text)]"
                    >
                      <RotateCcw size={13} strokeWidth={2.5} />
                      New Plan
                    </button>
                  </div>
                </div>
              </article>

              <article
                ref={planRef}
                className="md:col-span-8 min-h-[240px] rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-6 md:p-8 shadow-[var(--sp-shadow)]"
              >
                {planContent ? (
                  <div className={PROSE_CLASSES}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {planContent}
                    </ReactMarkdown>
                    {planState === "streaming" && (
                      <span className="ml-0.5 inline-block h-[18px] w-[2px] animate-[pulse_0.8s_ease-in-out_infinite] bg-[var(--sp-accent)] align-middle" />
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                    <div className="relative">
                      <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#2a3042] border-t-[var(--sp-accent)]" />
                      <Sparkles
                        size={18}
                        className="absolute inset-0 m-auto text-[var(--sp-accent)]"
                      />
                    </div>
                    <p className="text-[14px] font-semibold text-[var(--sp-text-soft)]">
                      Crafting your personalized study plan
                    </p>
                    <p className="text-[12px] text-[var(--sp-text-mute)]">
                      Usually takes around 10 to 20 seconds
                    </p>
                  </div>
                )}
              </article>

              <article className="md:col-span-4 rounded-[26px] border border-[var(--sp-border)] bg-[var(--sp-surface)] p-5 shadow-[var(--sp-shadow)]">
                <h3 className="text-[20px] font-black tracking-tight text-[var(--sp-text)]">
                  Execution anchor
                </h3>
                <p className="mt-1 text-[13px] text-[var(--sp-text-soft)]">
                  Turn this into action by following one week at a time.
                </p>
                <div className="mt-4 rounded-2xl border border-[var(--sp-border)] bg-[var(--sp-surface-soft)] px-4 py-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--sp-text-mute)]">
                    Use rhythm
                  </p>
                  <p className="mt-2 text-[13px] text-[var(--sp-text-soft)]">
                    Keep a weekly cadence: learn, practice, review, then
                    checkpoint.
                  </p>
                </div>
                <ul className="mt-4 space-y-2 text-[13px] text-[var(--sp-text-soft)]">
                  <li>Follow week order to avoid context switching.</li>
                  <li>Track milestones every Sunday.</li>
                  <li>Adjust pace only when consistency drops.</li>
                </ul>
              </article>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

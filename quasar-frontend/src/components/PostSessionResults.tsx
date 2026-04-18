import { useState, useEffect } from "react";
import { apiPost } from "../lib/api";
import { SpeechHeatmap } from "./SpeechHeatmap";
import { GamificationToast } from "./GamificationToast";
import { LevelUpModal } from "./LevelUpModal";
import type { GamificationResult } from "../hooks/useGamificationStats";
import { motion, AnimatePresence } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  CheckCircle2,
  AlertTriangle,
  Download,
  RotateCcw,
  Loader2,
  Sparkles,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

interface EvalData {
  overallScore: number;
  starScores: Record<string, number>;
  clarityScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  summary: string;
  passed: boolean;
  gamification?: GamificationResult | null;
}

interface PostSessionResultsProps {
  sessionId: string;
  fillerBuckets: { t: number; count: number; words?: string[] }[];
  onDownloadReport: () => void;
  reportDownloading: boolean;
  onNewInterview: () => void;
}

export function PostSessionResults({
  sessionId,
  fillerBuckets,
  onDownloadReport,
  reportDownloading,
  onNewInterview,
}: PostSessionResultsProps) {
  const [evalData, setEvalData] = useState<EvalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gamification, setGamification] = useState<GamificationResult | null>(
    null,
  );
  const [showLevelUp, setShowLevelUp] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    // Small delay to ensure transcript saves have flushed to MongoDB
    const timer = setTimeout(() => {
      setLoading(true);
      apiPost<EvalData>(`/api/sessions/${sessionId}/evaluate`, {})
        .then((res) => {
          if (res.success) {
            setEvalData(res.data);
            if (res.data.gamification) {
              setGamification(res.data.gamification);
              if (res.data.gamification.levelUp) setShowLevelUp(true);
            }
          } else {
            setError(res.message || "Evaluation failed");
          }
        })
        .catch(() => setError("Failed to evaluate session"))
        .finally(() => setLoading(false));
    }, 500);

    return () => clearTimeout(timer);
  }, [sessionId]);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  if (loading) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full min-h-[60vh]"
        style={{ padding: "32px" }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center gap-6 p-8 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl max-w-[480px] w-full text-center shadow-lg"
        >
          <div className="relative flex items-center justify-center w-20 h-20 mb-2">
            <div className="absolute inset-0 rounded-full border-4 border-[var(--c-surface-3)] border-t-[var(--c-accent)] animate-spin"></div>
            <Sparkles
              className="text-[var(--c-accent)] animate-pulse"
              size={28}
            />
          </div>
          <h3 className="text-[22px] font-black tracking-tight text-[var(--c-text)] m-0">
            Analyzing Performance
          </h3>
          <p className="text-[14px] text-[var(--c-text-dim)] mb-2">
            Our AI is reviewing your interview responses
          </p>
          <div className="flex flex-col gap-3 w-full max-w-[280px]">
            <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--c-accent)] bg-[var(--c-accent-dim)] px-4 py-2 rounded-xl">
              <Loader2 className="animate-spin" size={16} /> Scoring STAR
              responses
            </div>
            <div className="flex items-center gap-3 text-[13px] font-medium text-[var(--c-text-dim)] px-4 py-2">
              Evaluating communication...
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (error || !evalData) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full min-h-[60vh]"
        style={{ padding: "32px" }}
      >
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center gap-4 p-8 bg-[var(--c-surface)] border border-[var(--c-error-dim)] rounded-3xl max-w-[480px] w-full text-center shadow-[0_8px_32px_rgba(239,68,68,0.1)]"
        >
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 mb-2 shadow-inner text-white">
            <AlertCircle size={32} strokeWidth={2.5} />
          </div>
          <h3 className="text-[22px] font-black text-[var(--c-text)] m-0">
            Evaluation Unavailable
          </h3>
          <p className="text-[14px] text-[var(--c-text-dim)] leading-relaxed">
            {error ||
              "Could not evaluate this session. The transcript may be too short."}
          </p>
          <div className="mt-4">
            <button
              onClick={onNewInterview}
              className="flex items-center gap-2 bg-[var(--c-surface-2)] text-[var(--c-text)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] px-6 py-3 rounded-xl font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
            >
              <RotateCcw size={18} /> Start New Interview
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const starDimensions = [
    {
      key: "situation",
      label: "Situation",
      score: evalData.starScores.situation || 0,
    },
    { key: "task", label: "Task", score: evalData.starScores.task || 0 },
    { key: "action", label: "Action", score: evalData.starScores.action || 0 },
    { key: "result", label: "Result", score: evalData.starScores.result || 0 },
    {
      key: "conciseness",
      label: "Conciseness",
      score: evalData.starScores.conciseness || 0,
    },
    {
      key: "domain_knowledge",
      label: "Domain Knowledge",
      score: evalData.starScores.domain_knowledge || 0,
    },
  ];

  const skillLabels: Record<string, string> = {
    communication: "Communication",
    technical_depth: "Technical Depth",
    leadership: "Leadership",
    problem_structuring: "Problem Structuring",
    result_orientation: "Result Orientation",
    culture_fit: "Culture Fit",
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col gap-6 w-full max-w-[800px] mx-auto"
      style={{ padding: "32px 24px 64px 24px" }}
    >
      {/* Overall Score Hero */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col items-center justify-center p-8 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)] w-full"
      >
        <div
          className={`relative flex flex-col items-center justify-center w-[140px] h-[140px] rounded-full border-[6px] mb-5 shadow-inner transition-colors duration-500 ${evalData.passed ? "border-green-500/80 bg-green-500/10 text-green-500" : "border-orange-500/80 bg-orange-500/10 text-orange-500"}`}
        >
          <span className="text-[44px] font-black leading-none mt-2">
            {evalData.overallScore.toFixed(1)}
          </span>
          <span className="text-[12px] font-bold opacity-70 mt-1 uppercase tracking-wider">
            / 10
          </span>
        </div>
        <div
          className={`inline-flex items-center px-5 py-2 rounded-full text-[13px] font-black tracking-widest mb-5 uppercase ${evalData.passed ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-orange-500/20 text-orange-400 border border-orange-500/30"}`}
        >
          {evalData.passed ? "PASS" : "NEEDS WORK"}
        </div>
        <p className="text-[15px] text-[var(--c-text-dim)] leading-relaxed max-w-[600px] m-0">
          {evalData.summary}
        </p>
      </motion.div>

      {/* STAR Breakdown */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col gap-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] p-6 shadow-sm w-full"
      >
        <h3 className="flex items-center gap-2 text-[18px] font-extrabold text-[var(--c-text)] m-0">
          <TrendingUp className="text-[var(--c-accent)]" size={20} /> STAR
          Breakdown
        </h3>
        <div className="flex flex-col gap-3.5">
          {starDimensions.map((dim) => (
            <div
              key={dim.key}
              className="grid grid-cols-[130px_1fr_30px] items-center gap-4 max-sm:grid-cols-[100px_1fr_30px]"
            >
              <span className="text-[13px] font-medium text-[var(--c-text-dim)] text-right">
                {dim.label}
              </span>
              <div className="h-2.5 bg-[var(--c-surface-3)] rounded-full overflow-hidden w-full">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(dim.score / 10) * 100}%` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="h-full rounded-full bg-gradient-to-r from-orange-500 to-amber-400"
                />
              </div>
              <span className="text-[14px] font-bold text-[var(--c-text)]">
                {dim.score}
              </span>
            </div>
          ))}
          <div className="h-[1px] bg-[var(--c-border)] my-1 w-full" />
          <div className="grid grid-cols-[130px_1fr_30px] items-center gap-4 max-sm:grid-cols-[100px_1fr_30px]">
            <span className="text-[13px] font-medium text-[var(--c-text-dim)] text-right">
              Clarity
            </span>
            <div className="h-2.5 bg-[var(--c-surface-3)] rounded-full overflow-hidden w-full">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(evalData.clarityScore / 10) * 100}%` }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-400"
              />
            </div>
            <span className="text-[14px] font-bold text-[var(--c-text)]">
              {evalData.clarityScore}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Skill Categories */}
      {evalData.categoryScores &&
        Object.keys(evalData.categoryScores).length > 0 && (
          <motion.div
            variants={itemVariants}
            className="flex flex-col gap-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] p-6 shadow-sm w-full"
          >
            <h3 className="flex items-center gap-2 text-[18px] font-extrabold text-[var(--c-text)] m-0">
              <Sparkles className="text-[var(--c-purple)]" size={20} /> Skill
              Assessment
            </h3>
            <div className="flex flex-col gap-3.5">
              {Object.entries(evalData.categoryScores).map(([skill, score]) => (
                <div
                  key={skill}
                  className="grid grid-cols-[130px_1fr_30px] items-center gap-4 max-sm:grid-cols-[100px_1fr_30px]"
                >
                  <span className="text-[13px] font-medium text-[var(--c-text-dim)] text-right">
                    {skillLabels[skill] || skill}
                  </span>
                  <div className="h-2.5 bg-[var(--c-surface-3)] rounded-full overflow-hidden w-full">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${((score as number) / 10) * 100}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400"
                    />
                  </div>
                  <span className="text-[14px] font-bold text-[var(--c-text)]">
                    {score as number}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

      {/* Strengths & Improvements */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 max-md:grid-cols-1 gap-5 w-full"
      >
        <div className="flex flex-col gap-4 p-6 rounded-[20px] border border-green-500/20 bg-green-500/5 shadow-sm">
          <h4 className="flex items-center gap-2 text-[15px] font-extrabold text-green-400 m-0">
            <CheckCircle2 size={18} strokeWidth={2.5} />
            Strengths
          </h4>
          <ul className="flex flex-col gap-2.5 pl-0 m-0 list-none">
            {evalData.strengths?.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[14px] text-[var(--c-text-dim)] leading-snug"
              >
                <span className="text-green-500/60 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-4 p-6 rounded-[20px] border border-orange-500/20 bg-orange-500/5 shadow-sm">
          <h4 className="flex items-center gap-2 text-[15px] font-extrabold text-orange-400 m-0">
            <AlertTriangle size={18} strokeWidth={2.5} />
            Areas to Improve
          </h4>
          <ul className="flex flex-col gap-2.5 pl-0 m-0 list-none">
            {evalData.improvements?.map((s, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 text-[14px] text-[var(--c-text-dim)] leading-snug"
              >
                <span className="text-orange-500/60 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </motion.div>

      {/* Speech Heatmap */}
      {fillerBuckets.length > 0 && (
        <motion.div
          variants={itemVariants}
          className="flex flex-col gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] p-6 shadow-sm w-full"
        >
          <SpeechHeatmap buckets={fillerBuckets} />
        </motion.div>
      )}

      {/* Actions */}
      <motion.div
        variants={itemVariants}
        className="flex flex-wrap items-center justify-center gap-4 mt-4 w-full"
      >
        <button
          onClick={onDownloadReport}
          className="flex items-center gap-2 bg-[var(--c-accent)] text-white hover:bg-orange-600 px-6 py-3.5 rounded-[14px] font-bold transition-all hover:scale-105 active:scale-95 shadow-[0_4px_16px_rgba(249,115,22,0.3)] disabled:opacity-60 disabled:pointer-events-none"
          disabled={reportDownloading}
        >
          {reportDownloading ? (
            <>
              <Loader2 className="animate-spin" size={18} />
              Generating PDF…
            </>
          ) : (
            <>
              <Download size={18} strokeWidth={2.5} />
              Download PDF Report
            </>
          )}
        </button>

        <button
          onClick={onNewInterview}
          className="flex items-center gap-2 bg-[var(--c-surface-2)] text-[var(--c-text)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] px-6 py-3.5 rounded-[14px] font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <RotateCcw size={18} />
          Start New Interview
        </button>
      </motion.div>

      {/* Modals & Toasts */}
      <AnimatePresence>
        {gamification && (
          <GamificationToast
            gamification={gamification}
            onClose={() => setGamification(null)}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showLevelUp && gamification && (
          <LevelUpModal
            level={gamification.level}
            onClose={() => setShowLevelUp(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

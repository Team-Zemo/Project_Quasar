import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  FileSearch,
  ListChecks,
  Mic,
  Users,
  Trophy,
  CheckCircle,
  XCircle,
  Clock,
  ChevronRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Play,
  Code2,
  Video,
  ExternalLink,
} from "lucide-react";
import { apiGet } from "../../lib/api";
import type {
  Application,
  JobPosting,
  PipelineConfig,
  TechRoundConfig,
} from "../../types/recruitment";

interface Props {
  appId: string;
  onBack: () => void;
  onStartMcq: (appId: string) => void;
  onStartDsa: (appId: string) => void;
  onStartTechInterview: (
    appId: string,
    round: number,
    config: TechRoundConfig,
    jdContext: string,
    jobTitle: string,
    company: string,
    alreadyStarted?: boolean,
  ) => void;
  onStartHrInterview: (
    appId: string,
    jdContext: string,
    jobTitle: string,
    company: string,
    durationMinutes: number,
    alreadyStarted?: boolean,
  ) => void;
  /** Changed after interview completion — triggers a re-fetch of application data */
  refreshKey?: number | null;
}

type StageKey = "screening" | "mcq" | "dsa" | "tech" | "hr" | "ri" | "result";

interface Stage {
  key: StageKey;
  label: string;
  icon: typeof FileSearch;
}

const STAGES: Stage[] = [
  { key: "screening", label: "Resume Screening", icon: FileSearch },
  { key: "mcq", label: "MCQ Assessment", icon: ListChecks },
  { key: "dsa", label: "DSA Challenge", icon: Code2 },
  { key: "tech", label: "Tech Interview", icon: Mic },
  { key: "hr", label: "HR Interview", icon: Users },
  { key: "ri", label: "Recruiter Interaction", icon: Video },
  { key: "result", label: "Final Result", icon: Trophy },
];

function getStageStatus(
  stage: StageKey,
  app: Application,
): "passed" | "failed" | "active" | "upcoming" | "skipped" {
  const s = app.status;
  switch (stage) {
    case "screening":
      if (s === "screening") return "active";
      if (s === "screening_failed") return "failed";
      if (app.screeningResult)
        return app.screeningResult.passed ? "passed" : "failed";
      if (s === "applied") return "active";
      return "passed";
    case "mcq":
      if (["applied", "screening", "screening_failed"].includes(s))
        return "upcoming";
      if (s === "mcq_pending" || s === "mcq_in_progress") return "active";
      if (s === "mcq_failed") return "failed";
      if (app.mcqResult?.completedAt)
        return app.mcqResult.passed ? "passed" : "failed";
      if (s === "screening_passed" && !app.mcqResult) return "upcoming";
      if (
        [
          "dsa_pending",
          "dsa_in_progress",
          "dsa_passed",
          "dsa_failed",
          "tech_pending",
          "tech_in_progress",
          "tech_passed",
          "tech_failed",
          "hr_pending",
          "hr_in_progress",
          "hr_passed",
          "hr_failed",
          "selected",
        ].includes(s)
      )
        return app.mcqResult ? "passed" : "skipped";
      return "upcoming";
    case "dsa":
      if (
        [
          "applied",
          "screening",
          "screening_failed",
          "screening_passed",
          "mcq_pending",
          "mcq_in_progress",
          "mcq_failed",
        ].includes(s)
      )
        return "upcoming";
      if (s === "dsa_pending" || s === "dsa_in_progress") return "active";
      if (s === "dsa_failed") return "failed";
      if (app.dsaResult?.completedAt)
        return app.dsaResult.passed ? "passed" : "failed";
      if (
        [
          "tech_pending",
          "tech_in_progress",
          "tech_passed",
          "tech_failed",
          "hr_pending",
          "hr_in_progress",
          "hr_passed",
          "hr_failed",
          "selected",
        ].includes(s)
      )
        return app.dsaResult ? "passed" : "skipped";
      return "upcoming";
    case "tech":
      if (
        [
          "applied",
          "screening",
          "screening_failed",
          "screening_passed",
          "mcq_pending",
          "mcq_in_progress",
          "mcq_failed",
          "dsa_pending",
          "dsa_in_progress",
          "dsa_failed",
        ].includes(s)
      )
        return "upcoming";
      if (s === "tech_pending" || s === "tech_in_progress") return "active";
      if (s === "tech_failed") return "failed";
      if (
        [
          "hr_pending",
          "hr_in_progress",
          "hr_passed",
          "hr_failed",
          "selected",
        ].includes(s)
      )
        return (app.techResults?.length || 0) > 0 ? "passed" : "skipped";
      if (s === "tech_passed") return "passed";
      return "upcoming";
    case "hr":
      if (
        [
          "applied",
          "screening",
          "screening_failed",
          "screening_passed",
          "mcq_pending",
          "mcq_in_progress",
          "mcq_failed",
          "dsa_pending",
          "dsa_in_progress",
          "dsa_failed",
          "tech_pending",
          "tech_in_progress",
          "tech_failed",
        ].includes(s)
      )
        return "upcoming";
      if (s === "hr_pending" || s === "hr_in_progress") return "active";
      if (s === "hr_failed") return "failed";
      if (s === "hr_passed" || s === "ri_pending" || s === "ri_scheduled" || s === "ri_passed" || s === "ri_failed" || s === "selected")
        return app.hrResult ? "passed" : "skipped";
      return "upcoming";
    case "ri":
      if (
        [
          "applied",
          "screening",
          "screening_failed",
          "screening_passed",
          "mcq_pending",
          "mcq_in_progress",
          "mcq_failed",
          "dsa_pending",
          "dsa_in_progress",
          "dsa_failed",
          "tech_pending",
          "tech_in_progress",
          "tech_failed",
          "hr_pending",
          "hr_in_progress",
          "hr_failed",
        ].includes(s)
      )
        return "upcoming";
      if (s === "ri_pending" || s === "ri_scheduled") return "active";
      if (s === "ri_failed") return "failed";
      if (s === "ri_passed" || s === "selected")
        return app.recruiterInteractionResult ? "passed" : "skipped";
      return "upcoming";
    case "result":
      if (s === "selected") return "passed";
      if (s === "rejected") return "failed";
      if (
        [
          "screening_failed",
          "mcq_failed",
          "dsa_failed",
          "tech_failed",
          "hr_failed",
          "ri_failed",
        ].includes(s)
      )
        return "failed";
      return "upcoming";
    default:
      return "upcoming";
  }
}

const statusColors: Record<
  string,
  { bg: string; border: string; text: string; ring: string }
> = {
  passed: {
    bg: "rgba(34,197,94,0.1)",
    border: "rgba(34,197,94,0.3)",
    text: "var(--c-success)",
    ring: "rgba(34,197,94,0.15)",
  },
  failed: {
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.3)",
    text: "var(--c-error)",
    ring: "rgba(239,68,68,0.15)",
  },
  active: {
    bg: "rgba(249,115,22,0.1)",
    border: "rgba(249,115,22,0.4)",
    text: "var(--c-accent)",
    ring: "rgba(249,115,22,0.15)",
  },
  upcoming: {
    bg: "var(--c-surface-2)",
    border: "var(--c-border)",
    text: "var(--c-text-mute)",
    ring: "transparent",
  },
  skipped: {
    bg: "var(--c-surface-2)",
    border: "var(--c-border)",
    text: "var(--c-text-mute)",
    ring: "transparent",
  },
};

export function PipelineTracker({
  appId,
  onBack,
  onStartMcq,
  onStartDsa,
  onStartTechInterview,
  onStartHrInterview,
  refreshKey,
}: Props) {
  const [app, setApp] = useState<Application | null>(null);
  const [job, setJob] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = () => {
    setLoading(true);
    apiGet<Application>(`/api/candidate/applications`)
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          const found = (res.data as Application[]).find(
            (a) => a._id === appId,
          );
          if (found) {
            setApp(found);
            const jobData =
              typeof found.jobPostingId === "object"
                ? (found.jobPostingId as JobPosting)
                : null;
            if (jobData) setJob(jobData);
          }
        }
      })
      .finally(() => {
        setLoading(false);
        setActionLoading(false);
      });
  };

  useEffect(() => {
    fetchData();
  }, [appId, refreshKey]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 text-center">
        <AlertCircle
          size={48}
          className="mx-auto text-[var(--c-text-mute)] mb-4"
        />
        <p className="text-[var(--c-text-dim)]">Application not found</p>
        <button onClick={onBack} className="mt-4 btn-ghost text-[13px]">
          ← Back
        </button>
      </div>
    );
  }

  const pipeline: PipelineConfig = job?.pipeline || {};

  // Always show a stage if the app's status proves that stage exists,
  // even if the pipeline config field is not fully populated from the API
  const mcqStatusExists = app.status.includes("mcq") || app.mcqResult != null;
  const dsaStatusExists = app.status.includes("dsa") || app.dsaResult != null;
  const techStatusExists =
    app.status.includes("tech") || (app.techResults?.length || 0) > 0;
  const hrStatusExists = app.status.includes("hr") || app.hrResult != null;
  const riStatusExists = app.status.includes("ri") || app.recruiterInteractionResult != null;

  const visibleStages = STAGES.filter((stage) => {
    if (stage.key === "mcq")
      return pipeline.mcqRound?.enabled || mcqStatusExists;
    if (stage.key === "dsa")
      return pipeline.dsaRound?.enabled || dsaStatusExists;
    if (stage.key === "tech")
      return (
        (pipeline.techInterviewRounds?.length || 0) > 0 || techStatusExists
      );
    if (stage.key === "hr") return pipeline.hrRound?.enabled || hrStatusExists;
    if (stage.key === "ri") return pipeline.recruiterInteractionRound?.enabled || riStatusExists;
    return true;
  });

  const buildJdContext = (): string => {
    if (!job) return "";
    const skills = job.parsedJd?.requiredSkills?.join(", ") || "";
    return (
      `You are interviewing a candidate for the position of "${job.title}" at "${job.company}".\n\n` +
      `Focus on these key skills: ${skills}\n\n` +
      `Job Description:\n${(job.jobDescription || "").substring(0, 3000)}`
    );
  };

  const canStartMcq = app.status === "mcq_pending";
  const canStartDsa = app.status === "dsa_pending";
  const currentTechResult = app.techResults?.find(
    (r) => r.roundNumber === app.currentTechRoundNumber,
  );
  const techAlreadyCompleted = !!(
    currentTechResult?.completedAt || currentTechResult?.score != null
  );
  const hrAlreadyCompleted = !!(
    app.hrResult?.completedAt || app.hrResult?.score != null
  );

  const canStartTech =
    (app.status === "tech_pending" || app.status === "tech_in_progress") &&
    !techAlreadyCompleted;
  const canStartHr =
    (app.status === "hr_pending" || app.status === "hr_in_progress") &&
    !hrAlreadyCompleted;

  const currentTechConfig = pipeline.techInterviewRounds?.find(
    (r) => r.roundNumber === app.currentTechRoundNumber,
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors mb-6"
      >
        <ArrowLeft size={14} /> Back to Applications
      </button>

      <div className="mb-8">
        <h1 className="text-2xl font-black text-[var(--c-text)] tracking-tight">
          {job?.title || "Application"}
        </h1>
        <p className="text-[13px] text-[var(--c-text-mute)] mt-1">
          {job?.company} {job?.location ? `• ${job.location}` : ""}
        </p>
      </div>

      {/* Pipeline Steps */}
      <div className="relative">
        {visibleStages.map((stage, i) => {
          const stageStatus = getStageStatus(stage.key, app);
          const colors = statusColors[stageStatus];
          const Icon = stage.icon;
          const StatusIcon =
            stageStatus === "passed"
              ? CheckCircle
              : stageStatus === "failed"
                ? XCircle
                : stageStatus === "active"
                  ? Loader2
                  : Clock;
          const isLast = i === visibleStages.length - 1;

          return (
            <motion.div
              key={stage.key}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 }}
              className="relative mb-3"
            >
              {/* Connector line */}
              {!isLast && (
                <div
                  className="absolute left-[39px] top-[63px] w-[2px] h-[calc(100%-34px)] z-0"
                  style={{
                    background:
                      stageStatus === "passed" || stageStatus === "failed"
                        ? `linear-gradient(to bottom, ${colors.border}, var(--c-border))`
                        : "var(--c-border)",
                  }}
                />
              )}

              <div
                className="flex items-start gap-4 p-4 rounded-2xl border transition-all relative z-10"
                style={{
                  background: colors.bg,
                  borderColor: colors.border,
                  boxShadow:
                    stageStatus === "active"
                      ? `0 0 24px ${colors.ring}`
                      : "none",
                }}
              >
                {/* Stage circle */}
                <div
                  className="relative flex items-center justify-center w-[46px] h-[46px] rounded-xl flex-shrink-0 border"
                  style={{ background: colors.bg, borderColor: colors.border }}
                >
                  <Icon size={20} style={{ color: colors.text }} />
                  {stageStatus === "active" && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[var(--c-accent)] border-2 border-[var(--c-bg)] animate-pulse" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="text-[14px] font-bold"
                      style={{
                        color:
                          stageStatus === "upcoming"
                            ? "var(--c-text-mute)"
                            : "var(--c-text)",
                      }}
                    >
                      {stage.label}
                      {stage.key === "tech" &&
                        pipeline.techInterviewRounds &&
                        pipeline.techInterviewRounds.length > 1 && (
                          <span className="text-[11px] font-normal text-[var(--c-text-mute)] ml-1.5">
                            ({pipeline.techInterviewRounds.length} rounds)
                          </span>
                        )}
                    </h3>
                    <div
                      className="flex items-center gap-1 text-[11px] font-semibold"
                      style={{ color: colors.text }}
                    >
                      <StatusIcon
                        size={12}
                        className={
                          stageStatus === "active" ? "animate-spin" : ""
                        }
                      />
                      {stageStatus === "passed" && "Passed"}
                      {stageStatus === "failed" && "Failed"}
                      {stageStatus === "active" && "In Progress"}
                      {stageStatus === "upcoming" && "Upcoming"}
                      {stageStatus === "skipped" && "Skipped"}
                    </div>
                  </div>

                  {/* Stage details */}
                  {stage.key === "screening" && app.screeningResult && (
                    <div className="text-[12px] text-[var(--c-text-dim)] space-y-1 mt-2">
                      <p>
                        Match Score:{" "}
                        <strong
                          style={{
                            color: app.screeningResult.passed
                              ? "var(--c-success)"
                              : "var(--c-error)",
                          }}
                        >
                          {app.screeningResult.matchScore}%
                        </strong>
                      </p>
                      {app.screeningResult.matchedSkills.length > 0 && (
                        <p className="text-[11px]">
                          Matched:{" "}
                          {app.screeningResult.matchedSkills
                            .slice(0, 5)
                            .join(", ")}
                        </p>
                      )}
                      {app.screeningResult.summary && (
                        <p className="text-[11px] text-[var(--c-text-mute)] italic mt-1">
                          {app.screeningResult.summary}
                        </p>
                      )}
                    </div>
                  )}

                  {stage.key === "mcq" && app.mcqResult?.completedAt && (
                    <div className="text-[12px] text-[var(--c-text-dim)] mt-2">
                      <p>
                        Score:{" "}
                        <strong
                          style={{
                            color: app.mcqResult.passed
                              ? "var(--c-success)"
                              : "var(--c-error)",
                          }}
                        >
                          {app.mcqResult.percentage}%
                        </strong>{" "}
                        ({app.mcqResult.correctAnswers}/
                        {app.mcqResult.totalQuestions} correct)
                      </p>
                    </div>
                  )}

                  {stage.key === "dsa" && app.dsaResult?.completedAt && (
                    <div className="text-[12px] text-[var(--c-text-dim)] mt-2">
                      <p>
                        Score:{" "}
                        <strong
                          style={{
                            color: app.dsaResult.passed
                              ? "var(--c-success)"
                              : "var(--c-error)",
                          }}
                        >
                          {app.dsaResult.percentage}%
                        </strong>{" "}
                        ({app.dsaResult.totalScore} test cases passed)
                      </p>
                    </div>
                  )}

                  {stage.key === "tech" &&
                    app.techResults?.filter((r) => r.score != null).length >
                      0 && (
                      <div className="flex items-center gap-3 mt-2">
                        {app.techResults
                          .filter((r) => r.score != null)
                          .map((r) => (
                            <span
                              key={r.roundNumber}
                              className="text-[12px] px-2 py-0.5 rounded-lg"
                              style={{
                                background: r.passed
                                  ? "rgba(34,197,94,0.1)"
                                  : "rgba(239,68,68,0.1)",
                                color: r.passed
                                  ? "var(--c-success)"
                                  : "var(--c-error)",
                              }}
                            >
                              Round {r.roundNumber}: {r.score?.toFixed(1)}/10
                            </span>
                          ))}
                      </div>
                    )}

                  {stage.key === "hr" && app.hrResult?.score != null && (
                    <div className="text-[12px] text-[var(--c-text-dim)] mt-2">
                      <p>
                        Score:{" "}
                        <strong
                          style={{
                            color: app.hrResult.passed
                              ? "var(--c-success)"
                              : "var(--c-error)",
                          }}
                        >
                          {app.hrResult.score?.toFixed(1)}/10
                        </strong>
                      </p>
                    </div>
                  )}

                  {stage.key === "ri" && (
                    <div className="text-[12px] text-[var(--c-text-dim)] mt-2 space-y-1">
                      {app.status === "ri_pending" && (
                        <p className="text-[var(--c-text-mute)] italic">
                          Waiting for the recruiter to schedule a meeting with you.
                        </p>
                      )}
                      {app.status === "ri_scheduled" && app.recruiterInteractionResult && (
                        <>
                          <p>
                            Meeting scheduled for{" "}
                            <strong className="text-[var(--c-accent)]">
                              {new Date(app.recruiterInteractionResult.scheduledAt!).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                            </strong>
                          </p>
                          <a
                            href={app.recruiterInteractionResult.meetLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 rounded-lg text-[12px] font-bold text-white bg-gradient-to-r from-[var(--c-accent)] to-[#fb923c] hover:brightness-110 transition-all"
                          >
                            <ExternalLink size={12} /> Join Meeting
                          </a>
                        </>
                      )}
                      {app.recruiterInteractionResult?.completedAt && (
                        <p>
                          Result:{" "}
                          <strong
                            style={{
                              color: app.recruiterInteractionResult.passed
                                ? "var(--c-success)"
                                : "var(--c-error)",
                            }}
                          >
                            {app.recruiterInteractionResult.passed ? "Passed ✓" : "Not selected"}
                          </strong>
                        </p>
                      )}
                    </div>
                  )}

                  {stage.key === "result" && app.status === "selected" && (
                    <div className="text-[12px] text-[var(--c-success)] font-semibold mt-2">
                      🎉 Congratulations! You've been selected. Total Score:{" "}
                      {app.totalScore.toFixed(1)}
                      {app.rank && <span> • Rank #{app.rank}</span>}
                    </div>
                  )}

                  {/* Action buttons */}
                  {stage.key === "mcq" && canStartMcq && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      disabled={actionLoading}
                      onClick={() => {
                        setActionLoading(true);
                        onStartMcq(appId);
                      }}
                      className="flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-[var(--c-accent)] to-[#fb923c] hover:brightness-110 transition-all shadow-md active:scale-95"
                    >
                      <Play size={14} /> Start MCQ Test
                    </motion.button>
                  )}

                  {stage.key === "dsa" && canStartDsa && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      disabled={actionLoading}
                      onClick={() => {
                        setActionLoading(true);
                        onStartDsa(appId);
                      }}
                      className="flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-[var(--c-accent)] to-[#fdba74] hover:brightness-110 transition-all shadow-md active:scale-95"
                    >
                      <Code2 size={14} /> Start DSA Challenge
                    </motion.button>
                  )}

                  {stage.key === "tech" &&
                    canStartTech &&
                    currentTechConfig && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        disabled={actionLoading}
                        onClick={() => {
                          setActionLoading(true);
                          onStartTechInterview(
                            appId,
                            app.currentTechRoundNumber,
                            currentTechConfig,
                            buildJdContext(),
                            job?.title ||
                              currentTechConfig.title ||
                              "Technical Interview",
                            job?.company || "",
                            app.status === "tech_in_progress",
                          );
                        }}
                        className="flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-[var(--c-accent)] to-[#fb923c] hover:brightness-110 transition-all shadow-md active:scale-95 disabled:opacity-50"
                      >
                        <Mic size={14} />{" "}
                        {app.status === "tech_in_progress"
                          ? "Continue"
                          : "Start"}{" "}
                        Tech Interview (Round {app.currentTechRoundNumber})
                      </motion.button>
                    )}

                  {stage.key === "hr" && canStartHr && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      disabled={actionLoading}
                      onClick={() => {
                        setActionLoading(true);
                        onStartHrInterview(
                          appId,
                          buildJdContext(),
                          job?.title || "HR Interview",
                          job?.company || "",
                          pipeline.hrRound?.durationMinutes || 30,
                          app.status === "hr_in_progress",
                        );
                      }}
                      className="flex items-center gap-2 mt-3 px-4 py-2 rounded-xl text-[13px] font-bold text-white bg-gradient-to-r from-[var(--c-accent)] to-[#fdba74] hover:brightness-110 transition-all shadow-md active:scale-95 disabled:opacity-50"
                    >
                      <Users size={14} />{" "}
                      {app.status === "hr_in_progress" ? "Continue" : "Start"}{" "}
                      HR Interview
                    </motion.button>
                  )}
                </div>

                {/* Arrow */}
                {stageStatus === "active" && (
                  <ChevronRight
                    size={18}
                    className="text-[var(--c-accent)] flex-shrink-0 mt-3"
                  />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

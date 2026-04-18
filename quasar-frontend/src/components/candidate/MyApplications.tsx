import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Briefcase,
  Clock,
  CheckCircle,
  XCircle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { apiGet } from "../../lib/api";
import { PipelineTracker } from "./PipelineTracker";
import type {
  Application,
  JobPosting,
  ApplicationStatus,
  TechRoundConfig,
} from "../../types/recruitment";

interface Props {
  onViewApplication?: (appId: string, jobId: string) => void;
  /** Called when the tracker needs to start an MCQ test */
  onStartMcq?: (appId: string) => void;
  /** Called when the tracker needs to start a DSA test */
  onStartDsa?: (appId: string) => void;
  /** Called when the tracker needs to start a tech interview. alreadyStarted=true means status is already tech_in_progress */
  onStartTechInterview?: (
    appId: string,
    round: number,
    config: any,
    jdContext: string,
    alreadyStarted?: boolean,
  ) => void;
  /** Called when the tracker needs to start an HR interview. alreadyStarted=true means status is already hr_in_progress */
  onStartHrInterview?: (
    appId: string,
    jdContext: string,
    alreadyStarted?: boolean,
  ) => void;
  /** If set, show a specific application in detail mode */
  activeAppId?: string | null;
  onClearActiveApp?: () => void;
  /** Changed after interview completion — triggers a re-fetch of application data */
  refreshKey?: number | null;
}

const statusConfig: Partial<
  Record<
    ApplicationStatus,
    { icon: typeof CheckCircle; color: string; label: string }
  >
> = {
  applied: { icon: Clock, color: "var(--c-text-mute)", label: "Applied" },
  screening: { icon: Clock, color: "var(--c-purple)", label: "Screening" },
  screening_passed: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "Screening Passed",
  },
  screening_failed: {
    icon: XCircle,
    color: "var(--c-error)",
    label: "Screening Failed",
  },
  mcq_pending: {
    icon: Clock,
    color: "var(--c-purple)",
    label: "MCQ Test Pending",
  },
  mcq_in_progress: {
    icon: AlertCircle,
    color: "var(--c-accent)",
    label: "MCQ In Progress",
  },
  mcq_passed: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "MCQ Passed",
  },
  mcq_failed: { icon: XCircle, color: "var(--c-error)", label: "MCQ Failed" },
  dsa_pending: {
    icon: Clock,
    color: "var(--c-purple)",
    label: "DSA Test Pending",
  },
  dsa_in_progress: {
    icon: AlertCircle,
    color: "var(--c-accent)",
    label: "DSA In Progress",
  },
  dsa_passed: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "DSA Passed",
  },
  dsa_failed: { icon: XCircle, color: "var(--c-error)", label: "DSA Failed" },
  tech_pending: {
    icon: Clock,
    color: "var(--c-user)",
    label: "Tech Interview Pending",
  },
  tech_in_progress: {
    icon: AlertCircle,
    color: "var(--c-accent)",
    label: "Tech Interview",
  },
  tech_passed: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "Tech Passed",
  },
  tech_failed: { icon: XCircle, color: "var(--c-error)", label: "Tech Failed" },
  hr_pending: {
    icon: Clock,
    color: "var(--c-success)",
    label: "HR Round Pending",
  },
  hr_in_progress: {
    icon: AlertCircle,
    color: "var(--c-accent)",
    label: "HR Round",
  },
  hr_passed: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "HR Passed",
  },
  hr_failed: { icon: XCircle, color: "var(--c-error)", label: "HR Failed" },
  selected: {
    icon: CheckCircle,
    color: "var(--c-success)",
    label: "🎉 Selected",
  },
  rejected: { icon: XCircle, color: "var(--c-error)", label: "Rejected" },
};

export function MyApplications({
  onViewApplication,
  onStartMcq,
  onStartDsa,
  onStartTechInterview,
  onStartHrInterview,
  activeAppId,
  onClearActiveApp,
  refreshKey,
}: Props) {
  const [applications, setApplications] = useState<
    (Application & { jobPostingId: JobPosting })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(
    activeAppId || null,
  );
  const actionableStatuses: ApplicationStatus[] = [
    "mcq_pending",
    "dsa_pending",
    "tech_pending",
    "hr_pending",
    "mcq_in_progress",
    "dsa_in_progress",
    "tech_in_progress",
    "hr_in_progress",
  ];
  const closedStatuses: ApplicationStatus[] = [
    "selected",
    "rejected",
    "screening_failed",
    "mcq_failed",
    "dsa_failed",
    "tech_failed",
    "hr_failed",
  ];

  useEffect(() => {
    setLoading(true);
    apiGet<Application[]>("/api/candidate/applications")
      .then((res) => {
        if (res.success)
          setApplications(
            res.data as (Application & { jobPostingId: JobPosting })[],
          );
      })
      .finally(() => setLoading(false));
  }, [refreshKey]);

  // Sync external activeAppId
  useEffect(() => {
    if (activeAppId !== undefined) setSelectedAppId(activeAppId);
  }, [activeAppId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="spinner !w-8 !h-8 !border-[var(--c-accent)] !border-t-transparent !border-[3px]" />
      </div>
    );
  }

  // If an app is selected, show the PipelineTracker
  if (selectedAppId) {
    return (
      <PipelineTracker
        appId={selectedAppId}
        refreshKey={refreshKey}
        onBack={() => {
          setSelectedAppId(null);
          onClearActiveApp?.();
        }}
        onStartMcq={onStartMcq || (() => {})}
        onStartDsa={onStartDsa || (() => {})}
        onStartTechInterview={onStartTechInterview || (() => {})}
        onStartHrInterview={onStartHrInterview || (() => {})}
      />
    );
  }

  const actionableCount = applications.filter((app) =>
    actionableStatuses.includes(app.status),
  ).length;
  const closedCount = applications.filter((app) =>
    closedStatuses.includes(app.status),
  ).length;

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 sm:px-6">
      <div className="mb-8 md:mt-25 flex flex-col items-center text-center">
        <h1 className="text-[36px] sm:text-[44px] md:text-[50px] font-black text-[var(--c-text)] tracking-tight mb-3">
          My Applications
        </h1>
        <p className="text-[14px] sm:text-[15px] text-[var(--c-text-dim)] max-w-2xl leading-relaxed">
          Track interview progress, continue pending rounds, and review
          performance across every stage.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">
            Total
          </p>
          <p className="text-[22px] font-black text-[var(--c-text)] mt-1">
            {applications.length}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">
            Action Required
          </p>
          <p className="text-[22px] font-black text-[var(--c-accent)] mt-1">
            {actionableCount}
          </p>
        </div>
        <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">
            Closed
          </p>
          <p className="text-[22px] font-black text-[var(--c-text)] mt-1">
            {closedCount}
          </p>
        </div>
      </div>

      {applications.length === 0 ? (
        <div className="text-center py-20 rounded-3xl border border-[var(--c-border)] bg-[var(--c-surface)]">
          <Briefcase
            size={48}
            className="mx-auto text-[var(--c-text-mute)] mb-4"
          />
          <p className="text-[var(--c-text-dim)] text-[15px] font-semibold">
            No applications yet
          </p>
          <p className="text-[var(--c-text-mute)] text-[13px] mt-1">
            Browse jobs and apply to get started
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app, i) => {
            const job =
              typeof app.jobPostingId === "object" ? app.jobPostingId : null;
            const conf = statusConfig[app.status] || {
              icon: Clock,
              color: "var(--c-text-mute)",
              label: app.status,
            };
            const Icon = conf.icon;
            const isActionable = actionableStatuses.includes(app.status);

            return (
              <motion.div
                key={app._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => setSelectedAppId(app._id)}
                className="rounded-2xl border border-[var(--c-border)] bg-[var(--c-surface)] p-5 sm:p-6 hover:border-[var(--c-accent-glow)] hover:bg-[var(--c-surface-2)] transition-all cursor-pointer group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="text-[16px] sm:text-[17px] font-extrabold text-[var(--c-text)] group-hover:text-[var(--c-accent)] transition-colors">
                      {job?.title || "Job"}
                    </h3>
                    <p className="text-[12px] text-[var(--c-text-mute)] mt-1">
                      {job?.company} {job?.location ? `• ${job.location}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 sm:mt-0">
                    <div
                      className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold"
                      style={{
                        color: conf.color,
                        background: `color-mix(in srgb, ${conf.color} 12%, transparent)`,
                      }}
                    >
                      <Icon size={13} />
                      {conf.label}
                    </div>
                    {isActionable && (
                      <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--c-accent)] text-white">
                        <ArrowRight size={14} />
                      </div>
                    )}
                  </div>
                </div>

                {/* Score summary */}
                <div className="mt-4 pt-4 border-t border-[var(--c-border)] grid grid-cols-2 sm:grid-cols-3 gap-2 text-[12px]">
                  {app.screeningResult && (
                    <div className="rounded-lg bg-[var(--c-surface-2)] px-2.5 py-2">
                      <span className="text-[var(--c-text-mute)]">
                        Screening{" "}
                      </span>
                      <span
                        className="font-bold"
                        style={{
                          color: app.screeningResult.passed
                            ? "var(--c-success)"
                            : "var(--c-error)",
                        }}
                      >
                        {app.screeningResult.matchScore}%
                      </span>
                    </div>
                  )}
                  {app.mcqResult?.completedAt && (
                    <div className="rounded-lg bg-[var(--c-surface-2)] px-2.5 py-2">
                      <span className="text-[var(--c-text-mute)]">MCQ </span>
                      <span
                        className="font-bold"
                        style={{
                          color: app.mcqResult.passed
                            ? "var(--c-success)"
                            : "var(--c-error)",
                        }}
                      >
                        {app.mcqResult.percentage}%
                      </span>
                    </div>
                  )}
                  {app.dsaResult?.completedAt && (
                    <div className="rounded-lg bg-[var(--c-surface-2)] px-2.5 py-2">
                      <span className="text-[var(--c-text-mute)]">DSA </span>
                      <span
                        className="font-bold"
                        style={{
                          color: app.dsaResult.passed
                            ? "var(--c-success)"
                            : "var(--c-error)",
                        }}
                      >
                        {app.dsaResult.percentage}%
                      </span>
                    </div>
                  )}
                  {app.techResults
                    ?.filter((r) => r.score != null)
                    .map((r) => (
                      <div
                        key={r.roundNumber}
                        className="rounded-lg bg-[var(--c-surface-2)] px-2.5 py-2"
                      >
                        <span className="text-[var(--c-text-mute)]">
                          Tech {r.roundNumber}{" "}
                        </span>
                        <span
                          className="font-bold"
                          style={{
                            color: r.passed
                              ? "var(--c-success)"
                              : "var(--c-error)",
                          }}
                        >
                          {r.score?.toFixed(1)}/10
                        </span>
                      </div>
                    ))}
                  {app.hrResult?.score != null && (
                    <div className="rounded-lg bg-[var(--c-surface-2)] px-2.5 py-2">
                      <span className="text-[var(--c-text-mute)]">HR </span>
                      <span
                        className="font-bold"
                        style={{
                          color: app.hrResult.passed
                            ? "var(--c-success)"
                            : "var(--c-error)",
                        }}
                      >
                        {app.hrResult.score.toFixed(1)}/10
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-[var(--c-text-mute)]">
                    Applied {new Date(app.appliedAt).toLocaleDateString()}
                  </span>

                  {isActionable ? (
                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--c-accent)]">
                      <AlertCircle size={13} />
                      Continue Round
                    </div>
                  ) : (
                    <div className="text-[11px] font-semibold text-[var(--c-text-mute)]">
                      Open to view details
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

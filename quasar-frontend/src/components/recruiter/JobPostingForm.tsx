import { Fragment, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  Sparkles,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { apiPost } from "../../lib/api";
import { authState } from "../../lib/auth";
import type { PipelineConfig, TechRoundConfig } from "../../types/recruitment";

interface Props {
  onComplete: (id: string) => void;
  onCancel: () => void;
}

type Step = "details" | "pipeline" | "review";

export function JobPostingForm({ onComplete, onCancel }: Props) {
  const [step, setStep] = useState<Step>("details");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Step 1: Job Details
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState(authState.getUser()?.company || "");
  const [location, setLocation] = useState("");
  const [employmentType, setEmploymentType] = useState("full-time");
  const [jobDescription, setJobDescription] = useState("");

  // Step 2: Pipeline
  const [mcqEnabled, setMcqEnabled] = useState(true);
  const [mcqDuration, setMcqDuration] = useState(30);
  const [mcqPassingScore, setMcqPassingScore] = useState(60);
  const [mcqWindowStart, setMcqWindowStart] = useState("");
  const [mcqWindowEnd, setMcqWindowEnd] = useState("");

  // DSA Round
  const [dsaEnabled, setDsaEnabled] = useState(false);
  const [dsaDuration, setDsaDuration] = useState(60);
  const [dsaPassingScore, setDsaPassingScore] = useState(60);
  const [dsaWindowStart, setDsaWindowStart] = useState("");
  const [dsaWindowEnd, setDsaWindowEnd] = useState("");
  const [dsaEasyCount, setDsaEasyCount] = useState(1);
  const [dsaMediumCount, setDsaMediumCount] = useState(1);
  const [dsaHardCount, setDsaHardCount] = useState(0);

  const [techEnabled, setTechEnabled] = useState(true);
  const [techRounds, setTechRounds] = useState<
    Array<
      Omit<TechRoundConfig, "window"> & {
        windowStart: string;
        windowEnd: string;
      }
    >
  >([
    {
      roundNumber: 1,
      title: "Technical Interview",
      domain: "General",
      personaId: "faang_engineer",
      durationMinutes: 30,
      passingScore: 6,
      windowStart: "",
      windowEnd: "",
    },
  ]);

  const [hrEnabled, setHrEnabled] = useState(true);
  const [hrDuration, setHrDuration] = useState(20);
  const [hrPassingScore, setHrPassingScore] = useState(6);
  const [hrWindowStart, setHrWindowStart] = useState("");
  const [hrWindowEnd, setHrWindowEnd] = useState("");

  // Recruiter Interaction Round
  const [riEnabled, setRiEnabled] = useState(false);

  const addTechRound = () => {
    setTechRounds((prev) => [
      ...prev,
      {
        roundNumber: prev.length + 1,
        title: `Tech Round ${prev.length + 1}`,
        domain: "General",
        personaId: "faang_engineer",
        durationMinutes: 30,
        passingScore: 6,
        windowStart: "",
        windowEnd: "",
      },
    ]);
  };

  const removeTechRound = (index: number) => {
    setTechRounds((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((r, i) => ({ ...r, roundNumber: i + 1 })),
    );
  };

  const updateTechRound = (
    index: number,
    field: string,
    value: string | number,
  ) => {
    setTechRounds((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    );
  };

  const demoAutofillDetails = () => {
    setTitle("Junior Backend Engineer");
    setLocation("San Francisco, CA (Hybrid)");
    setEmploymentType("internship");
    setJobDescription(`We are looking for a Intern Backend Engineer to join our product team.

Responsibilities:
- Handle junior level codebase

Requirements:
- 0 years of experience in web development`);
  };

  const demoAutofillPipeline = () => {
    const now = new Date();
    // Start window from yesterday to open it immediately, end in 7 days
    const startObj = new Date(now.getTime() - 24 * 3600 * 1000);
    const endObj = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
    // Format to yyyy-mm-ddThh:mm for datetime-local
    const formatLocal = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const start = formatLocal(startObj);
    const end = formatLocal(endObj);

    setMcqEnabled(true);
    setMcqDuration(10);
    setMcqPassingScore(10);
    setMcqWindowStart(start);
    setMcqWindowEnd(end);

    setTechEnabled(true);
    setTechRounds([
      {
        roundNumber: 1,
        title: "java backend developer",
        domain: "java",
        personaId: "faang_engineer",
        durationMinutes: 10,
        passingScore: 2,
        windowStart: start,
        windowEnd: end,
      },
    ]);

    setHrEnabled(true);
    setHrDuration(10);
    setHrPassingScore(2);
    setHrWindowStart(start);
    setHrWindowEnd(end);

    setDsaEnabled(true);
    setDsaDuration(30);
    setDsaPassingScore(30);
    setDsaEasyCount(1);
    setDsaMediumCount(1);
    setDsaHardCount(0);
    setDsaWindowStart(start);
    setDsaWindowEnd(end);
  };

  const buildPipeline = (): PipelineConfig => ({
    mcqRound: mcqEnabled
      ? {
          enabled: true,
          durationMinutes: mcqDuration,
          passingScore: mcqPassingScore,
          window: { start: mcqWindowStart, end: mcqWindowEnd },
        }
      : null,
    dsaRound: dsaEnabled
      ? {
          enabled: true,
          durationMinutes: dsaDuration,
          passingScore: dsaPassingScore,
          window: { start: dsaWindowStart, end: dsaWindowEnd },
          easyCount: dsaEasyCount,
          mediumCount: dsaMediumCount,
          hardCount: dsaHardCount,
          allowedLanguages: ["javascript", "java", "c", "cpp", "kotlin", "go"],
        }
      : null,
    techInterviewRounds: techEnabled ? techRounds.map((r) => ({
      roundNumber: r.roundNumber,
      title: r.title,
      domain: r.domain,
      personaId: r.personaId,
      durationMinutes: r.durationMinutes,
      passingScore: r.passingScore,
      window: { start: r.windowStart, end: r.windowEnd },
    })) : [],
    hrRound: hrEnabled
      ? {
          enabled: true,
          durationMinutes: hrDuration,
          passingScore: hrPassingScore,
          window: { start: hrWindowStart, end: hrWindowEnd },
        }
      : null,
    recruiterInteractionRound: riEnabled ? { enabled: true } : null,
  });

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await apiPost<{ _id: string }>("/api/recruiter/jobs", {
        title,
        company,
        location,
        employmentType,
        jobDescription,
        pipeline: buildPipeline(),
      });

      if (res.success) {
        onComplete(res.data._id);
      } else {
        setError(res.message || "Failed to create job posting");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors";
  const labelClass =
    "block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2";
  const steps = [
    { id: "details", label: "Details" },
    { id: "pipeline", label: "Pipeline" },
    { id: "review", label: "Review" },
  ] as const;
  const currentStepIndex = steps.findIndex((s) => s.id === step);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={onCancel}
          className="p-2 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-[var(--c-text)] tracking-tight">
            Create Job Posting
          </h1>
          <p className="text-[var(--c-text-dim)] text-[13px]">
            Step {currentStepIndex + 1} of {steps.length}
          </p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold ${
                s.id === step
                  ? "bg-[var(--c-accent)] text-black"
                  : currentStepIndex > i
                    ? "bg-[var(--c-accent-dim)] text-[var(--c-accent)]"
                    : "bg-[var(--c-surface-3)] text-[var(--c-text-mute)]"
              }`}
            >
              {currentStepIndex > i ? <CheckCircle size={14} /> : i + 1}
            </div>
            <span className="hidden sm:inline text-[11px] font-bold uppercase tracking-wide text-[var(--c-text-mute)]">
              {s.label}
            </span>
            {i < 2 && <div className="w-12 h-px bg-[var(--c-border-2)]" />}
          </div>
        ))}
      </div>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4 sm:p-6 lg:p-8 shadow-[var(--shadow-glass)]">
        {/* Step 1: Details */}
        {step === "details" && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--c-text)]">
                Job Details
              </h2>
              <button
                onClick={demoAutofillDetails}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[var(--c-accent-dim)] text-[var(--c-accent)] hover:bg-[var(--c-accent)] hover:text-black transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={14} /> Demo Autofill
              </button>
            </div>
            <p className="text-[12px] text-[var(--c-text-mute)] mb-5">
              Define role metadata and a strong JD so screening and interview
              generation stay accurate.
            </p>
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Job Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Senior Full Stack Developer"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Company *</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    className={inputClass}
                    placeholder="Acme Corp"
                  />
                </div>
                <div>
                  <label className={labelClass}>Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className={inputClass}
                    placeholder="Bangalore, India"
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Employment Type</label>
                <select
                  value={employmentType}
                  onChange={(e) => setEmploymentType(e.target.value)}
                  className={inputClass}
                >
                  <option value="full-time">Full Time</option>
                  <option value="part-time">Part Time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Job Description *</label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                  className={`${inputClass} resize-y`}
                  placeholder="Paste the full job description here..."
                />
              </div>
            </div>
            <button
              onClick={() => setStep("pipeline")}
              disabled={!title || !company || !jobDescription}
              className="btn-primary mt-6 flex items-center gap-2"
            >
              Next: Configure Pipeline <ArrowRight size={16} />
            </button>
          </motion.div>
        )}

        {/* Step 2: Pipeline */}
        {step === "pipeline" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-[var(--c-text)]">
                Interview Pipeline
              </h2>
              <button
                onClick={demoAutofillPipeline}
                className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg bg-[var(--c-accent-dim)] text-[var(--c-accent)] hover:bg-[var(--c-accent)] hover:text-black transition-colors flex items-center gap-1.5"
              >
                <Sparkles size={14} /> Demo Autofill
              </button>
            </div>
            <p className="text-[var(--c-text-dim)] text-[13px] mb-6 flex items-center gap-2">
              <AlertCircle size={14} className="text-[var(--c-accent)]" />
              Each round is an eliminator — candidates must pass to advance.
            </p>

            {/* MCQ Round */}
            <div className="border border-[var(--c-border)] bg-[var(--c-surface-2)]/40 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-dim)] border border-[var(--c-accent)]/30 flex items-center justify-center text-[var(--c-accent)] text-[12px] font-bold">
                    1
                  </div>
                  <h3 className="text-[14px] font-bold text-[var(--c-text)]">
                    MCQ Round
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mcqEnabled}
                    onChange={(e) => setMcqEnabled(e.target.checked)}
                    className="accent-[var(--c-accent)]"
                  />
                  <span className="text-[12px] text-[var(--c-text-dim)]">
                    Enable
                  </span>
                </label>
              </div>
              {mcqEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Duration (min)</label>
                    <input
                      type="number"
                      value={mcqDuration}
                      onChange={(e) => setMcqDuration(+e.target.value)}
                      className={inputClass}
                      min={5}
                      max={180}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Passing Score (%)</label>
                    <input
                      type="number"
                      value={mcqPassingScore}
                      onChange={(e) => setMcqPassingScore(+e.target.value)}
                      className={inputClass}
                      min={0}
                      max={100}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Window Start</label>
                    <input
                      type="datetime-local"
                      value={mcqWindowStart}
                      onChange={(e) => setMcqWindowStart(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Window End</label>
                    <input
                      type="datetime-local"
                      value={mcqWindowEnd}
                      onChange={(e) => setMcqWindowEnd(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* DSA Round */}
            <div className="border border-[var(--c-border)] bg-[var(--c-surface-2)]/40 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-dim)] border border-[var(--c-accent)]/25 flex items-center justify-center text-[var(--c-accent)] text-[12px] font-bold">
                    {mcqEnabled ? 2 : 1}
                  </div>
                  <h3 className="text-[14px] font-bold text-[var(--c-text)]">
                    DSA Coding Round
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={dsaEnabled}
                    onChange={(e) => setDsaEnabled(e.target.checked)}
                    className="accent-[var(--c-accent)]"
                  />
                  <span className="text-[12px] text-[var(--c-text-dim)]">
                    Enable
                  </span>
                </label>
              </div>
              {dsaEnabled && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>Duration (min)</label>
                      <input
                        type="number"
                        value={dsaDuration}
                        onChange={(e) => setDsaDuration(+e.target.value)}
                        className={inputClass}
                        min={15}
                        max={240}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Passing Score (%)</label>
                      <input
                        type="number"
                        value={dsaPassingScore}
                        onChange={(e) => setDsaPassingScore(+e.target.value)}
                        className={inputClass}
                        min={0}
                        max={100}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Window Start</label>
                      <input
                        type="datetime-local"
                        value={dsaWindowStart}
                        onChange={(e) => setDsaWindowStart(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Window End</label>
                      <input
                        type="datetime-local"
                        value={dsaWindowEnd}
                        onChange={(e) => setDsaWindowEnd(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className={labelClass}>Easy Qs</label>
                      <input
                        type="number"
                        value={dsaEasyCount}
                        onChange={(e) => setDsaEasyCount(+e.target.value)}
                        className={inputClass}
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Medium Qs</label>
                      <input
                        type="number"
                        value={dsaMediumCount}
                        onChange={(e) => setDsaMediumCount(+e.target.value)}
                        className={inputClass}
                        min={0}
                        max={10}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Hard Qs</label>
                      <input
                        type="number"
                        value={dsaHardCount}
                        onChange={(e) => setDsaHardCount(+e.target.value)}
                        className={inputClass}
                        min={0}
                        max={10}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-[var(--c-text-mute)]">
                    Total: {dsaEasyCount + dsaMediumCount + dsaHardCount}{" "}
                    questions from system pool + job-specific questions
                  </p>
                </div>
              )}
            </div>

            {/* Tech Rounds */}
            <div className="border border-[var(--c-border)] bg-[var(--c-surface-2)]/40 rounded-xl p-5 mb-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--c-accent-dim)] border border-[var(--c-accent)]/25 flex items-center justify-center text-[var(--c-accent)] text-[12px] font-bold">
                    {(mcqEnabled ? 1 : 0) + (dsaEnabled ? 1 : 0) + 1}
                  </div>
                  <h3 className="text-[14px] font-bold text-[var(--c-text)]">
                    Technical Interview Rounds
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={techEnabled}
                    onChange={(e) => setTechEnabled(e.target.checked)}
                    className="accent-[var(--c-accent)]"
                  />
                  <span className="text-[12px] text-[var(--c-text-dim)]">
                    Enable
                  </span>
                </label>
              </div>

              {techEnabled && (
                <>
                  {techRounds.map((round, index) => (
                    <div
                      key={index}
                      className="border border-[var(--c-border)] bg-[var(--c-surface-3)]/50 rounded-xl p-4 mb-3"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[13px] font-bold text-[var(--c-text)]">
                          Tech Round {round.roundNumber}
                        </h4>
                        {techRounds.length > 1 && (
                          <button
                            onClick={() => removeTechRound(index)}
                            className="p-1.5 rounded-lg hover:bg-[var(--c-error-dim)] text-[var(--c-text-mute)] hover:text-[var(--c-error)] transition-colors"
                          >
                            <Minus size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelClass}>Round Title</label>
                          <input
                            type="text"
                            value={round.title}
                            onChange={(e) =>
                              updateTechRound(index, "title", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Domain</label>
                          <input
                            type="text"
                            value={round.domain}
                            onChange={(e) =>
                              updateTechRound(index, "domain", e.target.value)
                            }
                            className={inputClass}
                            placeholder="DSA, System Design..."
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Duration (min)</label>
                          <input
                            type="number"
                            value={round.durationMinutes}
                            onChange={(e) =>
                              updateTechRound(
                                index,
                                "durationMinutes",
                                +e.target.value,
                              )
                            }
                            className={inputClass}
                            min={10}
                            max={120}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Passing Score (/10)</label>
                          <input
                            type="number"
                            value={round.passingScore}
                            onChange={(e) =>
                              updateTechRound(index, "passingScore", +e.target.value)
                            }
                            className={inputClass}
                            min={0}
                            max={10}
                            step={0.5}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Window Start</label>
                          <input
                            type="datetime-local"
                            value={round.windowStart}
                            onChange={(e) =>
                              updateTechRound(index, "windowStart", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <label className={labelClass}>Window End</label>
                          <input
                            type="datetime-local"
                            value={round.windowEnd}
                            onChange={(e) =>
                              updateTechRound(index, "windowEnd", e.target.value)
                            }
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={addTechRound}
                    className="btn-secondary flex items-center gap-2 w-full justify-center mt-2"
                  >
                    <Plus size={14} /> Add Tech Round
                  </button>
                </>
              )}
            </div>

            {/* HR Round */}
            <div className="border border-[var(--c-border)] bg-[var(--c-surface-2)]/40 rounded-xl p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)] flex items-center justify-center text-[var(--c-accent)] text-[12px] font-bold">
                    {(mcqEnabled ? 1 : 0) + (dsaEnabled ? 1 : 0) + (techEnabled ? 1 : 0) + 1}
                  </div>
                  <h3 className="text-[14px] font-bold text-[var(--c-text)]">
                    HR Round (AI)
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hrEnabled}
                    onChange={(e) => setHrEnabled(e.target.checked)}
                    className="accent-[var(--c-accent)]"
                  />
                  <span className="text-[12px] text-[var(--c-text-dim)]">
                    Enable
                  </span>
                </label>
              </div>
              {hrEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Duration (min)</label>
                    <input
                      type="number"
                      value={hrDuration}
                      onChange={(e) => setHrDuration(+e.target.value)}
                      className={inputClass}
                      min={10}
                      max={60}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Passing Score (/10)</label>
                    <input
                      type="number"
                      value={hrPassingScore}
                      onChange={(e) => setHrPassingScore(+e.target.value)}
                      className={inputClass}
                      min={0}
                      max={10}
                      step={0.5}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Window Start</label>
                    <input
                      type="datetime-local"
                      value={hrWindowStart}
                      onChange={(e) => setHrWindowStart(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Window End</label>
                    <input
                      type="datetime-local"
                      value={hrWindowEnd}
                      onChange={(e) => setHrWindowEnd(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Recruiter Interaction Round ── */}
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-[var(--c-accent-dim)] text-[var(--c-accent)] flex items-center justify-center text-[12px] font-black">
                    {(mcqEnabled ? 1 : 0) + (dsaEnabled ? 1 : 0) + (techEnabled ? techRounds.length : 0) + (hrEnabled ? 1 : 0) + 1}
                  </div>
                  <h3 className="text-[14px] font-bold text-[var(--c-text)]">
                    Recruiter Interaction
                  </h3>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={riEnabled}
                    onChange={(e) => setRiEnabled(e.target.checked)}
                    className="accent-[var(--c-accent)]"
                  />
                  <span className="text-[12px] text-[var(--c-text-dim)]">
                    Enable
                  </span>
                </label>
              </div>
              {riEnabled && (
                <p className="text-[12px] text-[var(--c-text-mute)] ml-10">
                  A manual round where you schedule a personal meeting (Google Meet / Zoom / Teams) with the candidate and pass or fail them.
                </p>
              )}
            </div>

            {error && step === "pipeline" && (
              <p className="text-[var(--c-error)] text-[13px] font-medium mb-4">
                {error}
              </p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setError("");
                  setStep("details");
                }}
                className="btn-secondary flex items-center gap-2"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={() => {
                  if (!mcqEnabled && !dsaEnabled && !techEnabled && !hrEnabled && !riEnabled) {
                    setError("Please enable at least one interview round.");
                    return;
                  }
                  setError("");
                  setStep("review");
                }}
                className="btn-primary flex-1 flex items-center gap-2 justify-center"
              >
                Review & Create <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Review */}
        {step === "review" && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-xl font-bold text-[var(--c-text)] mb-6">
              Review & Create
            </h2>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-[var(--c-surface-2)] rounded-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-1">
                  Job Title
                </p>
                <p className="text-[15px] font-bold text-[var(--c-text)]">
                  {title}
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-[var(--c-surface-2)] rounded-xl">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-1">
                    Company
                  </p>
                  <p className="text-[14px] text-[var(--c-text)]">{company}</p>
                </div>
                <div className="p-4 bg-[var(--c-surface-2)] rounded-xl">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-1">
                    Location
                  </p>
                  <p className="text-[14px] text-[var(--c-text)]">
                    {location || "Not specified"}
                  </p>
                </div>
              </div>

              <div className="p-4 bg-[var(--c-surface-2)] rounded-xl">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">
                  Interview Pipeline
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-accent-dim)] text-[var(--c-accent)]">
                    AI Screening
                  </span>
                  {mcqEnabled && (
                    <>
                      <span className="text-[var(--c-text-mute)]">→</span>
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">
                        MCQ ({mcqDuration}min)
                      </span>
                    </>
                  )}
                  {dsaEnabled && (
                    <>
                      <span className="text-[var(--c-text-mute)]">→</span>
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">
                        DSA ({dsaDuration}min •{" "}
                        {dsaEasyCount + dsaMediumCount + dsaHardCount}Qs)
                      </span>
                    </>
                  )}
                  {techEnabled && techRounds.map((r) => (
                    <Fragment key={r.roundNumber}>
                      <span className="text-[var(--c-text-mute)]">→</span>
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">
                        {r.title} ({r.durationMinutes}min)
                      </span>
                    </Fragment>
                  ))}
                  {hrEnabled && (
                    <>
                      <span className="text-[var(--c-text-mute)]">→</span>
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-surface-3)] text-[var(--c-text-dim)]">
                        HR ({hrDuration}min)
                      </span>
                    </>
                  )}
                  {riEnabled && (
                    <>
                      <span className="text-[var(--c-text-mute)]">→</span>
                      <span className="px-3 py-1 rounded-lg text-[11px] font-bold uppercase bg-[var(--c-accent-dim)] text-[var(--c-accent)]">
                        Recruiter Interaction
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <p className="text-[var(--c-error)] text-[13px] font-medium mb-4">
                {error}
              </p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep("pipeline")}
                className="btn-secondary flex items-center gap-2"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="btn-primary flex-1 flex items-center gap-2 justify-center"
              >
                {loading ? (
                  <div className="spinner" />
                ) : (
                  <>
                    Create Job Posting <Sparkles size={16} />
                  </>
                )}
              </button>
            </div>

            <p className="text-[var(--c-text-mute)] text-[11px] text-center mt-4">
              Job will be created as a draft. Add MCQ questions before
              publishing.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

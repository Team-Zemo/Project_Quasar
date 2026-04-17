import { useEffect, useState, useRef } from "react";
import { useAuth } from "../hooks/useAuth";
import { apiGet } from "../lib/api";
import { SessionHistory } from "./SessionHistory";
import { XPBar } from "./XPBar";
import { StreakWidget } from "./StreakWidget";
import { useGamificationStats } from "../hooks/useGamificationStats";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import {
  Activity,
  Trophy,
  Target,
  TrendingUp,
  BarChart3,
  Loader2,
} from "lucide-react";

interface ProgressSession {
  sessionId: string;
  date: string;
  overallScore: number;
  starScores: {
    situation: number;
    task: number;
    action: number;
    result: number;
  };
  clarityScore: number;
  fillerRate: number;
  confidenceAvg: number;
  domain: string;
}

interface ProgressData {
  sessions: ProgressSession[];
  improvement: {
    clarityDelta: string;
    strongestDimension: string;
    weakestDimension: string;
  };
  totalSessions: number;
}

export function ProgressDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<ProgressData | null>(null);
  const [skillVector, setSkillVector] = useState<
    { skill: string; score: number; attempt_count: number }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const { stats: gStats } = useGamificationStats(user?.id);

  const overallChartRef = useRef<HTMLCanvasElement>(null);
  const starChartRef = useRef<HTMLCanvasElement>(null);
  const fillerChartRef = useRef<HTMLCanvasElement>(null);
  const skillChartRef = useRef<HTMLCanvasElement>(null);
  const overallChartInstance = useRef<any>(null);
  const starChartInstance = useRef<any>(null);
  const fillerChartInstance = useRef<any>(null);
  const skillChartInstance = useRef<any>(null);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring", stiffness: 300, damping: 24 },
    },
  };

  useEffect(() => {
    if (!user) return;

    apiGet<ProgressData>(`/api/users/${user.id}/progress`)
      .then((res) => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch skill vector
    apiGet<{ skill: string; score: number; attempt_count: number }[]>(
      `/api/users/${user.id}/skill-vector`,
    )
      .then((res) => {
        if (res.success && Array.isArray(res.data)) setSkillVector(res.data);
      })
      .catch(() => {});
  }, [user]);

  const loadChartJS = () => {
    return new Promise<void>((resolve) => {
      if ((window as any).Chart) {
        resolve();
        return;
      }
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js";
      script.onload = () => resolve();
      document.head.appendChild(script);
    });
  };

  // Load Chart.js and render charts
  useEffect(() => {
    if (!data || data.sessions.length === 0) return;

    loadChartJS().then(() => {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      const labels = data.sessions.map((s) =>
        new Date(s.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
      );
      const latestSession = data.sessions[data.sessions.length - 1];

      const chartAnimation = {
        duration: 900,
        easing: "easeOutCubic",
        animations: {
          y: { from: 0 },
          r: { from: 0 },
        },
      };

      const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        animation: chartAnimation,
        plugins: {
          legend: {
            labels: { color: "#9ca3af", font: { size: 11 } },
          },
        },
        scales: {
          x: {
            ticks: { color: "#6b7280" },
            grid: { color: "rgba(255,255,255,0.035)" },
          },
          y: {
            ticks: { color: "#6b7280" },
            grid: { color: "rgba(255,255,255,0.035)" },
            min: 0,
            max: 10,
          },
        },
      };

      // 1. Overall Score Line Chart
      if (overallChartRef.current) {
        overallChartInstance.current?.destroy();
        overallChartInstance.current = new Chart(overallChartRef.current, {
          type: "line",
          data: {
            labels,
            datasets: [
              {
                label: "Overall Score",
                data: data.sessions.map((s) => s.overallScore),
                borderColor: "rgba(249, 115, 22, 0.85)",
                backgroundColor: "rgba(249, 115, 22, 0.06)",
                tension: 0.32,
                fill: true,
                pointBackgroundColor: "rgba(249, 115, 22, 0.85)",
                pointBorderColor: "rgba(249, 115, 22, 0.85)",
                pointRadius: 2,
              },
            ],
          },
          options: chartDefaults,
        });
      }

      // 2. STAR Dimensions Multi-Line Chart
      if (starChartRef.current) {
        starChartInstance.current?.destroy();
        starChartInstance.current = new Chart(starChartRef.current, {
          type: "radar",
          data: {
            labels: ["Situation", "Task", "Action", "Result"],
            datasets: [
              {
                label: "Latest STAR Profile",
                data: [
                  latestSession.starScores.situation,
                  latestSession.starScores.task,
                  latestSession.starScores.action,
                  latestSession.starScores.result,
                ],
                borderColor: "rgba(249, 115, 22, 0.85)",
                backgroundColor: "rgba(249, 115, 22, 0.14)",
                tension: 0.32,
                pointRadius: 2,
                pointBackgroundColor: "rgba(249, 115, 22, 0.9)",
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: chartAnimation,
            plugins: {
              legend: {
                labels: { color: "#9ca3af", font: { size: 11 } },
              },
            },
            scales: {
              r: {
                min: 0,
                max: 10,
                ticks: { color: "#6b7280", backdropColor: "transparent" },
                grid: { color: "rgba(255,255,255,0.05)" },
                angleLines: { color: "rgba(255,255,255,0.05)" },
                pointLabels: { color: "#9ca3af", font: { size: 11 } },
              },
            },
          },
        });
      }

      // 3. Filler Rate Bar Chart
      if (fillerChartRef.current) {
        fillerChartInstance.current?.destroy();
        fillerChartInstance.current = new Chart(fillerChartRef.current, {
          type: "bar",
          data: {
            labels,
            datasets: [
              {
                label: "Fillers/min",
                data: data.sessions.map((s) => s.fillerRate),
                backgroundColor: data.sessions.map(
                  () => "rgba(249, 115, 22, 0.35)",
                ),
                borderColor: data.sessions.map(() => "rgba(249, 115, 22, 0.6)"),
                borderWidth: 1,
                borderRadius: 6,
              },
            ],
          },
          options: {
            ...chartDefaults,
            scales: {
              ...chartDefaults.scales,
              y: { ...chartDefaults.scales.y, max: undefined },
            },
          },
        });
      }
    });

    return () => {
      overallChartInstance.current?.destroy();
      overallChartInstance.current = null;
      starChartInstance.current?.destroy();
      starChartInstance.current = null;
      fillerChartInstance.current?.destroy();
      fillerChartInstance.current = null;
    };
  }, [data]);

  // Render skill chart separately to avoid missing it when skill data arrives after main charts.
  useEffect(() => {
    if (!skillVector.length) return;

    loadChartJS().then(() => {
      const Chart = (window as any).Chart;
      if (!Chart || !skillChartRef.current) return;

      const labels = skillVector.map((sv) => sv.skill.replace(/_/g, " "));
      const values = skillVector.map((sv) => {
        const score = parseFloat(sv.score as unknown as string) || 0;
        return score;
      });

      skillChartInstance.current?.destroy();
      skillChartInstance.current = new Chart(skillChartRef.current, {
        type: "doughnut",
        data: {
          labels,
          datasets: [
            {
              data: values,
              backgroundColor: [
                "rgba(249, 115, 22, 0.65)",
                "rgba(229, 231, 235, 0.8)",
                "rgba(209, 213, 219, 0.8)",
                "rgba(156, 163, 175, 0.8)",
                "rgba(107, 114, 128, 0.8)",
                "rgba(75, 85, 99, 0.8)",
              ],
              borderColor: "rgba(17, 24, 39, 0.7)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 1000,
            easing: "easeOutCubic",
            animateRotate: true,
            animateScale: true,
          },
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: "#9ca3af",
                boxWidth: 10,
                boxHeight: 10,
                padding: 12,
                font: { size: 11 },
              },
            },
          },
        },
      });
    });

    return () => {
      skillChartInstance.current?.destroy();
      skillChartInstance.current = null;
    };
  }, [skillVector]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center w-full min-h-[60vh]">
        <div className="flex flex-col items-center gap-4 text-[var(--c-text-dim)]">
          <Loader2 className="animate-spin text-[var(--c-accent)]" size={32} />
          <p className="text-[15px] font-medium">Loading your progress…</p>
        </div>
      </div>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <div className="flex flex-col w-full max-w-[1100px] items-start gap-6 self-start mx-auto py-4 px-4 md:px-6 pb-16">
        <div className="flex flex-col items-center justify-center gap-4 text-center text-[var(--c-text-dim)] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] w-full shadow-sm p-8 sm:p-16">
          <BarChart3
            size={48}
            className="mb-2 text-[var(--c-text-mute)]"
            strokeWidth={1.5}
          />
          <h2 className="text-[24px] font-bold text-[var(--c-text)] m-0">
            No Sessions Yet
          </h2>
          <p className="text-[15px]">
            Complete your first interview to see progress analytics
          </p>
        </div>
      </div>
    );
  }

  const latestSession = data.sessions[data.sessions.length - 1];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="flex flex-col w-full max-w-[1100px] items-start gap-6 self-start mx-auto py-4 px-4 md:px-6 pb-16"
    >
      <motion.div variants={itemVariants} className="text-center w-full">
        <h1 className="text-[30px] font-black tracking-tight m-0 text-[var(--c-text)]">
          Progress Dashboard
        </h1>
        <p className="text-[13px] text-[var(--c-text-dim)] mt-2 uppercase tracking-wide">
          {data.totalSessions} sessions completed
        </p>
      </motion.div>

      {/* Gamification summary bar */}
      {gStats && (
        <motion.div variants={itemVariants} className="w-full">
          <div className="flex flex-col md:flex-row items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] w-full px-5 py-4">
            <div className="flex-1 w-full">
              <XPBar
                compact
                xp={gStats.xp}
                level={gStats.level}
                xpToNext={gStats.xpToNextLevel}
              />
            </div>
            <StreakWidget
              currentStreak={gStats.currentStreak}
              longestStreak={gStats.longestStreak}
              lastPracticeDate={gStats.lastPracticeDate}
            />
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full"
      >
        <div className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] p-5">
          <div className="flex items-center justify-center w-[36px] h-[36px] rounded-lg bg-[var(--c-surface-2)] text-[var(--c-text-dim)]">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight">
              {latestSession.confidenceAvg}%
            </span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
              Confidence Avg
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] p-5">
          <div className="flex items-center justify-center w-[36px] h-[36px] rounded-lg bg-[var(--c-surface-2)] text-[var(--c-text-dim)]">
            <Trophy size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight capitalize">
              {data.improvement.strongestDimension}
            </span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
              Strongest Area
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] p-5">
          <div className="flex items-center justify-center w-[36px] h-[36px] rounded-lg bg-[var(--c-surface-2)] text-[var(--c-text-dim)]">
            <Target size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight capitalize">
              {data.improvement.weakestDimension}
            </span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
              Focus Area
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] p-5">
          <div className="flex items-center justify-center w-[36px] h-[36px] rounded-lg bg-[var(--c-surface-2)] text-[var(--c-text-dim)]">
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight">
              {data.totalSessions}
            </span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">
              Total Sessions
            </span>
          </div>
        </div>
      </motion.div>

      {/* Charts */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full"
      >
        <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] w-full p-5 md:p-6">
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">
            Overall Score Trend
          </h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={overallChartRef} />
          </div>
        </div>

        <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] w-full p-5 md:p-6">
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">
            STAR Snapshot
          </h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={starChartRef} />
          </div>
        </div>

        <div className="col-span-1 lg:col-span-2 flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] w-full p-5 md:p-6">
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">
            Filler Word Rate (Lower = Better)
          </h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={fillerChartRef} />
          </div>
        </div>
      </motion.div>

      {/* Improvement insight */}
      <motion.div variants={itemVariants} className="w-full">
        <div className="text-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] w-full p-5 md:p-6">
          <h3 className="text-[14px] font-semibold text-[var(--c-text-dim)] mb-2">
            Clarity Improvement
          </h3>
          <p className="text-[24px] font-extrabold text-[var(--c-text)] tracking-tight m-0">
            {data.improvement.clarityDelta}
          </p>
        </div>
      </motion.div>

      {/* Skill Vector */}
      {skillVector.length > 0 && (
        <motion.div variants={itemVariants} className="w-full">
          <div className="flex flex-col w-full bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] p-5 md:p-6">
            <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">
              Skill Vector (Adaptive Difficulty)
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-5 items-center">
              <div className="relative h-[300px] w-full">
                <canvas ref={skillChartRef} />
              </div>
              <div className="flex flex-col gap-2">
                {skillVector.map((sv) => {
                  const score = parseFloat(sv.score as unknown as string) || 0;
                  return (
                    <div
                      key={sv.skill}
                      className="flex items-center justify-between px-3 py-2 rounded-lg border border-[var(--c-border)] bg-[var(--c-surface-2)]"
                    >
                      <span className="text-[12px] font-semibold text-[var(--c-text-dim)] capitalize truncate pr-3">
                        {sv.skill.replace(/_/g, " ")}
                      </span>
                      <span className="text-[13px] font-bold text-[var(--c-text)] tabular-nums">
                        {score.toFixed(1)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="text-[11px] font-medium text-[var(--c-text-dim)] mt-5 text-center">
              Scores update after each evaluated session using Exponential
              Moving Average
            </p>
          </div>
        </motion.div>
      )}

      {/* Session History Table */}
      <motion.div variants={itemVariants} className="w-full mt-4">
        <SessionHistory />
      </motion.div>
    </motion.div>
  );
}

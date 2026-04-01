import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';
import { SessionHistory } from './SessionHistory';
import { XPBar } from './XPBar';
import { StreakWidget } from './StreakWidget';
import { useGamificationStats } from '../hooks/useGamificationStats';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { Activity, Trophy, Target, TrendingUp, BarChart3, Loader2 } from 'lucide-react';

interface ProgressSession {
  sessionId: string;
  date: string;
  overallScore: number;
  starScores: { situation: number; task: number; action: number; result: number };
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
  const [skillVector, setSkillVector] = useState<{skill: string; score: number; attempt_count: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const chartsRendered = useRef(false);
  const { stats: gStats } = useGamificationStats(user?.id);

  const overallChartRef = useRef<HTMLCanvasElement>(null);
  const starChartRef = useRef<HTMLCanvasElement>(null);
  const fillerChartRef = useRef<HTMLCanvasElement>(null);

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } }
  };

  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  useEffect(() => {
    if (!user) return;

    apiGet<ProgressData>(`/api/users/${user.id}/progress`)
      .then(res => {
        if (res.success) setData(res.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch skill vector
    apiGet<{skill: string; score: number; attempt_count: number}[]>(`/api/users/${user.id}/skill-vector`)
      .then(res => {
        if (res.success && Array.isArray(res.data)) setSkillVector(res.data);
      })
      .catch(() => {});
  }, [user]);

  // Load Chart.js and render charts
  useEffect(() => {
    if (!data || data.sessions.length === 0 || chartsRendered.current) return;

    const loadChartJS = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).Chart) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js';
        script.onload = () => resolve();
        document.head.appendChild(script);
      });
    };

    loadChartJS().then(() => {
      const Chart = (window as any).Chart;
      if (!Chart) return;

      chartsRendered.current = true;

      const labels = data.sessions.map(s =>
        new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      );

      const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#9ca3af', font: { family: 'Inter', size: 11 } }
          }
        },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: 'rgba(255,255,255,0.05)' }, min: 0, max: 10 }
        }
      };

      // 1. Overall Score Line Chart
      if (overallChartRef.current) {
        new Chart(overallChartRef.current, {
          type: 'line',
          data: {
            labels,
            datasets: [{
              label: 'Overall Score',
              data: data.sessions.map(s => s.overallScore),
              borderColor: '#f97316',
              backgroundColor: 'rgba(249, 115, 22, 0.1)',
              tension: 0.4,
              fill: true,
              pointBackgroundColor: '#f97316',
              pointBorderColor: '#f97316',
              pointRadius: 4,
            }]
          },
          options: chartDefaults,
        });
      }

      // 2. STAR Dimensions Multi-Line Chart
      if (starChartRef.current) {
        new Chart(starChartRef.current, {
          type: 'line',
          data: {
            labels,
            datasets: [
              {
                label: 'Situation',
                data: data.sessions.map(s => s.starScores.situation),
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                pointRadius: 3,
              },
              {
                label: 'Task',
                data: data.sessions.map(s => s.starScores.task),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                tension: 0.4,
                pointRadius: 3,
              },
              {
                label: 'Action',
                data: data.sessions.map(s => s.starScores.action),
                borderColor: '#22c55e',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                tension: 0.4,
                pointRadius: 3,
              },
              {
                label: 'Result',
                data: data.sessions.map(s => s.starScores.result),
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                tension: 0.4,
                pointRadius: 3,
              },
            ]
          },
          options: chartDefaults,
        });
      }

      // 3. Filler Rate Bar Chart
      if (fillerChartRef.current) {
        new Chart(fillerChartRef.current, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Fillers/min',
              data: data.sessions.map(s => s.fillerRate),
              backgroundColor: data.sessions.map(s => {
                if (s.fillerRate <= 1) return 'rgba(34, 197, 94, 0.7)';
                if (s.fillerRate <= 3) return 'rgba(251, 191, 36, 0.7)';
                return 'rgba(239, 68, 68, 0.7)';
              }),
              borderRadius: 6,
            }]
          },
          options: {
            ...chartDefaults,
            scales: {
              ...chartDefaults.scales,
              y: { ...chartDefaults.scales.y, max: undefined }
            }
          },
        });
      }
    });
  }, [data]);

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
      <div className="flex flex-col w-full max-w-[1100px] items-start gap-6 self-start mx-auto" style={{ padding: '16px 24px 64px 24px' }}>
        <div 
          className="flex flex-col items-center justify-center gap-4 text-center text-[var(--c-text-dim)] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] w-full shadow-sm"
          style={{ padding: '64px' }}
        >
          <BarChart3 size={48} className="mb-2 text-[var(--c-text-mute)]" strokeWidth={1.5} />
          <h2 className="text-[24px] font-bold text-[var(--c-text)] m-0">No Sessions Yet</h2>
          <p className="text-[15px]">Complete your first interview to see progress analytics</p>
        </div>
      </div>
    );
  }

  const latestSession = data.sessions[data.sessions.length - 1];

  return (
    <motion.div 
      variants={containerVariants} initial="hidden" animate="show"
      className="flex flex-col w-full max-w-[1100px] items-start gap-6 self-start mx-auto" 
      style={{ padding: '16px 24px 64px 24px' }}
    >
      <motion.div variants={itemVariants} className="text-center w-full">
        <h1 className="text-[32px] font-black tracking-tight m-0 text-[var(--c-text)]">Progress Dashboard</h1>
        <p className="text-[14px] text-[var(--c-text-dim)] mt-2">{data.totalSessions} sessions completed</p>
      </motion.div>

      {/* Gamification summary bar */}
      {gStats && (
        <motion.div variants={itemVariants} className="w-full">
          <div 
            className="flex flex-col md:flex-row items-center gap-4 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
            style={{ padding: '16px 20px' }}
          >
            <div className="flex-1 w-full"><XPBar compact xp={gStats.xp} level={gStats.level} xpToNext={gStats.xpToNextLevel} /></div>
            <StreakWidget
              currentStreak={gStats.currentStreak}
              longestStreak={gStats.longestStreak}
              lastPracticeDate={gStats.lastPracticeDate}
            />
          </div>
        </motion.div>
      )}

      {/* Stat Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        <div 
          className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm"
          style={{ padding: '20px' }}
        >
          <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-orange-500/10 text-[var(--c-accent)]">
            <Activity size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight">{latestSession.confidenceAvg}%</span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Confidence Avg</span>
          </div>
        </div>

        <div 
          className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm"
          style={{ padding: '20px' }}
        >
          <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-blue-500/10 text-blue-500">
            <Trophy size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight capitalize">{data.improvement.strongestDimension}</span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Strongest Area</span>
          </div>
        </div>

        <div 
          className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm"
          style={{ padding: '20px' }}
        >
          <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-red-500/10 text-red-500">
            <Target size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight capitalize">{data.improvement.weakestDimension}</span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Focus Area</span>
          </div>
        </div>

        <div 
          className="flex flex-col gap-3 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[20px] shadow-sm"
          style={{ padding: '20px' }}
        >
          <div className="flex items-center justify-center w-[40px] h-[40px] rounded-xl bg-green-500/10 text-green-500">
            <TrendingUp size={20} strokeWidth={2.5} />
          </div>
          <div className="flex flex-col">
            <span className="text-[20px] font-extrabold text-[var(--c-text)] tracking-tight">{data.totalSessions}</span>
            <span className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider">Total Sessions</span>
          </div>
        </div>
      </motion.div>

      {/* Charts */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4 w-full">
        <div 
          className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
          style={{ padding: '24px' }}
        >
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">Overall Score Trend</h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={overallChartRef} />
          </div>
        </div>

        <div 
          className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
          style={{ padding: '24px' }}
        >
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">STAR Dimensions</h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={starChartRef} />
          </div>
        </div>

        <div 
          className="col-span-1 lg:col-span-2 flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
          style={{ padding: '24px' }}
        >
          <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">Filler Word Rate (Lower = Better)</h3>
          <div className="relative h-[260px] w-full">
            <canvas ref={fillerChartRef} />
          </div>
        </div>
      </motion.div>

      {/* Improvement insight */}
      <motion.div variants={itemVariants} className="w-full">
        <div 
          className="text-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm w-full"
          style={{ padding: '24px' }}
        >
          <h3 className="text-[14px] font-semibold text-[var(--c-text-dim)] mb-2">Clarity Improvement</h3>
          <p className="text-[24px] font-extrabold text-[var(--c-success)] tracking-tight m-0">{data.improvement.clarityDelta}</p>
        </div>
      </motion.div>

      {/* Skill Vector */}
      {skillVector.length > 0 && (
        <motion.div variants={itemVariants} className="w-full">
          <div 
            className="flex flex-col w-full bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm"
            style={{ padding: '24px' }}
          >
            <h3 className="text-[14px] font-bold tracking-wide mb-4 text-[var(--c-text)]">Skill Vector (Adaptive Difficulty)</h3>
            <div className="flex flex-col gap-4">
              {skillVector.map(sv => {
                const score = parseFloat(sv.score as unknown as string) || 0;
                return (
                  <div key={sv.skill} className="flex items-center gap-3 w-full">
                    <span className="w-[140px] text-[12px] font-semibold text-[var(--c-text-dim)] shrink-0 capitalize truncate">
                      {sv.skill.replace(/_/g, ' ')}
                    </span>
                    <div className="flex-1 h-[10px] bg-[var(--c-surface-2)] rounded-full overflow-hidden shrink-1">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(score / 10) * 100}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 min-w-[2px]"
                      />
                    </div>
                    <span className="w-[36px] text-right text-[13px] font-extrabold text-[var(--c-text)] shrink-0 tabular-nums">
                      {score.toFixed(1)}
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] font-medium text-[var(--c-text-dim)] mt-5 text-center">
              Scores update after each evaluated session using Exponential Moving Average
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

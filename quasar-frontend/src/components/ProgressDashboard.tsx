import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { apiGet } from '../lib/api';
import { SessionHistory } from './SessionHistory';

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

  const overallChartRef = useRef<HTMLCanvasElement>(null);
  const starChartRef = useRef<HTMLCanvasElement>(null);
  const fillerChartRef = useRef<HTMLCanvasElement>(null);

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
      <div className="progress-page">
        <div className="progress-loading">
          <div className="spinner" />
          <p>Loading your progress…</p>
        </div>
      </div>
    );
  }

  if (!data || data.sessions.length === 0) {
    return (
      <div className="progress-page">
        <div className="progress-empty">
          <div className="progress-empty__icon">📊</div>
          <h2>No Sessions Yet</h2>
          <p>Complete your first interview to see progress analytics</p>
        </div>
      </div>
    );
  }

  const latestSession = data.sessions[data.sessions.length - 1];

  return (
    <div className="progress-page">
      <div className="progress-header">
        <h1 className="progress-header__title">Progress Dashboard</h1>
        <p className="progress-header__subtitle">{data.totalSessions} sessions completed</p>
      </div>

      {/* Stat Cards */}
      <div className="stat-cards">
        <div className="stat-card">
          <div className="stat-card__icon">💪</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{latestSession.confidenceAvg}%</span>
            <span className="stat-card__label">Confidence Avg</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">🏆</div>
          <div className="stat-card__content">
            <span className="stat-card__value" style={{ textTransform: 'capitalize' }}>{data.improvement.strongestDimension}</span>
            <span className="stat-card__label">Strongest Area</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">🎯</div>
          <div className="stat-card__content">
            <span className="stat-card__value" style={{ textTransform: 'capitalize' }}>{data.improvement.weakestDimension}</span>
            <span className="stat-card__label">Focus Area</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card__icon">📈</div>
          <div className="stat-card__content">
            <span className="stat-card__value">{data.totalSessions}</span>
            <span className="stat-card__label">Total Sessions</span>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="chart-grid">
        <div className="chart-container">
          <h3 className="chart-title">Overall Score Trend</h3>
          <div className="chart-wrapper">
            <canvas ref={overallChartRef} />
          </div>
        </div>

        <div className="chart-container">
          <h3 className="chart-title">STAR Dimensions</h3>
          <div className="chart-wrapper">
            <canvas ref={starChartRef} />
          </div>
        </div>

        <div className="chart-container chart-container--full">
          <h3 className="chart-title">Filler Word Rate (Lower = Better)</h3>
          <div className="chart-wrapper">
            <canvas ref={fillerChartRef} />
          </div>
        </div>
      </div>

      {/* Improvement insight */}
      <div className="improvement-card">
        <h3>Clarity Improvement</h3>
        <p className="improvement-card__delta">{data.improvement.clarityDelta}</p>
      </div>

      {/* Skill Vector */}
      {skillVector.length > 0 && (
        <div className="eval-section" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 'var(--r-xl)', padding: 'var(--space-6)' }}>
          <h3 className="eval-section__title">Skill Vector (Adaptive Difficulty)</h3>
          <div className="eval-bars">
            {skillVector.map(sv => {
              const score = parseFloat(sv.score as unknown as string) || 0;
              return (
              <div key={sv.skill} className="eval-bar-row">
                <span className="eval-bar-label" style={{ textTransform: 'capitalize' }}>
                  {sv.skill.replace(/_/g, ' ')}
                </span>
                <div className="eval-bar-track">
                  <div
                    className="eval-bar-fill eval-bar-fill--purple"
                    style={{ width: `${(score / 10) * 100}%` }}
                  />
                </div>
                <span className="eval-bar-score">{score.toFixed(1)}</span>
              </div>
              );
            })}
          </div>
          <p style={{ fontSize: '11px', color: 'var(--c-text-mute)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
            Scores update after each evaluated session using Exponential Moving Average
          </p>
        </div>
      )}

      {/* Session History Table */}
      <SessionHistory />
    </div>
  );
}

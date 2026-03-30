import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';

interface SessionRecord {
  id: string;
  domain: string;
  persona_name: string | null;
  status: string;
  overall_score: number | null;
  star_scores: Record<string, number> | null;
  clarity_score: number | null;
  duration_seconds: number | null;
  started_at: string;
  ended_at: string | null;
}

export function SessionHistory() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<SessionRecord[]>('/api/user/sessions')
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setSessions(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '—';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="session-history">
        <h3 className="session-history__title">Session History</h3>
        <div className="progress-loading"><div className="spinner" /></div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="session-history">
        <h3 className="session-history__title">Session History</h3>
        <p className="session-history__empty">No sessions yet. Start an interview to see your history here.</p>
      </div>
    );
  }

  return (
    <div className="session-history">
      <h3 className="session-history__title">Session History</h3>
      <div className="session-table-wrapper">
        <table className="session-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Domain</th>
              <th>Persona</th>
              <th>Duration</th>
              <th>Score</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td className="session-table__date">{formatDate(s.started_at)}</td>
                <td className="session-table__domain">{s.domain}</td>
                <td className="session-table__persona">{s.persona_name || '—'}</td>
                <td className="session-table__duration">{formatDuration(s.duration_seconds)}</td>
                <td>
                  {s.overall_score != null ? (
                    <span className={`session-score-pill ${s.overall_score >= 6.5 ? 'session-score-pill--pass' : 'session-score-pill--fail'}`}>
                      {s.overall_score.toFixed(1)}
                    </span>
                  ) : (
                    <span className="session-score-pill session-score-pill--na">—</span>
                  )}
                </td>
                <td>
                  <span className={`session-status-badge session-status-badge--${s.status}`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

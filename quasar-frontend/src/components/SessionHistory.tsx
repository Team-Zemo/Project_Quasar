import { useState, useEffect } from 'react';
import { apiGet } from '../lib/api';
import { Loader2 } from 'lucide-react';

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
      <div className="flex flex-col gap-5 w-full">
        <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Session History</h3>
        <div 
          className="flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] shadow-sm w-full"
          style={{ padding: '64px' }}
        >
          <Loader2 className="animate-spin text-[var(--c-accent)] mb-3" size={32} />
          <p className="text-[14px] font-medium text-[var(--c-text-dim)]">Loading history...</p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col gap-5 w-full">
        <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Session History</h3>
        <div 
          className="flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] shadow-sm w-full"
          style={{ padding: '64px' }}
        >
          <p className="text-[14px] font-medium text-[var(--c-text-dim)] text-center">No sessions yet.<br />Start an interview to see your history here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">Session History</h3>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] overflow-x-auto shadow-sm w-full">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[var(--c-surface-2)]">
              {['Date', 'Domain', 'Persona', 'Duration', 'Score', 'Status'].map(h => (
                <th key={h} className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider border-b border-[var(--c-border)] whitespace-nowrap" style={{ padding: '16px 20px' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, idx) => (
              <tr key={s.id} className={`group transition-colors hover:bg-[var(--c-surface-2)] ${idx !== sessions.length - 1 ? 'border-b border-[var(--c-border)]/50' : ''}`}>
                <td className="text-[13px] font-medium text-[var(--c-text-dim)] whitespace-nowrap" style={{ padding: '16px 20px' }}>
                  {formatDate(s.started_at)}
                </td>
                <td className="text-[14px] font-bold text-[var(--c-text)]" style={{ padding: '16px 20px' }}>
                  {s.domain}
                </td>
                <td className="text-[13px] text-[var(--c-text-mute)]" style={{ padding: '16px 20px' }}>
                  {s.persona_name || '—'}
                </td>
                <td className="text-[13px] font-medium text-[var(--c-text-dim)]" style={{ padding: '16px 20px' }}>
                  {formatDuration(s.duration_seconds)}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  {s.overall_score != null ? (
                    <span 
                      className={`inline-flex items-center justify-center min-w-[36px] h-[24px] rounded-full text-[12px] font-bold border ${
                        s.overall_score >= 6.5 
                          ? 'bg-green-500/10 text-green-500 border-green-500/20 shadow-sm' 
                          : 'bg-red-500/10 text-red-500 border-red-500/20 shadow-sm'
                      }`}
                      style={{ padding: '0 8px' }}
                    >
                      {s.overall_score.toFixed(1)}
                    </span>
                  ) : (
                    <span 
                      className="inline-flex items-center justify-center min-w-[36px] h-[24px] rounded-full text-[12px] font-bold bg-[var(--c-surface-3)] text-[var(--c-text-dim)] border border-[var(--c-border)]"
                      style={{ padding: '0 8px' }}
                    >
                      —
                    </span>
                  )}
                </td>
                <td style={{ padding: '16px 20px' }}>
                  <span 
                    className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border shadow-sm ${
                      s.status === 'completed' 
                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        : s.status === 'error'
                        ? 'bg-red-500/10 text-red-400 border-red-500/20'
                        : 'bg-[var(--c-surface-3)] text-[var(--c-text-dim)] border-[var(--c-border)]'
                    }`}
                    style={{ padding: '4px 10px' }}
                  >
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

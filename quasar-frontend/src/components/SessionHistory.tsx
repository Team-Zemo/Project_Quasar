import { Loader2, Star, Award, MessageSquare, X } from 'lucide-react';
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "../lib/api";

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
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessionDetails, setSessionDetails] = useState<any | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const openModal = async (id: string) => {
    setSelectedSessionId(id);
    setSessionDetails(null);
    setLoadingDetails(true);
    try {
      const res = await apiGet<any>(`/api/sessions/${id}`);
      if (res.success) {
        setSessionDetails(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const closeModal = () => {
    setSelectedSessionId(null);
    setSessionDetails(null);
  };

  useEffect(() => {
    apiGet<SessionRecord[]>("/api/user/sessions")
      .then((res) => {
        if (res.success && Array.isArray(res.data)) {
          setSessions(res.data);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-5 w-full">
        <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">
          Session History
        </h3>
        <div className="flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] shadow-sm w-full p-8 sm:p-16">
          <Loader2
            className="animate-spin text-[var(--c-accent)] mb-3"
            size={32}
          />
          <p className="text-[14px] font-medium text-[var(--c-text-dim)]">
            Loading history...
          </p>
        </div>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col gap-5 w-full">
        <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">
          Session History
        </h3>
        <div className="flex flex-col items-center justify-center bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] shadow-sm w-full p-8 sm:p-16">
          <p className="text-[14px] font-medium text-[var(--c-text-dim)] text-center">
            No sessions yet.
            <br />
            Start an interview to see your history here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 w-full">
      <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0">
        Session History
      </h3>
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] overflow-x-auto shadow-sm w-full">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="bg-[var(--c-surface-2)]">
              {["Date", "Domain", "Persona", "Duration", "Score", "Status"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-[11px] font-bold text-[var(--c-text-mute)] uppercase tracking-wider border-b border-[var(--c-border)] whitespace-nowrap"
                    style={{ padding: "16px 20px" }}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s, idx) => (
              <tr
                key={s.id}
                className={`group transition-colors hover:bg-[var(--c-surface-2)] cursor-pointer ${idx !== sessions.length - 1 ? "border-b border-[var(--c-border)]/50" : ""} ${selectedSessionId === s.id ? "bg-[var(--c-surface-2)]/30" : ""}`}
                onClick={() => openModal(s.id)}
              >
                <td
                  className="text-[13px] font-medium text-[var(--c-text-dim)] whitespace-nowrap"
                  style={{ padding: "16px 20px" }}
                >
                  {formatDate(s.started_at)}
                </td>
                <td
                  className="text-[14px] font-bold text-[var(--c-text)]"
                  style={{ padding: "16px 20px" }}
                >
                  {s.domain}
                </td>
                <td
                  className="text-[13px] text-[var(--c-text-mute)]"
                  style={{ padding: "16px 20px" }}
                >
                  {s.persona_name || "—"}
                </td>
                <td
                  className="text-[13px] font-medium text-[var(--c-text-dim)]"
                  style={{ padding: "16px 20px" }}
                >
                  {formatDuration(s.duration_seconds)}
                </td>
                <td style={{ padding: "16px 20px" }}>
                  {s.overall_score != null ? (
                    <span
                      className={`inline-flex items-center justify-center min-w-[36px] h-[24px] rounded-full text-[12px] font-bold border ${
                        s.overall_score >= 6.5
                          ? "bg-[var(--c-surface-2)] text-[var(--c-text)] border-[var(--c-border)]"
                          : "bg-[var(--c-surface-2)] text-[var(--c-text-dim)] border-[var(--c-border)]"
                      }`}
                      style={{ padding: "0 8px" }}
                    >
                      {s.overall_score.toFixed(1)}
                    </span>
                  ) : (
                    <span
                      className="inline-flex items-center justify-center min-w-[36px] h-[24px] rounded-full text-[12px] font-bold bg-[var(--c-surface-3)] text-[var(--c-text-dim)] border border-[var(--c-border)]"
                      style={{ padding: "0 8px" }}
                    >
                      —
                    </span>
                  )}
                </td>
                <td style={{ padding: "16px 20px" }}>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest border shadow-sm ${
                      s.status === "completed"
                        ? "bg-[var(--c-surface-2)] text-[var(--c-text)] border-[var(--c-border)]"
                        : s.status === "error"
                          ? "bg-[var(--c-surface-2)] text-[var(--c-text-dim)] border-[var(--c-border)]"
                          : "bg-[var(--c-surface-3)] text-[var(--c-text-dim)] border-[var(--c-border)]"
                    }`}
                    style={{ padding: "4px 10px" }}
                  >
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Floating Modal for Details */}
      {selectedSessionId && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
          style={{ zIndex: 999999 }}
          onClick={closeModal}
        >
          <div
            className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] w-full max-w-4xl max-h-[90vh] shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--c-border)] bg-[var(--c-surface)]">
              <h3 className="text-[18px] font-extrabold text-[var(--c-text)] m-0 flex items-center gap-2">
                <MessageSquare size={20} className="text-[var(--c-accent)]" />
                Diagnostic Session Details
              </h3>
              <button
                onClick={closeModal}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)] hover:text-[var(--c-text)] transition-colors focus:outline-none"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex flex-col flex-1 overflow-y-auto p-6 md:p-8 gap-8 bg-[var(--c-surface)]">
              {loadingDetails ? (
                <div className="flex flex-col flex-1 items-center justify-center py-20 min-h-[300px]">
                  <Loader2 className="animate-spin text-[var(--c-accent)] mb-4" size={36} />
                  <p className="text-[15px] font-medium text-[var(--c-text-dim)]">Pulling session telemetry and transcript...</p>
                </div>
              ) : sessionDetails ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-6">
                    {/* Context Column */}
                    <div className="flex flex-col bg-[var(--c-surface-2)]/30 rounded-[20px] p-5 border border-[var(--c-border)]/50">
                      <span className="text-[11px] font-black text-[var(--c-text-mute)] uppercase tracking-widest mb-3">Context & Meta</span>
                      <div className="flex flex-col gap-2">
                        <div>
                          <p className="text-[11px] text-[var(--c-text-dim)] uppercase font-semibold mb-0.5">Domain</p>
                          <div className="text-[15px] font-extrabold text-[var(--c-text)]">{sessionDetails.domain || 'N/A'}</div>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--c-text-dim)] uppercase font-semibold mb-0.5 mt-2">Persona</p>
                          <div className="text-[14px] font-semibold text-[var(--c-text)]">{sessionDetails.persona_name || 'N/A'}</div>
                        </div>
                        <div>
                          <p className="text-[11px] text-[var(--c-text-dim)] uppercase font-semibold mb-0.5 mt-2">Date</p>
                          <div className="text-[14px] font-medium text-[var(--c-text)]">{formatDate(sessionDetails.startedAt || sessionDetails.createdAt)}</div>
                        </div>
                        <div className="text-[12px] font-mono text-[var(--c-text-mute)] mt-3 bg-[var(--c-surface-3)] px-2 py-1 rounded-md inline-block w-fit">
                          ID: {sessionDetails._id}
                        </div>
                      </div>
                    </div>

                    {/* Stats Grid Column */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {['situation', 'task', 'action', 'result'].map(k => (
                        <div key={k} className="flex flex-col justify-center bg-[var(--c-surface-2)]/50 p-4 rounded-[20px] border border-[var(--c-border)]/50">
                          <span className="text-[11px] font-black text-[var(--c-text-mute)] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <Star size={14} className="text-yellow-500" />
                            {k}
                          </span>
                          <span className="text-[24px] font-extrabold text-[var(--c-text)]">
                            {sessionDetails.starScores?.[k] != null ? Number(sessionDetails.starScores[k]).toFixed(1) : '—'}
                          </span>
                        </div>
                      ))}

                      <div className="flex flex-col justify-center bg-blue-500/5 p-4 rounded-[20px] border border-blue-500/20">
                        <span className="text-[11px] font-black text-blue-500/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Award size={14} className="text-blue-500" />
                          Clarity
                        </span>
                        <span className="text-[24px] font-extrabold text-blue-500">
                          {sessionDetails.clarityScore != null ? Number(sessionDetails.clarityScore).toFixed(1) : '—'}
                        </span>
                      </div>

                      <div className="flex flex-col justify-center bg-orange-500/5 p-4 rounded-[20px] border border-orange-500/20">
                        <span className="text-[11px] font-black text-orange-500/70 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                          <Star size={14} className="text-orange-500" />
                          Overall
                        </span>
                        <span className="text-[24px] font-extrabold text-orange-500">
                          {sessionDetails.overallScore != null ? Number(sessionDetails.overallScore).toFixed(1) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Transcript */}
                  <div className="flex flex-col bg-[var(--c-surface)] rounded-[20px] border border-[var(--c-border)] overflow-hidden shadow-sm">
                    <div className="bg-[var(--c-surface-2)] px-5 py-3 border-b border-[var(--c-border)]">
                      <span className="text-[12px] font-extrabold text-[var(--c-text-mute)] uppercase tracking-widest">Full Session Transcript</span>
                    </div>
                    {sessionDetails.transcript ? (
                      <div className="p-5 text-[14px] leading-[1.7] text-[var(--c-text-dim)] max-h-[350px] overflow-y-auto whitespace-pre-wrap font-mono relative">
                        {sessionDetails.transcript}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-[var(--c-text-mute)] text-[14px] font-medium bg-[var(--c-surface-2)]/20 italic">
                        No audio transcripts were recovered from this particular session.
                      </div>
                    )}
                  </div>

                  {/* Other Diagnostics */}
                  {sessionDetails.emotionMetrics && sessionDetails.emotionMetrics.length > 0 && (
                    <div className="flex items-center justify-between bg-purple-500/5 border border-purple-500/20 p-4 rounded-xl">
                       <span className="text-[12px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-2">
                         <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></span>
                         Emotion Telemetry Active
                       </span>
                       <span className="text-[13px] font-medium text-purple-400">
                         {sessionDetails.emotionMetrics.length} data points logged
                       </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-[var(--c-text-mute)] text-[15px] font-medium">Failed to load detailed session metrics.</div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

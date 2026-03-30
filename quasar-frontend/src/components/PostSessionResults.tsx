import { useState, useEffect } from 'react';
import { apiPost } from '../lib/api';
import { SpeechHeatmap } from './SpeechHeatmap';

interface EvalData {
  overallScore: number;
  starScores: Record<string, number>;
  clarityScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  summary: string;
  passed: boolean;
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;

    setLoading(true);
    apiPost<EvalData>(`/api/sessions/${sessionId}/evaluate`, {})
      .then(res => {
        if (res.success) {
          setEvalData(res.data);
        } else {
          setError(res.message || 'Evaluation failed');
        }
      })
      .catch(() => setError('Failed to evaluate session'))
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) {
    return (
      <div className="post-session">
        <div className="eval-loading">
          <div className="eval-loading__spinner">
            <div className="spinner spinner--large" />
          </div>
          <h3>Analysing your performance…</h3>
          <p>Our AI is reviewing your interview responses</p>
          <div className="eval-loading__steps">
            <span className="eval-step eval-step--active">Scoring STAR responses</span>
            <span className="eval-step">Evaluating communication</span>
            <span className="eval-step">Generating insights</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !evalData) {
    return (
      <div className="post-session">
        <div className="session-ended-card">
          <div className="session-ended-card__icon" style={{ background: 'linear-gradient(135deg, #f97316, #fb923c)' }}>!</div>
          <h3>Evaluation Unavailable</h3>
          <p>{error || 'Could not evaluate this session. The transcript may be too short.'}</p>
          <div className="session-ended-actions">
            <button onClick={onNewInterview} className="btn-primary">Start New Interview</button>
          </div>
        </div>
      </div>
    );
  }

  const starDimensions = [
    { key: 'situation', label: 'Situation', score: evalData.starScores.situation || 0 },
    { key: 'task', label: 'Task', score: evalData.starScores.task || 0 },
    { key: 'action', label: 'Action', score: evalData.starScores.action || 0 },
    { key: 'result', label: 'Result', score: evalData.starScores.result || 0 },
    { key: 'conciseness', label: 'Conciseness', score: evalData.starScores.conciseness || 0 },
    { key: 'domain_knowledge', label: 'Domain Knowledge', score: evalData.starScores.domain_knowledge || 0 },
  ];

  const skillLabels: Record<string, string> = {
    communication: 'Communication',
    technical_depth: 'Technical Depth',
    leadership: 'Leadership',
    problem_structuring: 'Problem Structuring',
    result_orientation: 'Result Orientation',
    culture_fit: 'Culture Fit',
  };

  return (
    <div className="post-session">
      {/* Overall Score Hero */}
      <div className="eval-hero">
        <div className={`eval-score-ring ${evalData.passed ? 'eval-score-ring--pass' : 'eval-score-ring--fail'}`}>
          <span className="eval-score-ring__value">{evalData.overallScore.toFixed(1)}</span>
          <span className="eval-score-ring__max">/10</span>
        </div>
        <div className={`eval-verdict ${evalData.passed ? 'eval-verdict--pass' : 'eval-verdict--fail'}`}>
          {evalData.passed ? 'PASS' : 'NEEDS WORK'}
        </div>
        <p className="eval-summary">{evalData.summary}</p>
      </div>

      {/* STAR Breakdown */}
      <div className="eval-section">
        <h3 className="eval-section__title">STAR Breakdown</h3>
        <div className="eval-bars">
          {starDimensions.map(dim => (
            <div key={dim.key} className="eval-bar-row">
              <span className="eval-bar-label">{dim.label}</span>
              <div className="eval-bar-track">
                <div
                  className="eval-bar-fill"
                  style={{ width: `${(dim.score / 10) * 100}%` }}
                />
              </div>
              <span className="eval-bar-score">{dim.score}</span>
            </div>
          ))}
          <div className="eval-bar-row">
            <span className="eval-bar-label">Clarity</span>
            <div className="eval-bar-track">
              <div
                className="eval-bar-fill eval-bar-fill--accent"
                style={{ width: `${(evalData.clarityScore / 10) * 100}%` }}
              />
            </div>
            <span className="eval-bar-score">{evalData.clarityScore}</span>
          </div>
        </div>
      </div>

      {/* Skill Categories (Radar-style as horizontal bars) */}
      {evalData.categoryScores && Object.keys(evalData.categoryScores).length > 0 && (
        <div className="eval-section">
          <h3 className="eval-section__title">Skill Assessment</h3>
          <div className="eval-bars">
            {Object.entries(evalData.categoryScores).map(([skill, score]) => (
              <div key={skill} className="eval-bar-row">
                <span className="eval-bar-label">{skillLabels[skill] || skill}</span>
                <div className="eval-bar-track">
                  <div
                    className="eval-bar-fill eval-bar-fill--purple"
                    style={{ width: `${((score as number) / 10) * 100}%` }}
                  />
                </div>
                <span className="eval-bar-score">{score as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Strengths & Improvements */}
      <div className="eval-feedback-grid">
        <div className="eval-feedback-card eval-feedback-card--strength">
          <h4 className="eval-feedback-card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Strengths
          </h4>
          <ul className="eval-feedback-list">
            {evalData.strengths?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>

        <div className="eval-feedback-card eval-feedback-card--improve">
          <h4 className="eval-feedback-card__title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v20M2 12h20"/>
            </svg>
            Areas to Improve
          </h4>
          <ul className="eval-feedback-list">
            {evalData.improvements?.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </div>

      {/* Speech Heatmap */}
      {fillerBuckets.length > 0 && (
        <div className="eval-section">
          <SpeechHeatmap buckets={fillerBuckets} />
        </div>
      )}

      {/* Actions */}
      <div className="eval-actions">
        <button
          id="download-report-btn"
          onClick={onDownloadReport}
          className="btn-primary"
          disabled={reportDownloading}
        >
          {reportDownloading ? (
            <>
              <div className="spinner" />
              Generating…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Download PDF Report
            </>
          )}
        </button>

        <button id="new-interview-btn" onClick={onNewInterview} className="btn-secondary">
          Start New Interview
        </button>
      </div>
    </div>
  );
}

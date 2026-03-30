import { useState } from 'react';
import { apiPost } from '../lib/api';

interface JDParserProps {
  onParsed: (jdSessionId: string, questions: any[]) => void;
  onSkip: () => void;
}

export function JDParser({ onParsed, onSkip }: JDParserProps) {
  const [jdText, setJDText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);

  const handleParse = async () => {
    if (jdText.trim().length < 50) {
      setError('Job description must be at least 50 characters');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const result = await apiPost<any>('/api/jd/parse', { jobDescription: jdText });
      if (result.success) {
        setParsedData(result.data);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Failed to parse job description. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = () => {
    if (parsedData) {
      onParsed(parsedData.jdSessionId, parsedData.questions);
    }
  };

  if (parsedData) {
    return (
      <div className="jd-parser">
        <h3 className="jd-parser__title">📋 Parsed Job Description</h3>

        <div className="jd-parsed-result">
          <div className="jd-parsed-header">
            <span className="jd-parsed-role">{parsedData.role}</span>
            <span className="jd-parsed-seniority">{parsedData.seniority}</span>
            <span className="jd-parsed-domain">{parsedData.domain}</span>
          </div>

          <div className="jd-skills-section">
            <p className="jd-skills-label">Required Skills</p>
            <div className="chips" style={{ justifyContent: 'flex-start' }}>
              {parsedData.requiredSkills?.map((skill: string, i: number) => (
                <span key={i} className="chip chip--active">{skill}</span>
              ))}
            </div>
          </div>

          {parsedData.niceToHaveSkills?.length > 0 && (
            <div className="jd-skills-section">
              <p className="jd-skills-label">Nice to Have</p>
              <div className="chips" style={{ justifyContent: 'flex-start' }}>
                {parsedData.niceToHaveSkills?.map((skill: string, i: number) => (
                  <span key={i} className="chip">{skill}</span>
                ))}
              </div>
            </div>
          )}

          <div className="jd-questions-preview">
            <p className="jd-skills-label">Top 5 Questions</p>
            <ol className="jd-question-list">
              {parsedData.questions?.slice(0, 5).map((q: any, i: number) => (
                <li key={i} className="jd-question-item">
                  <span className="jd-question-text">{q.question}</span>
                  <div className="jd-question-meta">
                    <span className={`jd-question-category jd-question-category--${q.category}`}>{q.category}</span>
                    <span className="jd-question-difficulty">
                      {'★'.repeat(q.difficulty)}{'☆'.repeat(3 - q.difficulty)}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="jd-actions">
          <button className="btn-primary" onClick={handleConfirm}>
            Use These Questions
          </button>
          <button className="btn-secondary" onClick={() => setParsedData(null)}>
            Re-enter JD
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="jd-parser">
      <h3 className="jd-parser__title">📋 Paste Job Description</h3>
      <p className="jd-parser__subtitle">
        Paste a job description to generate custom interview questions tailored to the role
      </p>

      <textarea
        id="jd-textarea"
        className="jd-textarea"
        value={jdText}
        onChange={(e) => setJDText(e.target.value)}
        placeholder="Paste the full job description here... (minimum 50 characters)"
        rows={8}
      />

      {error && (
        <div className="error-box" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      <div className="jd-actions">
        <button
          id="parse-jd-btn"
          className="btn-primary"
          onClick={handleParse}
          disabled={loading || jdText.trim().length < 50}
        >
          {loading ? (
            <>
              <div className="spinner" />
              Parsing with AI…
            </>
          ) : (
            <>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/>
                <line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
              Parse JD
            </>
          )}
        </button>
        <button className="btn-secondary" onClick={onSkip}>
          Skip — Use Default Questions
        </button>
      </div>
    </div>
  );
}

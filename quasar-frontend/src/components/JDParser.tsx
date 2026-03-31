import { useRef, useState } from 'react';

interface JDParserProps {
  onParsed: (jdSessionId: string, questions: any[]) => void;
  onSkip: () => void;
}

const API_BASE = '';

export function JDParser({ onParsed, onSkip }: JDParserProps) {
  const [mode, setMode] = useState<'text' | 'pdf'>('text');
  const [jdText, setJDText] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleParse = async () => {
    setError('');
    setLoading(true);

    try {
      let result: any;

      if (mode === 'pdf') {
        if (!pdfFile) { setError('Please select a JD PDF file.'); setLoading(false); return; }
        const formData = new FormData();
        formData.append('jd', pdfFile);
        const resp = await fetch(`${API_BASE}/api/jd/parse`, {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        result = await resp.json();
      } else {
        if (jdText.trim().length < 50) { setError('Job description must be at least 50 characters.'); setLoading(false); return; }
        const resp = await fetch(`${API_BASE}/api/jd/parse`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobDescription: jdText }),
        });
        result = await resp.json();
      }

      if (result.success) {
        setParsedData(result.data);
      } else {
        setError(result.message || 'Failed to parse JD.');
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
      <h3 className="jd-parser__title">📋 Job Description</h3>
      <p className="jd-parser__subtitle">
        Paste text or upload a PDF to generate custom interview questions
      </p>

      {/* Mode toggle */}
      <div className="jd-mode-toggle">
        <button
          className={`jd-mode-btn ${mode === 'text' ? 'jd-mode-btn--active' : ''}`}
          onClick={() => setMode('text')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/>
            <line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
          </svg>
          Plain Text
        </button>
        <button
          className={`jd-mode-btn ${mode === 'pdf' ? 'jd-mode-btn--active' : ''}`}
          onClick={() => setMode('pdf')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Upload PDF
        </button>
      </div>

      {mode === 'text' ? (
        <textarea
          id="jd-textarea"
          className="jd-textarea"
          value={jdText}
          onChange={(e) => setJDText(e.target.value)}
          placeholder="Paste the full job description here... (minimum 50 characters)"
          rows={8}
        />
      ) : (
        <div
          className={`jd-pdf-dropzone ${pdfFile ? 'jd-pdf-dropzone--filled' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files[0];
            if (f?.type === 'application/pdf') setPdfFile(f);
            else setError('Please drop a PDF file.');
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            style={{ display: 'none' }}
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />
          {pdfFile ? (
            <>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="9" y1="15" x2="15" y2="15"/>
              </svg>
              <span className="jd-pdf-name">{pdfFile.name}</span>
              <span className="jd-pdf-size">{(pdfFile.size / 1024).toFixed(0)} KB</span>
              <button className="jd-pdf-remove" onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}>
                ✕ Remove
              </button>
            </>
          ) : (
            <>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-mute)" strokeWidth="1.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="12" y1="18" x2="12" y2="12"/>
                <polyline points="9 15 12 12 15 15"/>
              </svg>
              <span className="jd-pdf-hint">Click or drag & drop a JD PDF</span>
              <span className="jd-pdf-hint-sub">Max 10 MB · PDF only</span>
            </>
          )}
        </div>
      )}

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
          disabled={loading || (mode === 'text' ? jdText.trim().length < 50 : !pdfFile)}
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

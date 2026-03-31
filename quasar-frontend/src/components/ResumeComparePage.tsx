import { useRef, useState } from 'react';

interface SkillMatch {
  skill: string;
  proficiency: 'expert' | 'intermediate' | 'beginner';
  context: string;
}

interface MissingSkill {
  skill: string;
  importance: 'critical' | 'important' | 'nice-to-have';
  suggestion: string;
}

interface BonusSkill {
  skill: string;
  relevance: string;
}

interface CompareResult {
  overallMatch: number;
  verdict: string;
  summary: string;
  matchedSkills: SkillMatch[];
  missingSkills: MissingSkill[];
  bonusSkills: BonusSkill[];
  experienceAnalysis: { requiredYears: string; candidateYears: string; verdict: string };
  educationAnalysis: { required: string; candidate: string; verdict: string };
  keyStrengths: string[];
  improvementAreas: string[];
  tailoringTips: string[];
  resumeFileName: string;
  jdFileName: string;
}

type JDMode = 'pdf' | 'text';

function DropZone({
  id,
  label,
  icon,
  file,
  onFile,
  onClear,
  accent,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  file: File | null;
  onFile: (f: File) => void;
  onClear: () => void;
  accent: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div
      className={`rcp-dropzone ${file ? 'rcp-dropzone--filled' : ''}`}
      style={{ '--drop-accent': accent } as any}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type === 'application/pdf') onFile(f);
      }}
    >
      <input
        ref={ref}
        id={id}
        type="file"
        accept="application/pdf"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <div className="rcp-dropzone-filled">
          <div className="rcp-dropzone-file-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="9 12 12 15 15 12"/>
            </svg>
          </div>
          <div className="rcp-dropzone-meta">
            <span className="rcp-file-name">{file.name}</span>
            <span className="rcp-file-size">{(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button
            className="rcp-clear-btn"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Remove file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="rcp-dropzone-empty">
          {icon}
          <span className="rcp-drop-label">{label}</span>
          <span className="rcp-drop-sub">Click or drag & drop · PDF · Max 10 MB</span>
        </div>
      )}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const color = score >= 70 ? 'var(--c-success)' : score >= 45 ? 'var(--c-accent)' : 'var(--c-error)';
  return (
    <svg width="136" height="136" viewBox="0 0 136 136" className="rcp-score-ring">
      <circle cx="68" cy="68" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
      <circle
        cx="68" cy="68" r={r}
        fill="none"
        stroke={color}
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ * 0.25}
        style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: 'stroke-dasharray 1s ease' }}
      />
      <text x="68" y="62" textAnchor="middle" fill={color} fontSize="28" fontWeight="800">{score}%</text>
      <text x="68" y="80" textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="11">Match</text>
    </svg>
  );
}

function ImportanceBadge({ level }: { level: string }) {
  const map: Record<string, { color: string; bg: string }> = {
    critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    important: { color: '#f97316', bg: 'rgba(249,115,22,0.12)' },
    'nice-to-have': { color: '#6b7280', bg: 'rgba(107,114,128,0.12)' },
  };
  const s = map[level] ?? map['nice-to-have'];
  return (
    <span className="rcp-badge" style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}>
      {level}
    </span>
  );
}

function ProficiencyDots({ level }: { level: string }) {
  const map: Record<string, number> = { expert: 3, intermediate: 2, beginner: 1 };
  const n = map[level] ?? 1;
  return (
    <span className="rcp-prof-dots">
      {[1, 2, 3].map(i => (
        <span key={i} className={`rcp-prof-dot ${i <= n ? 'rcp-prof-dot--on' : ''}`} />
      ))}
    </span>
  );
}

export function ResumeComparePage() {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [jdMode, setJDMode] = useState<JDMode>('pdf');
  const [jdFile, setJDFile] = useState<File | null>(null);
  const [jdText, setJDText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CompareResult | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'gaps' | 'tips'>('overview');

  const handleCompare = async () => {
    if (!resumeFile) { setError('Please upload your Resume PDF.'); return; }
    if (jdMode === 'pdf' && !jdFile) { setError('Please upload a Job Description PDF.'); return; }
    if (jdMode === 'text' && jdText.trim().length < 50) { setError('Job description must be at least 50 characters.'); return; }

    setError('');
    setLoading(true);
    setResult(null);

    try {
      const form = new FormData();
      form.append('resume', resumeFile);
      if (jdMode === 'pdf' && jdFile) form.append('jd', jdFile);
      if (jdMode === 'text') form.append('jdText', jdText.trim());

      const resp = await fetch('/api/resume/compare', {
        method: 'POST',
        credentials: 'include',
        body: form,
      });
      const json = await resp.json();
      if (json.success) {
        setResult(json.data);
        setActiveTab('overview');
      } else {
        setError(json.message || 'Comparison failed.');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verdictColor = (v: string) => {
    if (v?.includes('Strong')) return 'var(--c-success)';
    if (v?.includes('Good')) return 'var(--c-accent)';
    if (v?.includes('Partial')) return '#eab308';
    return 'var(--c-error)';
  };

  return (
    <div className="rcp-page">
      {/* ── Header ── */}
      <div className="rcp-hero">
        <div className="rcp-hero-badge">
          <span className="badge-dot" />
          <span>Powered by Groq · Llama 3.3 70B</span>
        </div>
        <h1 className="rcp-hero-title">
          Resume <span className="text-accent">vs</span> JD
        </h1>
        <p className="rcp-hero-sub">
          Upload your resume and a job description — get an instant AI-powered compatibility analysis
        </p>
      </div>

      {/* ── Upload Panels ── */}
      <div className="rcp-upload-grid">
        {/* Resume Panel */}
        <div className="rcp-panel">
          <div className="rcp-panel-header">
            <div className="rcp-panel-dot" style={{ background: '#f97316' }} />
            <span className="rcp-panel-label">Your Resume</span>
            <span className="rcp-panel-hint">PDF only</span>
          </div>
          <DropZone
            id="resume-upload"
            label="Upload Resume PDF"
            accent="#f97316"
            icon={
              <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(249,115,22,0.4)" strokeWidth="1.2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
            }
            file={resumeFile}
            onFile={setResumeFile}
            onClear={() => setResumeFile(null)}
          />
        </div>

        {/* VS Divider */}
        <div className="rcp-vs-divider">
          <div className="rcp-vs-line" />
          <span className="rcp-vs-text">VS</span>
          <div className="rcp-vs-line" />
        </div>

        {/* JD Panel */}
        <div className="rcp-panel">
          <div className="rcp-panel-header">
            <div className="rcp-panel-dot" style={{ background: '#3b82f6' }} />
            <span className="rcp-panel-label">Job Description</span>
            <div className="rcp-jd-toggle">
              <button
                className={`rcp-toggle-btn ${jdMode === 'pdf' ? 'rcp-toggle-btn--active' : ''}`}
                onClick={() => setJDMode('pdf')}
              >
                PDF
              </button>
              <button
                className={`rcp-toggle-btn ${jdMode === 'text' ? 'rcp-toggle-btn--active' : ''}`}
                onClick={() => setJDMode('text')}
              >
                Text
              </button>
            </div>
          </div>

          {jdMode === 'pdf' ? (
            <DropZone
              id="jd-upload"
              label="Upload JD PDF"
              accent="#3b82f6"
              icon={
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="rgba(59,130,246,0.4)" strokeWidth="1.2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              }
              file={jdFile}
              onFile={setJDFile}
              onClear={() => setJDFile(null)}
            />
          ) : (
            <textarea
              id="jd-text-input"
              className="rcp-jd-textarea"
              value={jdText}
              onChange={(e) => setJDText(e.target.value)}
              placeholder="Paste the full job description here… (minimum 50 characters)"
              rows={7}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="error-box rcp-error" role="alert">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {error}
        </div>
      )}

      {/* ── Compare Button ── */}
      <button
        id="compare-btn"
        className="btn-primary rcp-compare-btn"
        onClick={handleCompare}
        disabled={loading || !resumeFile || (jdMode === 'pdf' ? !jdFile : jdText.trim().length < 50)}
      >
        {loading ? (
          <>
            <div className="spinner" style={{ borderTopColor: '#000', borderColor: 'rgba(0,0,0,0.2)' }} />
            Analysing with Groq AI…
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Compare Now
          </>
        )}
      </button>

      {/* ── Results ── */}
      {result && (
        <div className="rcp-results" id="compare-results">
          {/* Score hero */}
          <div className="rcp-score-hero">
            <ScoreRing score={result.overallMatch} />
            <div className="rcp-score-meta">
              <span
                className="rcp-verdict"
                style={{ color: verdictColor(result.verdict) }}
              >
                {result.verdict}
              </span>
              <p className="rcp-summary">{result.summary}</p>
              <div className="rcp-file-pills">
                <span className="rcp-file-pill">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {result.resumeFileName}
                </span>
                <span className="rcp-file-pill rcp-file-pill--jd">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--c-user)" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {result.jdFileName}
                </span>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <div className="rcp-tabs" role="tablist">
            {(['overview', 'skills', 'gaps', 'tips'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`rcp-tab ${activeTab === tab ? 'rcp-tab--active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'overview' && '📊 Overview'}
                {tab === 'skills' && '✅ Matched Skills'}
                {tab === 'gaps' && '⚠️ Gaps'}
                {tab === 'tips' && '💡 Tailoring Tips'}
              </button>
            ))}
          </div>

          {/* Tab: Overview */}
          {activeTab === 'overview' && (
            <div className="rcp-tab-content">
              <div className="rcp-info-grid">
                {/* Experience */}
                <div className="rcp-info-card">
                  <div className="rcp-info-card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    Experience
                  </div>
                  <div className="rcp-info-row"><span>Required</span><strong>{result.experienceAnalysis.requiredYears}</strong></div>
                  <div className="rcp-info-row"><span>Candidate</span><strong>{result.experienceAnalysis.candidateYears}</strong></div>
                  <div className="rcp-info-verdict">{result.experienceAnalysis.verdict}</div>
                </div>
                {/* Education */}
                <div className="rcp-info-card">
                  <div className="rcp-info-card-title">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    Education
                  </div>
                  <div className="rcp-info-row"><span>Required</span><strong>{result.educationAnalysis.required}</strong></div>
                  <div className="rcp-info-row"><span>Candidate</span><strong>{result.educationAnalysis.candidate}</strong></div>
                  <div className="rcp-info-verdict">{result.educationAnalysis.verdict}</div>
                </div>
              </div>

              {/* Key Strengths */}
              <div className="rcp-section">
                <div className="rcp-section-title rcp-section-title--green">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Key Strengths
                </div>
                <ul className="rcp-check-list">
                  {result.keyStrengths.map((s, i) => (
                    <li key={i} className="rcp-check-item rcp-check-item--green">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvement Areas */}
              <div className="rcp-section">
                <div className="rcp-section-title rcp-section-title--orange">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Improvement Areas
                </div>
                <ul className="rcp-check-list">
                  {result.improvementAreas.map((s, i) => (
                    <li key={i} className="rcp-check-item rcp-check-item--orange">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2.5">
                        <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        <circle cx="12" cy="12" r="10"/>
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Tab: Matched Skills */}
          {activeTab === 'skills' && (
            <div className="rcp-tab-content">
              {result.matchedSkills.length === 0 ? (
                <p className="rcp-empty">No matched skills found.</p>
              ) : (
                <div className="rcp-skill-list">
                  {result.matchedSkills.map((sk, i) => (
                    <div key={i} className="rcp-skill-card rcp-skill-card--match">
                      <div className="rcp-skill-top">
                        <span className="rcp-skill-name">{sk.skill}</span>
                        <ProficiencyDots level={sk.proficiency} />
                        <span className="rcp-prof-label">{sk.proficiency}</span>
                      </div>
                      <p className="rcp-skill-context">{sk.context}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.bonusSkills.length > 0 && (
                <div className="rcp-section" style={{ marginTop: 'var(--space-8)' }}>
                  <div className="rcp-section-title rcp-section-title--purple">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-purple)" strokeWidth="2">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Bonus Skills
                  </div>
                  <div className="rcp-skill-list">
                    {result.bonusSkills.map((sk, i) => (
                      <div key={i} className="rcp-skill-card rcp-skill-card--bonus">
                        <span className="rcp-skill-name">{sk.skill}</span>
                        <p className="rcp-skill-context">{sk.relevance}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Gaps */}
          {activeTab === 'gaps' && (
            <div className="rcp-tab-content">
              {result.missingSkills.length === 0 ? (
                <p className="rcp-empty" style={{ color: 'var(--c-success)' }}>🎉 No skill gaps detected! Strong match.</p>
              ) : (
                <div className="rcp-skill-list">
                  {result.missingSkills.map((sk, i) => (
                    <div key={i} className="rcp-skill-card rcp-skill-card--gap">
                      <div className="rcp-skill-top">
                        <span className="rcp-skill-name">{sk.skill}</span>
                        <ImportanceBadge level={sk.importance} />
                      </div>
                      <p className="rcp-skill-context rcp-skill-suggestion">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        {sk.suggestion}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Tailoring Tips */}
          {activeTab === 'tips' && (
            <div className="rcp-tab-content">
              <div className="rcp-tips-list">
                {result.tailoringTips.map((tip, i) => (
                  <div key={i} className="rcp-tip-card">
                    <div className="rcp-tip-num">{String(i + 1).padStart(2, '0')}</div>
                    <p className="rcp-tip-text">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from 'react';
import { apiFetch } from '../lib/api';

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
      className={`relative w-full border-2 border-dashed rounded-2xl transition-all duration-200 cursor-pointer overflow-hidden flex flex-col items-center justify-center p-8 min-h-[160px] group ${
        file 
          ? 'border-transparent bg-[var(--c-surface-3)]' 
          : 'border-[var(--c-border)] border-opacity-50 hover:border-opacity-100 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)]'
      }`}
      style={{ '--drop-accent': accent } as any}
      onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type === 'application/pdf') onFile(f);
      }}
    >
      {/* Background glow matching the accent color on hover, if empty */}
      {!file && (
        <div 
          className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none"
          style={{ backgroundColor: accent }}
        />
      )}
      <input
        ref={ref}
        id={id}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      {file ? (
        <div className="flex flex-col items-center text-center w-full z-10 transition-all">
          <div className="flex items-center justify-center w-14 h-14 rounded-[18px] bg-[var(--c-surface)] shadow-sm mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={accent} strokeWidth="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <polyline points="9 12 12 15 15 12"/>
            </svg>
          </div>
          <div className="flex flex-col max-w-full px-4 gap-1">
            <span className="text-[14px] font-semibold text-[var(--c-text)] truncate w-full">{file.name}</span>
            <span className="text-[12px] font-medium text-[var(--c-text-dim)]">{(file.size / 1024).toFixed(0)} KB</span>
          </div>
          <button
            className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors duration-200 z-20"
            onClick={(e) => { e.stopPropagation(); onClear(); }}
            title="Remove file"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center text-center z-10">
          <div className="mb-4 text-[var(--c-text-dim)] group-hover:scale-110 transition-transform duration-300">
            {icon}
          </div>
          <span className="text-[15px] font-bold text-[var(--c-text)] mb-1.5">{label}</span>
          <span className="text-[13px] text-[var(--c-text-mute)]">Click or drag & drop · PDF · Max 10 MB</span>
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
    <svg width="136" height="136" viewBox="0 0 136 136" className="relative flex-shrink-0">
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
    <span 
      className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider rounded-lg shrink-0" 
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}33` }}
    >
      {level}
    </span>
  );
}

function ProficiencyDots({ level }: { level: string }) {
  const map: Record<string, number> = { expert: 3, intermediate: 2, beginner: 1 };
  const n = map[level] ?? 1;
  return (
    <span className="flex items-center gap-1">
      {[1, 2, 3].map(i => (
        <span 
          key={i} 
          className={`w-1.5 h-1.5 rounded-full transition-colors ${i <= n ? 'bg-[var(--c-accent)] shadow-[0_0_4px_var(--c-accent)]' : 'bg-[var(--c-border)]'}`} 
        />
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

      const json = await apiFetch<CompareResult>('/api/resume/compare', {
        method: 'POST',
        body: form,
      });

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
    <div className="flex flex-col items-center w-full max-w-5xl mx-auto px-4 py-8 md:py-12 min-h-[calc(100vh-64px)]">
      {/* ── Header ── */}
      <div className="flex flex-col items-center text-center max-w-2xl mb-12">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[var(--c-text-dim)] text-[12px] font-bold tracking-wider mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-[pulse-dot_2s_infinite]" />
          <span>Powered by Groq · Llama 3.3 70B</span>
        </div>
        <h1 className="text-[42px] leading-[1.1] font-black tracking-tight text-[var(--c-text)] m-0 mb-4 [text-wrap:balance]">
          Resume <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600">vs</span> JD
        </h1>
        <p className="text-[16px] leading-[1.6] text-[var(--c-text-dim)] m-0 [text-wrap:balance]">
          Upload your resume and a job description — get an instant AI-powered compatibility analysis
        </p>
      </div>

      {/* ── Upload Panels ── */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-8 w-full items-stretch">
        {/* Resume Panel */}
        <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-5 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#f97316]" />
              <span className="text-[16px] font-bold text-[var(--c-text)]">Your Resume</span>
            </div>
            <span className="text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] bg-[var(--c-surface-2)] px-2 py-0.5 rounded-md">PDF only</span>
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
        <div className="flex flex-row md:flex-col items-center justify-center gap-4 py-4 md:py-0">
          <div className="flex-1 w-px md:h-full bg-gradient-to-b from-transparent via-[var(--c-border-2)] to-transparent max-md:h-px max-md:w-full" />
          <span className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[12px] font-black text-[var(--c-text-mute)] shrink-0 z-10">VS</span>
          <div className="flex-1 w-px md:h-full bg-gradient-to-b from-transparent via-[var(--c-border-2)] to-transparent max-md:h-px max-md:w-full" />
        </div>

        {/* JD Panel */}
        <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-wrap gap-4 items-center justify-between mb-5 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#3b82f6]" />
              <span className="text-[16px] font-bold text-[var(--c-text)]">Job Description</span>
            </div>
            <div className="flex bg-[var(--c-surface-3)] p-1 rounded-xl">
              <button
                className={`flex items-center justify-center px-3 py-1 text-[12px] font-bold rounded-lg transition-colors ${jdMode === 'pdf' ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm' : 'text-[var(--c-text-mute)] hover:text-[var(--c-text-dim)]'}`}
                onClick={() => setJDMode('pdf')}
              >
                PDF
              </button>
              <button
                className={`flex items-center justify-center px-3 py-1 text-[12px] font-bold rounded-lg transition-colors ${jdMode === 'text' ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm' : 'text-[var(--c-text-mute)] hover:text-[var(--c-text-dim)]'}`}
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
              className="w-full flex-1 min-h-[160px] resize-y bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl p-4 text-[14px] leading-relaxed text-[var(--c-text)] placeholder:text-[var(--c-text-mute)] transition-all focus:border-[#3b82f6] focus:bg-[var(--c-surface)] outline-none custom-scrollbar"
              value={jdText}
              onChange={(e) => setJDText(e.target.value)}
              placeholder="Paste the full job description here… (minimum 50 characters)"
              rows={7}
            />
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-3 w-full bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-3 rounded-2xl mt-8 text-[14px] font-medium" role="alert">
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
        className="flex items-center justify-center gap-2 mt-10 px-8 py-3.5 bg-[var(--c-accent)] hover:bg-orange-600 text-white font-bold text-[15px] rounded-2xl shadow-[0_8px_24px_rgba(234,88,12,0.25)] transition-all disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none hover:-translate-y-1 active:scale-95 mx-auto"
        onClick={handleCompare}
        disabled={loading || !resumeFile || (jdMode === 'pdf' ? !jdFile : jdText.trim().length < 50)}
      >
        {loading ? (
          <>
            <div className="w-5 h-5 border-2 border-[var(--c-text-dim)] border-t-[var(--c-text)] rounded-full animate-spin" />
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
        <div className="w-full flex flex-col gap-8 mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500" id="compare-results">
          {/* Score hero */}
          <div className="flex flex-col md:flex-row items-center gap-8 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-6 md:p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-orange-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
            <ScoreRing score={result.overallMatch} />
            <div className="flex flex-col flex-1 items-center md:items-start text-center md:text-left z-10 w-full">
              <span
                className="text-[20px] md:text-[24px] font-black tracking-tight mb-3"
                style={{ color: verdictColor(result.verdict) }}
              >
                {result.verdict}
              </span>
              <p className="text-[15px] leading-relaxed text-[var(--c-text-dim)] mb-6 max-w-2xl">{result.summary}</p>
              <div className="flex flex-wrap justify-center md:justify-start gap-3">
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--c-surface-3)] text-[var(--c-text)] text-[12px] font-bold shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                  {result.resumeFileName}
                </span>
                <span className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--c-surface-2)] text-[var(--c-text-dim)] border border-[var(--c-border)] text-[12px] font-bold">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  {result.jdFileName}
                </span>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <div className="flex overflow-x-auto gap-2 p-1.5 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-2xl custom-scrollbar" role="tablist">
            {(['overview', 'skills', 'gaps', 'tips'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                className={`flex-1 min-w-max px-4 py-2.5 rounded-xl text-[14px] font-bold transition-all ${
                  activeTab === tab 
                    ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm' 
                    : 'text-[var(--c-text-mute)] hover:text-[var(--c-text-dim)] hover:bg-[var(--c-surface-3)]'
                }`}
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
            <div className="flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                {/* Experience */}
                <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316]" />
                  <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--c-text-dim)] mb-5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
                    </svg>
                    Experience
                  </div>
                  <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-[var(--c-border-2)] text-[14px]">
                    <span className="text-[var(--c-text-mute)]">Required</span>
                    <strong className="text-[var(--c-text)]">{result.experienceAnalysis.requiredYears}</strong>
                  </div>
                  <div className="flex justify-between items-baseline mb-4 text-[14px]">
                    <span className="text-[var(--c-text-mute)]">Candidate</span>
                    <strong className="text-[var(--c-text)]">{result.experienceAnalysis.candidateYears}</strong>
                  </div>
                  <div className="mt-auto pt-3 border-t border-[#f97316]/20 text-[13px] font-medium text-[#f97316] leading-snug">
                    {result.experienceAnalysis.verdict}
                  </div>
                </div>
                {/* Education */}
                <div className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm overflow-hidden relative">
                  <div className="absolute top-0 left-0 w-1 h-full bg-[#f97316]" />
                  <div className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-[var(--c-text-dim)] mb-5">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5">
                      <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
                    </svg>
                    Education
                  </div>
                  <div className="flex justify-between items-baseline mb-2 pb-2 border-b border-[var(--c-border-2)] text-[14px]">
                    <span className="text-[var(--c-text-mute)]">Required</span>
                    <strong className="text-[var(--c-text)] truncate max-w-[60%] text-right">{result.educationAnalysis.required}</strong>
                  </div>
                  <div className="flex justify-between items-baseline mb-4 text-[14px]">
                    <span className="text-[var(--c-text-mute)]">Candidate</span>
                    <strong className="text-[var(--c-text)] truncate max-w-[60%] text-right">{result.educationAnalysis.candidate}</strong>
                  </div>
                  <div className="mt-auto pt-3 border-t border-[#f97316]/20 text-[13px] font-medium text-[#f97316] leading-snug">
                    {result.educationAnalysis.verdict}
                  </div>
                </div>
              </div>

              {/* Key Strengths */}
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wider text-[var(--c-success)] mb-5 pb-3 border-b border-green-500/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                  Key Strengths
                </div>
                <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                  {result.keyStrengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 p-3.5 bg-[var(--c-success-dim)] border border-[var(--c-success)]/10 rounded-xl text-[14px] leading-relaxed text-[var(--c-text)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-success)" strokeWidth="3" className="shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Improvement Areas */}
              <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wider text-[#f97316] mb-5 pb-3 border-b border-orange-500/10">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Improvement Areas
                </div>
                <ul className="flex flex-col gap-3 m-0 p-0 list-none">
                  {result.improvementAreas.map((s, i) => (
                    <li key={i} className="flex items-start gap-3 p-3.5 bg-orange-500/5 border border-orange-500/10 rounded-xl text-[14px] leading-relaxed text-[var(--c-text)]">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" className="shrink-0 mt-0.5">
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
            <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300">
              {result.matchedSkills.length === 0 ? (
                <p className="text-center py-24 text-[var(--c-text-mute)] text-[15px] bg-[var(--c-surface-2)] border border-[var(--c-border)] border-dashed rounded-3xl m-0">No matched skills found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.matchedSkills.map((sk, i) => (
                    <div key={i} className="flex flex-col bg-[var(--c-surface)] border border-[var(--c-success)]/20 shadow-[inset_0_4px_24px_rgba(34,197,94,0.03)] rounded-2xl p-5 mb-0">
                      <div className="flex items-center justify-between mb-3 border-b border-[var(--c-border-2)] pb-3">
                        <span className="text-[15px] font-bold text-[var(--c-text)] truncate max-w-[50%]">{sk.skill}</span>
                        <div className="flex items-center gap-2">
                          <ProficiencyDots level={sk.proficiency} />
                          <span className="text-[12px] font-semibold text-[var(--c-text-dim)] capitalize">{sk.proficiency}</span>
                        </div>
                      </div>
                      <p className="text-[13px] leading-relaxed text-[var(--c-text-dim)] m-0">{sk.context}</p>
                    </div>
                  ))}
                </div>
              )}
              {result.bonusSkills.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center gap-2 text-[14px] font-bold uppercase tracking-wider text-[#a855f7] mb-5 pb-3 border-b border-purple-500/10">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    Bonus Skills
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.bonusSkills.map((sk, i) => (
                      <div key={i} className="flex flex-col bg-purple-500/5 border border-purple-500/20 rounded-2xl p-5">
                        <span className="text-[15px] font-bold text-[#a855f7] mb-2">{sk.skill}</span>
                        <p className="text-[13px] leading-relaxed text-[var(--c-text-dim)] m-0">{sk.relevance}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Gaps */}
          {activeTab === 'gaps' && (
            <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300">
              {result.missingSkills.length === 0 ? (
                <p className="text-center py-24 text-[var(--c-success)] font-bold text-[16px] bg-[var(--c-success-dim)] border border-[var(--c-success)]/20 rounded-3xl m-0">🎉 No skill gaps detected! Strong match.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.missingSkills.map((sk, i) => (
                    <div key={i} className="flex flex-col bg-[var(--c-surface)] border border-red-500/20 shadow-[inset_0_4px_24px_rgba(239,68,68,0.03)] rounded-2xl p-5">
                      <div className="flex items-center justify-between mb-3 border-b border-[var(--c-border-2)] pb-3">
                        <span className="text-[15px] font-bold text-[var(--c-text)] truncate max-w-[60%]">{sk.skill}</span>
                        <ImportanceBadge level={sk.importance} />
                      </div>
                      <p className="flex items-start gap-2.5 text-[13px] leading-relaxed text-[var(--c-text-dim)] bg-[var(--c-surface-2)] p-3.5 rounded-xl border border-[var(--c-border)] m-0 mt-1">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--c-text-mute)" strokeWidth="2.5" className="shrink-0 mt-0.5">
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
            <div className="flex flex-col animate-in fade-in zoom-in-95 duration-300">
              <div className="flex flex-col gap-4">
                {result.tailoringTips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-4 p-5 bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm rounded-2xl group hover:-translate-y-1 hover:border-[#f97316]/30 transition-all duration-300">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--c-surface-3)] text-[12px] font-black tracking-wider text-[var(--c-text-mute)] group-hover:bg-[#f97316] group-hover:text-white transition-colors shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <p className="text-[14px] md:text-[15px] leading-[1.7] text-[var(--c-text)] m-0 pt-0.5">{tip}</p>
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

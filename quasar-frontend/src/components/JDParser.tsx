import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, UploadCloud, X, FileCheck, AlertCircle, Loader2, Sparkles, Building2, Briefcase, GraduationCap, ChevronRight, Check } from 'lucide-react';
import { apiFetch } from '../lib/api';

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
        result = await apiFetch(`${API_BASE}/api/jd/parse`, {
          method: 'POST',
          body: formData,
        });
      } else {
        if (jdText.trim().length < 50) { setError('Job description must be at least 50 characters.'); setLoading(false); return; }
        result = await apiFetch(`${API_BASE}/api/jd/parse`, {
          method: 'POST',
          body: JSON.stringify({ jobDescription: jdText }),
        });
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
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col gap-6 w-full max-w-[800px] mx-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm p-5 md:p-8"
      >
        <div className="flex items-center gap-3 border-b border-[var(--c-border)] pb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500">
            <Sparkles size={20} strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[20px] font-bold text-[var(--c-text)] m-0 tracking-tight">Parsed Job Description</h3>
            <p className="text-[13px] text-[var(--c-text-dim)] m-0 mt-0.5">We extracted these key insights from your JD.</p>
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[13px] font-semibold text-[var(--c-text)]">
              <Briefcase size={14} className="text-[var(--c-text-mute)]" />
              {parsedData.role}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[13px] font-semibold text-[var(--c-text)]">
              <GraduationCap size={14} className="text-[var(--c-text-mute)]" />
              {parsedData.seniority}
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[13px] font-semibold text-[var(--c-text)]">
              <Building2 size={14} className="text-[var(--c-text-mute)]" />
              {parsedData.domain}
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border-2)]">
            <p className="text-[12px] font-bold text-[var(--c-text-dim)] uppercase tracking-wider m-0">Required Skills</p>
            <div className="flex flex-wrap gap-2">
              {parsedData.requiredSkills?.map((skill: string, i: number) => (
                <span key={i} className="px-2.5 py-1 text-[12px] font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 rounded-md">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {parsedData.niceToHaveSkills?.length > 0 && (
            <div className="flex flex-col gap-3 p-4 rounded-xl bg-[var(--c-surface-2)] border border-[var(--c-border-2)]">
              <p className="text-[12px] font-bold text-[var(--c-text-dim)] uppercase tracking-wider m-0">Nice to Have</p>
              <div className="flex flex-wrap gap-2">
                {parsedData.niceToHaveSkills?.map((skill: string, i: number) => (
                  <span key={i} className="px-2.5 py-1 text-[12px] font-medium text-[var(--c-text-dim)] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-md">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <p className="text-[12px] font-bold text-[var(--c-text-dim)] uppercase tracking-wider m-0">Top 5 Generated Questions</p>
            <div className="flex flex-col gap-2">
              {parsedData.questions?.slice(0, 5).map((q: any, i: number) => (
                <div key={i} className="flex gap-3 p-3 rounded-xl bg-[var(--c-surface)] border border-[var(--c-border)] shadow-sm">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--c-surface-3)] text-[11px] font-bold text-[var(--c-text-dim)] shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex flex-col gap-2 flex-1 pt-0.5">
                    <span className="text-[14px] font-medium text-[var(--c-text)] leading-snug">{q.question}</span>
                    <div className="flex items-center gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        q.category === 'behavioural' ? 'bg-blue-500/10 text-blue-500' :
                        q.category === 'technical' ? 'bg-orange-500/10 text-orange-500' :
                        q.category === 'system-design' ? 'bg-purple-500/10 text-purple-500' :
                        'bg-green-500/10 text-green-500'
                      }`}>
                        {q.category}
                      </span>
                      <span className="text-[12px] text-yellow-500 tracking-widest">
                        {'★'.repeat(q.difficulty)}{'☆'.repeat(3 - q.difficulty)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-2 pt-4 border-t border-[var(--c-border)]">
          <button className="flex items-center justify-center gap-2 flex-1 py-3 px-4 bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white font-bold text-[14px] rounded-xl transition-all active:scale-[0.98] shadow-[0_4px_12px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]" onClick={handleConfirm}>
            <Check size={18} strokeWidth={2.5} />
            Use These Questions
          </button>
          <button className="flex items-center justify-center gap-2 py-3 px-4 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] rounded-xl transition-all active:scale-[0.98]" onClick={() => setParsedData(null)}>
            Re-enter JD
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-[800px] mx-auto bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm p-5 md:p-8">
      <div className="flex flex-col mb-6">
        <h3 className="text-[24px] font-black text-[var(--c-text)] m-0 tracking-tight flex items-center gap-2">
          <FileText size={24} className="text-[var(--c-accent)]" strokeWidth={2.5} />
          Job Description
        </h3>
        <p className="text-[14px] text-[var(--c-text-dim)] m-0 mt-1">
          Paste text or upload a PDF to generate custom interview questions tailored to the role.
        </p>
      </div>

      <div className="flex items-center p-1 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl mb-6 self-start">
        <button
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${mode === 'text' ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm' : 'text-[var(--c-text-mute)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-3)]'}`}
          onClick={() => setMode('text')}
        >
          <FileText size={16} strokeWidth={2} />
          Plain Text
        </button>
        <button
          className={`flex items-center gap-2 px-4 py-2 text-[13px] font-bold rounded-lg transition-all ${mode === 'pdf' ? 'bg-[var(--c-surface)] text-[var(--c-text)] shadow-sm' : 'text-[var(--c-text-mute)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-3)]'}`}
          onClick={() => setMode('pdf')}
        >
          <UploadCloud size={16} strokeWidth={2} />
          Upload PDF
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
        >
          {mode === 'text' ? (
            <textarea
              className="w-full bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[14px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus:outline-none focus:border-[var(--c-accent)] focus:ring-1 focus:ring-[var(--c-accent-dim)] transition-all resize-y"
              style={{ padding: '16px', minHeight: '200px' }}
              value={jdText}
              onChange={(e) => setJDText(e.target.value)}
              placeholder="Paste the full job description here... (minimum 50 characters)"
              rows={8}
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl transition-all cursor-pointer bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] hover:border-[var(--c-accent-dim)] ${pdfFile ? 'border-[var(--c-success)] bg-[var(--c-success-dim)]' : 'border-[var(--c-border)]'}`}
              style={{ padding: '48px 24px', minHeight: '200px' }}
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
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
              {pdfFile ? (
                <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                  <FileCheck size={40} className="text-[var(--c-success)] mb-2" strokeWidth={1.5} />
                  <span className="text-[14px] font-bold text-[var(--c-text)]">{pdfFile.name}</span>
                  <span className="text-[12px] font-medium text-[var(--c-text-dim)]">{(pdfFile.size / 1024).toFixed(0)} KB</span>
                  <button 
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-full transition-colors pointer-events-auto"
                    onClick={(e) => { e.stopPropagation(); setPdfFile(null); }}
                  >
                    <X size={14} strokeWidth={2.5} /> Remove
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center pointer-events-none">
                  <UploadCloud size={40} className="text-[var(--c-text-mute)] mb-2 group-hover:text-[var(--c-accent)] transition-colors" strokeWidth={1.5} />
                  <span className="text-[15px] font-semibold text-[var(--c-text)]">Click or drag & drop a JD PDF</span>
                  <span className="text-[13px] text-[var(--c-text-mute)]">Max 10 MB · PDF only</span>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 16 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-medium rounded-xl overflow-hidden" 
            role="alert"
          >
            <AlertCircle size={16} strokeWidth={2.5} shrink-0 />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mt-6 pt-6 border-t border-[var(--c-border)]">
        <button
          className={`flex items-center justify-center gap-2 flex-1 py-3 px-4 rounded-xl font-bold text-[14px] transition-all relative overflow-hidden ${
            (loading || (mode === 'text' ? jdText.trim().length < 50 : !pdfFile))
              ? 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)] cursor-not-allowed'
              : 'bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98]'
          }`}
          onClick={handleParse}
          disabled={loading || (mode === 'text' ? jdText.trim().length < 50 : !pdfFile)}
        >
          {loading ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Parsing with AI…
            </>
          ) : (
            <>
              <Sparkles size={18} strokeWidth={2.5} />
              Parse JD
            </>
          )}
        </button>
        <button 
          className="flex items-center justify-center gap-2 py-3 px-6 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] rounded-xl transition-all active:scale-[0.98]" 
          onClick={onSkip}
        >
          Skip
          <ChevronRight size={16} strokeWidth={2.5} className="-mr-1" />
        </button>
      </div>
    </div>
  );
}

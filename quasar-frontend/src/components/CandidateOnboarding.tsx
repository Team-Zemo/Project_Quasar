import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Sparkles, ArrowRight, CheckCircle, X } from 'lucide-react';
import { apiFetchRaw } from '../lib/api';
import { apiPost } from '../lib/api';
import { authState } from '../lib/auth';

export function CandidateOnboarding() {
  const user = authState.getUser();
  const [step, setStep] = useState<'profile' | 'resume'>('profile');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Profile fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeParsed, setResumeParsed] = useState<Record<string, unknown> | null>(null);
  const [skills, setSkills] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await apiPost('/api/onboarding/profile', { name, phone, headline, location });
      if (res.success) {
        setStep('resume');
      } else {
        setError(res.message || 'Failed to save profile');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResumeUpload = async (file: File) => {
    setResumeFile(file);
    setLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await apiFetchRaw('/api/onboarding/resume', {
        method: 'POST',
        body: formData,
        headers: {}, // Let browser set multipart headers
      });
      const json = await res.json();

      if (json.success && json.data) {
        setResumeParsed(json.data.resumeParsed);
        setSkills(json.data.skills || []);
      } else {
        setError(json.message || 'Failed to parse resume');
      }
    } catch {
      setError('Failed to upload resume. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      handleResumeUpload(file);
    } else {
      setError('Please upload a PDF file');
    }
  }, []);

  const handleFinish = () => {
    const currentUser = authState.getUser();
    if (currentUser) {
      authState.setUser({
        ...currentUser,
        profileComplete: true,
        name,
        phone,
        headline,
        location,
        skills,
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider ${
            step === 'profile' ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/30' : 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)]'
          }`}>
            {step === 'resume' ? <CheckCircle size={14} /> : '1'}
            <span>Profile</span>
          </div>
          <div className="w-8 h-px bg-[var(--c-border-2)]" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-bold uppercase tracking-wider ${
            step === 'resume' ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/30' : 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)]'
          }`}>
            2
            <span>Resume</span>
          </div>
        </div>

        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 shadow-[var(--shadow-glass)]">
          {step === 'profile' ? (
            <motion.form
              key="profile"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              onSubmit={handleProfileSubmit}
            >
              <h2 className="text-2xl font-bold text-[var(--c-text)] mb-2">Complete Your Profile</h2>
              <p className="text-[var(--c-text-dim)] text-[14px] mb-6">Tell us a little about yourself.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                    placeholder="John Doe"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Professional Headline</label>
                  <input
                    type="text"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                    placeholder="Senior React Developer"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Phone</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      maxLength={10}
                      className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                      placeholder="9876543210"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Location</label>
                    <input
                      type="text"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                      className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                      placeholder="Bangalore, India"
                    />
                  </div>
                </div>
              </div>

              {error && <p className="text-[var(--c-error)] text-[13px] font-medium mt-4">{error}</p>}

              <button type="submit" disabled={!name || loading} className="btn-primary btn-full mt-6 flex items-center gap-2 justify-center">
                {loading ? <div className="spinner" /> : <>Continue <ArrowRight size={16} /></>}
              </button>
            </motion.form>
          ) : (
            <motion.div
              key="resume"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
              <h2 className="text-2xl font-bold text-[var(--c-text)] mb-2">Upload Your Resume</h2>
              <p className="text-[var(--c-text-dim)] text-[14px] mb-6">
                We'll extract your skills and experience automatically to match you with the right jobs.
              </p>

              {/* Drop Zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-[var(--c-accent)] bg-[var(--c-accent-dim)]'
                    : resumeFile
                    ? 'border-[var(--c-success)]/30 bg-[var(--c-success-dim)]'
                    : 'border-[var(--c-border-2)] bg-[var(--c-surface-2)] hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-3)]'
                }`}
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) handleResumeUpload(file);
                  };
                  input.click();
                }}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="spinner !border-[var(--c-accent)] !border-t-transparent w-8 h-8 !border-[3px]" />
                    <p className="text-[var(--c-text-dim)] text-[13px] font-medium">Analyzing resume with AI...</p>
                  </div>
                ) : resumeFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <FileText size={32} className="text-[var(--c-success)]" />
                    <p className="text-[var(--c-text)] text-[14px] font-semibold">{resumeFile.name}</p>
                    <p className="text-[var(--c-text-dim)] text-[12px]">Click to replace</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <Upload size={32} className="text-[var(--c-text-mute)]" />
                    <p className="text-[var(--c-text)] text-[14px] font-semibold">
                      Drop your resume PDF here
                    </p>
                    <p className="text-[var(--c-text-mute)] text-[12px]">or click to browse</p>
                  </div>
                )}
              </div>

              {/* Extracted Skills */}
              {skills.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-5"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles size={14} className="text-[var(--c-accent)]" />
                    <p className="text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)]">
                      Extracted Skills ({skills.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/20"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSkills(s => s.filter(sk => sk !== skill));
                          }}
                          className="hover:text-[var(--c-error)] transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                </motion.div>
              )}

              {error && <p className="text-[var(--c-error)] text-[13px] font-medium mt-4">{error}</p>}

              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={handleFinish}
                  className={`btn-primary btn-full flex items-center gap-2 justify-center ${!resumeFile ? 'opacity-60' : ''}`}
                >
                  {resumeFile ? 'Finish Setup' : 'Skip for Now'}
                  <ArrowRight size={16} />
                </button>
              </div>

              {!resumeFile && (
                <p className="text-[var(--c-text-mute)] text-[11px] text-center mt-3">
                  You can upload your resume later in Settings. It's required before applying to jobs.
                </p>
              )}
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

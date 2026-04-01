import { useState, type KeyboardEvent } from 'react';
import type { SessionStatus, SessionConfig } from '../types/interview';
import { PersonaSelector } from './PersonaSelector';
import { JDParser } from './JDParser';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, ChevronRight, AlertCircle, ChevronLeft, Check } from 'lucide-react';

interface DomainSelectorProps {
  onStart: (config: SessionConfig) => void;
  status: SessionStatus;
  error: string | null;
}

const POPULAR_DOMAINS = [
  'Software Engineer',
  'Data Scientist',
  'Product Manager',
  'UX Designer',
  'DevOps Engineer',
  'Marketing Manager',
];

type SetupStep = 'domain' | 'persona' | 'jd' | 'ready';

export function DomainSelector({ onStart, status, error }: DomainSelectorProps) {
  const [domain, setDomain] = useState('');
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [, setJdSessionId] = useState<string | null>(null);
  const [step, setStep] = useState<SetupStep>('domain');
  const isConnecting = status === 'connecting';

  const handleDomainNext = () => {
    if (domain.trim()) setStep('persona');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleDomainNext();
  };

  const handlePersonaNext = () => {
    setStep('jd');
  };

  const handleJDParsed = (jdSessId: string, _questions: any[]) => {
    setJdSessionId(jdSessId);
    handleStartInterview(jdSessId);
  };

  const handleJDSkip = () => {
    handleStartInterview(null);
  };

  const handleStartInterview = (jdSessId: string | null) => {
    onStart({
      domain: domain.trim(),
      personaId: selectedPersona || undefined,
      jdSessionId: jdSessId || undefined,
    });
  };

  const handleBack = () => {
    if (step === 'persona') setStep('domain');
    else if (step === 'jd') setStep('persona');
  };

  // Step indicator
  const steps = ['Domain', 'Persona', 'Job Description'];
  const stepIndex = step === 'domain' ? 0 : step === 'persona' ? 1 : 2;

  return (
    <div className="flex flex-col items-center w-full max-w-[900px] mx-auto pt-8 pb-16 px-4 md:px-8 overflow-y-auto overflow-x-hidden">
      {/* Step indicator */}
      <div className="flex items-center gap-3 w-full max-w-[600px] mx-auto mb-12">
        {steps.map((label, i) => {
          const isActive = i <= stepIndex;
          const isDone = i < stepIndex;
          return (
            <div key={label} className={`flex items-center flex-1 transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-40'}`}>
              <div className="flex items-center gap-2 w-full">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[13px] font-bold shrink-0 transition-all duration-300 ${
                  isDone ? 'bg-[var(--c-accent)] text-white shadow-[0_0_12px_rgba(249,115,22,0.4)]' : 
                  isActive ? 'bg-[var(--c-surface-3)] text-[var(--c-text)] border border-[var(--c-border)]' : 
                  'bg-[var(--c-surface-2)] text-[var(--c-text-mute)]'
                }`}>
                  {isDone ? <Check size={16} strokeWidth={3} /> : i + 1}
                </div>
                <span className={`text-[12px] font-bold whitespace-nowrap transition-colors duration-300 ${isActive ? 'text-[var(--c-text)]' : 'text-[var(--c-text-mute)]'}`}>{label}</span>
                {i < steps.length - 1 && (
                  <div className={`h-[2px] w-full ml-2 rounded-full transition-all duration-300 ${isDone ? 'bg-[var(--c-accent)]' : 'bg-[var(--c-surface-3)]'}`} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="w-full flex justify-center"
        >
          {/* Step 1: Domain */}
          {step === 'domain' && (
            <div className="flex flex-col items-center w-full max-w-[640px]">
              {/* Hero badge */}
              <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[12px] font-semibold text-[var(--c-text-dim)] uppercase tracking-widest mb-8 shadow-sm">
                <span className="w-2 h-2 rounded-full bg-[var(--c-success)] shadow-[0_0_8px_var(--c-success)] animate-pulse" />
                AI-Powered • Real-time Voice • Gemini Live
              </div>

              <h1 className="text-[48px] md:text-[56px] font-black tracking-tight text-center text-[var(--c-text)] m-0 leading-[1.1] mb-4 drop-shadow-sm">
                Interview <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-600 drop-shadow-md">AI</span>
              </h1>
              <p className="text-[16px] md:text-[18px] text-center text-[var(--c-text-dim)] mb-10 max-w-[80%] leading-relaxed">
                Practice interviews with a real-time AI interviewer. Select your domain and start talking.
              </p>

              <div className="flex flex-col gap-4 w-full">
                <div className="relative group w-full flex">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-5 pointer-events-none text-[var(--c-text-mute)] group-focus-within:text-[var(--c-accent)] transition-colors">
                    <Search size={22} strokeWidth={2.5} />
                  </div>
                  <input
                    id="domain-input"
                    type="text"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="e.g. Senior Frontend Engineer, Product Manager..."
                    className="w-full h-[56px] sm:h-[64px] pl-14 pr-6 bg-[var(--c-surface-2)] border-2 border-[var(--c-border)] rounded-l-2xl text-[15px] sm:text-[16px] font-medium text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus:outline-none focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] transition-all flex-1"
                    disabled={isConnecting}
                    autoFocus
                  />
                  <button
                    id="next-step-btn"
                    onClick={handleDomainNext}
                    disabled={isConnecting || !domain.trim()}
                    className={`flex items-center justify-center gap-2 h-[56px] sm:h-[64px] px-4 sm:px-8 font-bold text-[14px] sm:text-[16px] rounded-r-2xl transition-all cursor-pointer border-y-2 border-r-2 ${
                      isConnecting || !domain.trim() 
                        ? 'bg-[var(--c-surface-3)] text-[var(--c-text-mute)] border-[var(--c-border)] cursor-not-allowed' 
                        : 'bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white border-[var(--c-accent)] shadow-[0_4px_16px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] active:scale-[0.98]'
                    }`}
                  >
                    Next Step
                    <ChevronRight size={18} strokeWidth={3} className={domain.trim() ? "translate-x-1" : ""} />
                  </button>
                </div>

                <AnimatePresence>
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-medium rounded-xl" 
                      role="alert"
                    >
                      <AlertCircle size={16} strokeWidth={2.5} shrink-0 />
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col gap-3 mt-4">
                  <p className="text-[11px] font-bold text-[var(--c-text-dim)] uppercase tracking-wider pl-1">Popular Domains</p>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_DOMAINS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDomain(d)}
                        className={`px-4 py-2 text-[13px] font-medium rounded-full border transition-all duration-300 ${
                          domain === d 
                            ? 'bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-orange-500/30 shadow-sm' 
                            : 'bg-[var(--c-surface-2)] text-[var(--c-text-dim)] border-[var(--c-border)] hover:bg-[var(--c-surface-3)] hover:text-[var(--c-text)]'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Persona Selection */}
          {step === 'persona' && (
            <div className="flex flex-col w-full max-w-[900px]">
              <PersonaSelector
                selectedPersona={selectedPersona}
                onSelect={setSelectedPersona}
              />
              <div className="flex items-center justify-between mt-8 max-w-[900px] mx-auto w-full">
                <button 
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] rounded-xl transition-all active:scale-[0.98]" 
                  onClick={handleBack}
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                  Back
                </button>
                <button 
                  className={`flex items-center gap-2 px-8 py-3 font-bold text-[14px] rounded-xl transition-all active:scale-[0.98] ${
                    selectedPersona 
                      ? 'bg-[var(--c-accent)] hover:bg-[var(--c-accent-hover)] text-white shadow-[0_4px_12px_rgba(249,115,22,0.3)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]'
                      : 'bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[var(--c-text)] hover:bg-[var(--c-surface-3)]'
                  }`}
                  onClick={handlePersonaNext}
                >
                  {selectedPersona ? 'Next: Job Description' : 'Skip — Use Default'}
                  <ChevronRight size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: JD Parser */}
          {step === 'jd' && (
            <div className="flex flex-col w-full max-w-[800px]">
              <JDParser onParsed={handleJDParsed} onSkip={handleJDSkip} />
              <div className="flex items-start mt-6 w-full max-w-[800px] mx-auto">
                <button 
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--c-surface-2)] hover:bg-[var(--c-surface-3)] border border-[var(--c-border)] text-[var(--c-text)] font-semibold text-[14px] rounded-xl transition-all active:scale-[0.98]" 
                  onClick={handleBack}
                >
                  <ChevronLeft size={16} strokeWidth={2.5} />
                  Back
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

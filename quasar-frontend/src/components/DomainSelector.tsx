import { useState, type KeyboardEvent } from 'react';
import type { SessionStatus, SessionConfig } from '../types/interview';
import { PersonaSelector } from './PersonaSelector';
import { JDParser } from './JDParser';

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
  const [jdSessionId, setJdSessionId] = useState<string | null>(null);
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
    <div className="domain-selector">
      {/* Step indicator */}
      <div className="setup-steps">
        {steps.map((label, i) => (
          <div key={label} className={`setup-step ${i <= stepIndex ? 'setup-step--active' : ''} ${i < stepIndex ? 'setup-step--done' : ''}`}>
            <div className="setup-step__number">{i < stepIndex ? '✓' : i + 1}</div>
            <span className="setup-step__label">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Domain */}
      {step === 'domain' && (
        <>
          {/* Hero badge */}
          <div className="domain-selector__badge">
            <span className="badge-dot" />
            <span>AI-Powered • Real-time Voice • Gemini Live</span>
          </div>

          <h1 className="domain-selector__title">
            Interview <span className="text-accent">AI</span>
          </h1>
          <p className="domain-selector__subtitle">
            Practice interviews with a real-time AI interviewer. Select your domain and start talking.
          </p>

          <div className="input-group">
            <div className="input-wrapper">
              <svg className="input-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
                <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
              </svg>
              <input
                id="domain-input"
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. Senior Frontend Engineer, Product Manager..."
                className="domain-input"
                disabled={isConnecting}
                autoFocus
              />
            </div>

            <button
              id="next-step-btn"
              onClick={handleDomainNext}
              disabled={isConnecting || !domain.trim()}
              className="btn-primary"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
              Next: Choose Persona
            </button>
          </div>

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

          <div className="chips-section">
            <p className="chips-label">Popular Domains</p>
            <div className="chips">
              {POPULAR_DOMAINS.map((d) => (
                <button
                  key={d}
                  onClick={() => setDomain(d)}
                  className={`chip ${domain === d ? 'chip--active' : ''}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Step 2: Persona Selection */}
      {step === 'persona' && (
        <>
          <PersonaSelector
            selectedPersona={selectedPersona}
            onSelect={setSelectedPersona}
          />
          <div className="setup-nav">
            <button className="btn-secondary" onClick={handleBack}>
              ← Back
            </button>
            <button className="btn-primary" onClick={handlePersonaNext}>
              {selectedPersona ? 'Next: Job Description' : 'Skip — Use Default'}
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {/* Step 3: JD Parser */}
      {step === 'jd' && (
        <>
          <JDParser onParsed={handleJDParsed} onSkip={handleJDSkip} />
          <div className="setup-nav" style={{ marginTop: 'var(--space-4)' }}>
            <button className="btn-secondary" onClick={handleBack}>
              ← Back
            </button>
          </div>
        </>
      )}
    </div>
  );
}

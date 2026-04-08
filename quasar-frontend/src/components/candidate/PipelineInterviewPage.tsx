import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Users, ArrowLeft, Shield, Clock, Zap, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { InterviewRoom } from '../InterviewRoom';
import { useInterviewSession } from '../../hooks/useInterviewSession';
import { apiPost } from '../../lib/api';
import type { SessionConfig } from '../../types/interview';

interface Props {
  appId: string;
  mode: 'tech' | 'hr';
  roundNumber?: number;
  domain?: string;
  durationMinutes?: number;
  jdContext: string;
  jobTitle: string;
  company: string;
  alreadyStarted?: boolean;
  onBack: () => void;
  onComplete: () => void;
}

/**
 * Builds a customized system prompt for pipeline interviews.
 * Tech: domain-focused technical deep-dive based on JD.
 * HR: culture-fit, behavioural, and soft-skill evaluation.
 */
function buildSystemPrompt(mode: 'tech' | 'hr', jdContext: string, jobTitle: string, company: string): string {
  if (mode === 'tech') {
    return `You are a senior technical interviewer at "${company}" conducting a focused technical interview for the role of "${jobTitle}".

## Interview Objectives
- Evaluate the candidate's depth of knowledge in the skills required for this role
- Test problem-solving ability, system design thinking, and coding skills
- Assess real-world experience and how they handle technical challenges
- Grade the candidate on a scale of 1–10 at the end

## Job Context
${jdContext}

## Conduct Rules
1. Start with a brief introduction and explain the interview format
2. Ask 4–6 focused technical questions, increasing in difficulty
3. Include at least one coding question using the present_coding_question tool
4. Ask follow-up questions to probe deeper understanding
5. After all questions, provide a brief assessment and end the interview using the end_interview tool
6. Be professional but approachable — this is a real interview, not a quiz
7. Adapt your questions based on the candidate's responses
8. If the candidate struggles, provide hints but note it in the evaluation`;
  }

  return `You are a senior HR manager at "${company}" conducting a culture-fit and behavioral interview for the role of "${jobTitle}".

## Interview Objectives
- Evaluate the candidate's cultural alignment with the company
- Assess communication skills, teamwork, leadership potential
- Understand motivation, career goals, and why they're interested in this role
- Evaluate emotional intelligence, conflict resolution, and adaptability
- Grade the candidate on a scale of 1–10 at the end

## Job Context
${jdContext}

## Conduct Rules
1. Start by making the candidate comfortable — introduce yourself warmly
2. Ask 4–6 behavioral questions using the STAR method framework
3. Include questions about: leadership, teamwork, conflict resolution, motivation
4. Ask about salary expectations and availability
5. Give the candidate time to ask their own questions
6. After all questions, provide a brief summary and end the interview using the end_interview tool
7. Be warm, professional, and encouraging throughout
8. Do NOT ask any technical or coding questions — this is strictly a culture-fit evaluation`;
}

export function PipelineInterviewPage({
  appId, mode, roundNumber = 1, domain, durationMinutes = 30,
  jdContext, jobTitle, company, alreadyStarted, onBack, onComplete,
}: Props) {
  const [phase, setPhase] = useState<'pre' | 'live' | 'completing'>('pre');
  const [startError, setStartError] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState(false);

  const {
    status, messages, error, isRecording, sessionId,
    activeCodingQuestion, startInterview, endInterview,
    resetSession, getTranscript, submitCode,
  } = useInterviewSession();

  const isEnded = status === 'ended' || status === 'error';
  const isActive = status === 'connecting' || status === 'active' || status === 'ready';

  // Start the pipeline round on backend + begin the live interview
  const handleStart = useCallback(async () => {
    setStartLoading(true);
    setStartError(null);

    try {
      // If the round is already in progress (user navigated away and came back),
      // skip the backend /start call — it would reject because status is already *_in_progress
      if (!alreadyStarted) {
        const endpoint = mode === 'tech'
          ? `/api/candidate/applications/${appId}/tech/${roundNumber}/start`
          : `/api/candidate/applications/${appId}/hr/start`;

        const res = await apiPost<{ sessionId: string }>(endpoint, {});
        if (!res.success) {
          setStartError(res.message || 'Failed to start round');
          setStartLoading(false);
          return;
        }
      }

      // Build customized session config
      const systemPrompt = buildSystemPrompt(mode, jdContext, jobTitle, company);
      const config: SessionConfig = {
        domain: mode === 'tech' ? (domain || jobTitle) : `HR Interview - ${jobTitle}`,
        customSystemPrompt: systemPrompt,
      };

      setPhase('live');
      startInterview(config);
    } catch (err: any) {
      setStartError(err.message || 'Failed to start interview');
    } finally {
      setStartLoading(false);
    }
  }, [appId, mode, roundNumber, domain, jdContext, jobTitle, company, alreadyStarted, startInterview]);

  // Complete the pipeline round after session ends
  useEffect(() => {
    if (!isEnded || phase !== 'live') return;
    setPhase('completing');

    const completeRound = async () => {
      try {
        const transcript = getTranscript();

        // Wait a moment for the evaluation to finish on backend
        await new Promise(resolve => setTimeout(resolve, 2000));

        const endpoint = mode === 'tech'
          ? `/api/candidate/applications/${appId}/tech/${roundNumber}/complete`
          : `/api/candidate/applications/${appId}/hr/complete`;

        await apiPost(endpoint, {
          sessionId,
          transcript,
        });
      } catch (err) {
        console.error('Failed to complete pipeline round:', err);
      }
    };

    completeRound();
  }, [isEnded, phase]);

  // ── Pre-interview screen ────────────────────────────────────────────
  if (phase === 'pre') {
    const modeConfig = mode === 'tech'
      ? { icon: Mic, gradient: 'from-blue-500 to-indigo-500', label: `Tech Interview — Round ${roundNumber}`, color: '#6366f1' }
      : { icon: Users, gradient: 'from-emerald-500 to-teal-500', label: 'HR Interview', color: '#14b8a6' };

    const ModeIcon = modeConfig.icon;

    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-16 px-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors mb-8"
          >
            <ArrowLeft size={14} /> Back to Pipeline
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-3xl p-8 text-center"
          >
            {/* Icon */}
            <div
              className="flex items-center justify-center w-20 h-20 rounded-2xl mx-auto mb-6 border"
              style={{
                background: `color-mix(in srgb, ${modeConfig.color} 10%, transparent)`,
                borderColor: `color-mix(in srgb, ${modeConfig.color} 30%, transparent)`,
              }}
            >
              <ModeIcon size={36} style={{ color: modeConfig.color }} />
            </div>

            <h1 className="text-2xl font-black text-[var(--c-text)] tracking-tight mb-2">
              {modeConfig.label}
            </h1>
            <p className="text-[14px] text-[var(--c-text-dim)] mb-6">
              {jobTitle} at {company}
            </p>

            {/* Info cards */}
            <div className="grid grid-cols-3 gap-3 mb-8">
              <div className="bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-3">
                <Clock size={16} className="mx-auto text-[var(--c-text-mute)] mb-1" />
                <p className="text-[12px] font-bold text-[var(--c-text)]">{durationMinutes} min</p>
                <p className="text-[10px] text-[var(--c-text-mute)]">Duration</p>
              </div>
              <div className="bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-3">
                <Zap size={16} className="mx-auto text-[var(--c-text-mute)] mb-1" />
                <p className="text-[12px] font-bold text-[var(--c-text)]">AI Powered</p>
                <p className="text-[10px] text-[var(--c-text-mute)]">Gemini Live</p>
              </div>
              <div className="bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-3">
                <Shield size={16} className="mx-auto text-[var(--c-text-mute)] mb-1" />
                <p className="text-[12px] font-bold text-[var(--c-text)]">Secure</p>
                <p className="text-[10px] text-[var(--c-text-mute)]">Evaluated by AI</p>
              </div>
            </div>

            {/* Instructions */}
            <div className="text-left bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl p-4 mb-6">
              <p className="text-[12px] font-bold text-[var(--c-text)] mb-2">Before you start:</p>
              <ul className="text-[12px] text-[var(--c-text-dim)] space-y-1.5">
                <li>• Ensure your microphone is working and quiet environment</li>
                <li>• Speak clearly and take your time with answers</li>
                {mode === 'tech' && <li>• You may be given a coding question — a code editor will appear</li>}
                {mode === 'hr' && <li>• Be prepared to discuss your experience using the STAR method</li>}
                <li>• The AI interviewer will evaluate your responses in real-time</li>
              </ul>
            </div>

            {startError && (
              <div className="text-[12px] text-[var(--c-error)] bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4">
                {startError}
              </div>
            )}

            <button
              onClick={handleStart}
              disabled={startLoading}
              className={`w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl text-[15px] font-bold text-white bg-gradient-to-r ${modeConfig.gradient} hover:brightness-110 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50`}
            >
              {startLoading ? (
                <><Loader2 size={18} className="animate-spin" /> Preparing...</>
              ) : (
                <><Play size={18} /> Start Interview</>
              )}
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Live interview — reuse the existing InterviewRoom ───────────────
  if (phase === 'live' || (phase === 'completing' && !isEnded)) {
    return (
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
        <InterviewRoom
          messages={messages}
          status={status}
          isRecording={isRecording}
          domain={mode === 'tech' ? (domain || jobTitle) : `HR Interview - ${jobTitle}`}
          sessionId={sessionId}
          activeCodingQuestion={activeCodingQuestion}
          onEnd={endInterview}
          onNewInterview={onComplete}
          onSubmitCode={submitCode}
          getTranscript={getTranscript}
        />
      </div>
    );
  }

  // ── Completing phase — saving results ───────────────────────────────
  if (phase === 'completing') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-20 px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
            <div className="flex items-center justify-center w-16 h-16 rounded-[20px] bg-green-500/10 text-green-500 border border-green-500/20">
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h3 className="text-[20px] font-bold text-[var(--c-text)] mb-2">Interview Complete</h3>
              <p className="text-[14px] text-[var(--c-text-dim)]">Your responses are being evaluated. Results will appear in your pipeline tracker.</p>
            </div>
            <button
              onClick={onComplete}
              className="mt-4 px-6 py-2.5 rounded-xl text-[14px] font-bold text-[var(--c-text)] bg-[var(--c-surface)] border border-[var(--c-border-2)] hover:bg-[var(--c-surface-3)] transition-colors"
            >
              Back to Applications
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}

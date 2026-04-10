import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mic, Users, ArrowLeft, Shield, Clock, Zap, Play, Loader2, CheckCircle2 } from 'lucide-react';
import { InterviewRoom } from '../InterviewRoom';
import { useInterviewSession } from '../../hooks/useInterviewSession';
import { apiGet, apiPost } from '../../lib/api';
import type { SessionConfig } from '../../types/interview';
import { ProctoringGuard } from './ProctoringGuard';

/**
 * Route state passed via navigate('/pipeline-interview', { state: ... })
 */
interface PipelineInterviewState {
  appId: string;
  mode: 'tech' | 'hr';
  roundNumber: number;
  domain: string;
  durationMinutes: number;
  jdContext: string;
  jobTitle: string;
  company: string;
  alreadyStarted?: boolean;
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

export function PipelineInterviewPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = location.state as PipelineInterviewState | null;

  // Destructure with defaults so hooks are called consistently regardless of state
  const appId = params?.appId ?? '';
  const mode = params?.mode ?? 'tech';
  const roundNumber = params?.roundNumber ?? 1;
  const domain = params?.domain ?? '';
  const durationMinutes = params?.durationMinutes ?? 30;
  const jdContext = params?.jdContext ?? '';
  const jobTitle = params?.jobTitle ?? '';
  const company = params?.company ?? '';
  const alreadyStarted = params?.alreadyStarted ?? false;

  const [phase, setPhase] = useState<'pre' | 'live' | 'completing'>('pre');
  const [startError, setStartError] = useState<string | null>(null);
  const [startLoading, setStartLoading] = useState(false);
  const [pipelineSessionId, setPipelineSessionId] = useState<string | null>(null);
  const [completionDone, setCompletionDone] = useState(false);

  const {
    status, messages, isRecording, isMuted, pttEnabled, sessionId,
    activeCodingQuestion, startInterview, endInterview,
    getTranscript, submitCode, setMuted, setPttEnabled,
  } = useInterviewSession();

  const isEnded = status === 'ended' || status === 'error';

  // Redirect if no route state (e.g. user navigated directly to /pipeline-interview)
  useEffect(() => {
    if (!params) {
      navigate('/my-applications', { replace: true });
    }
  }, [params, navigate]);

  const handleBack = useCallback(() => {
    navigate('/my-applications', { state: { activeAppId: appId } });
  }, [navigate, appId]);

  const handleComplete = useCallback(() => {
    navigate('/my-applications', { state: { activeAppId: appId, refreshKey: Date.now() } });
  }, [navigate, appId]);

  // Start the pipeline round on backend + begin the live interview
  const handleStart = useCallback(async () => {
    setStartLoading(true);
    setStartError(null);

    try {
      let capturedSessionId: string | undefined;

      if (!alreadyStarted) {
        // Fresh start — call the pipeline /start endpoint to create a session
        const endpoint = mode === 'tech'
          ? `/api/candidate/applications/${appId}/tech/${roundNumber}/start`
          : `/api/candidate/applications/${appId}/hr/start`;

        const res = await apiPost<{ sessionId: string }>(endpoint, {});
        if (!res.success) {
          setStartError(res.message || 'Failed to start round');
          setStartLoading(false);
          return;
        }
        capturedSessionId = res.data?.sessionId;
      } else {
        // Round already in progress (user navigated away and came back).
        // Fetch the existing pipeline session ID from the application data
        // so we reuse it instead of creating a duplicate.
        try {
          const appsRes = await apiGet<any[]>('/api/candidate/applications');
          if (appsRes.success && Array.isArray(appsRes.data)) {
            const app = (appsRes.data as any[]).find((a: any) => a._id === appId);
            if (app) {
              if (mode === 'tech') {
                const techResult = app.techResults?.find((r: any) => r.roundNumber === roundNumber);
                capturedSessionId = techResult?.sessionId;
              } else {
                capturedSessionId = app.hrResult?.sessionId;
              }
            }
          }
        } catch (err) {
          console.warn('[Pipeline] Could not fetch existing session ID:', err);
        }
      }

      if (capturedSessionId) setPipelineSessionId(capturedSessionId);

      // Build customized session config
      const systemPrompt = buildSystemPrompt(mode, jdContext, jobTitle, company);
      const config: SessionConfig = {
        domain: mode === 'tech' ? (domain || jobTitle) : `HR Interview - ${jobTitle}`,
        customSystemPrompt: systemPrompt,
        // Reuse the pipeline's session so InterviewRoom saves metrics to the correct record
        pipelineSessionId: capturedSessionId,
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

    // The hook's sessionId is the one InterviewRoom saved metrics/transcript to.
    // pipelineSessionId is the one stored in the application record.
    // If the hook successfully reused the pipeline session, they'll be the same.
    // If not (e.g. alreadyStarted fetch failed), they may differ — use the hook's for eval.
    const evalSessionId = sessionId || pipelineSessionId;
    const completeSessionId = sessionId || pipelineSessionId;

    const completeRound = async () => {
      if (!evalSessionId) {
        console.error('[Pipeline] No session ID available for completion');
        return;
      }

      try {
        const transcript = getTranscript();

        // Step 1: Wait briefly for InterviewRoom's /end call to persist transcript
        await new Promise(resolve => setTimeout(resolve, 2500));

        // Step 2: Trigger evaluation (this scores the session and sets status='completed')
        // In the direct flow, PostSessionResults does this — but the pipeline replaces InterviewRoom
        // with a "completing" screen, so we must do it here.
        console.log('[Pipeline] Triggering evaluation for session:', evalSessionId);
        const evalRes = await apiPost(`/api/sessions/${evalSessionId}/evaluate`, {});
        if (!evalRes.success) {
          console.warn('[Pipeline] Evaluation failed:', evalRes.message, '— attempting /complete anyway');
        } else {
          console.log('[Pipeline] Evaluation completed successfully');
        }

        // Step 3: Now call the pipeline /complete endpoint to advance the application status
        const endpoint = mode === 'tech'
          ? `/api/candidate/applications/${appId}/tech/${roundNumber}/complete`
          : `/api/candidate/applications/${appId}/hr/complete`;

        const completeRes = await apiPost(endpoint, {
          sessionId: completeSessionId,
          transcript,
        });

        if (completeRes.success) {
          console.log('[Pipeline] Round completed successfully:', completeRes.data);
        } else {
          console.error('[Pipeline] Complete round failed:', completeRes.message);
        }
      } catch (err) {
        console.error('Failed to complete pipeline round:', err);
      } finally {
        setCompletionDone(true);
      }
    };

    completeRound();
  }, [isEnded, phase]);

  // Don't render anything if there's no route state
  if (!params) return null;

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
            onClick={handleBack}
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
      <ProctoringGuard appId={appId} round={mode} roundNumber={roundNumber} onAutoTerminate={endInterview}>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden h-full">
        <InterviewRoom
          messages={messages}
          status={status}
          isRecording={isRecording}
          domain={mode === 'tech' ? (domain || jobTitle) : `HR Interview - ${jobTitle}`}
          sessionId={sessionId}
          activeCodingQuestion={activeCodingQuestion}
          onEnd={endInterview}
          onNewInterview={handleComplete}
          onSubmitCode={submitCode}
          getTranscript={getTranscript}
          isMuted={isMuted}
          setMuted={setMuted}
          pttEnabled={pttEnabled}
          setPttEnabled={setPttEnabled}
        />
      </div>
      </ProctoringGuard>
    );
  }

  // ── Completing phase — saving results ───────────────────────────────
  if (phase === 'completing') {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto py-20 px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-5">
            {completionDone ? (
              <>
                <div className="flex items-center justify-center w-16 h-16 rounded-[20px] bg-green-500/10 text-green-500 border border-green-500/20">
                  <CheckCircle2 size={32} />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-[var(--c-text)] mb-2">Interview Complete</h3>
                  <p className="text-[14px] text-[var(--c-text-dim)]">Your responses have been evaluated. View your results in the pipeline tracker.</p>
                </div>
                <button
                  onClick={handleComplete}
                  className="mt-4 px-6 py-2.5 rounded-xl text-[14px] font-bold text-[var(--c-text)] bg-[var(--c-surface)] border border-[var(--c-border-2)] hover:bg-[var(--c-surface-3)] transition-colors"
                >
                  Back to Applications
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-16 h-16 rounded-[20px] bg-[var(--c-accent)]/10 text-[var(--c-accent)] border border-[var(--c-accent)]/20">
                  <Loader2 size={32} className="animate-spin" />
                </div>
                <div>
                  <h3 className="text-[20px] font-bold text-[var(--c-text)] mb-2">Evaluating Your Interview</h3>
                  <p className="text-[14px] text-[var(--c-text-dim)]">Please wait while we analyze your responses and calculate your score...</p>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    );
  }

  return null;
}

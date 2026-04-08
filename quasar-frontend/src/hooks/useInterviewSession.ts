import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import type { Session } from '@google/genai';
import type { Message, SessionStatus, SessionConfig, CodingQuestion } from '../types/interview';
import { useAudioProcessor } from './useAudioProcessor';

const GEMINI_MODEL = 'gemini-3.1-flash-live-preview';
const AUDIO_MIME   = 'audio/pcm;rate=16000';

const INTERVIEW_TOOLS = {
  functionDeclarations: [
    {
      name: 'end_interview',
      description:
        'Call this function when the interview is complete. ' +
        'Use it after delivering your closing remarks and thanking the candidate. ' +
        'This will gracefully end the session on the client side.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          closing_remark: {
            type: Type.STRING,
            description: 'A short, warm closing message to the candidate summarising the session.',
          },
        },
        required: ['closing_remark'],
      },
    },
    {
      name: 'present_coding_question',
      description:
        'Call this function when you want to present a coding challenge to the candidate. ' +
        "Say the question out loud first, then immediately call this function. " +
        'The system will pause audio capture and show the candidate a code editor. ' +
        "You must wait silently -- do NOT speak again until you receive the candidate's code submission.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          question_title: {
            type: Type.STRING,
            description: 'Short title of the coding question, e.g. "Reverse a Linked List".',
          },
          question_description: {
            type: Type.STRING,
            description: 'Full problem statement including constraints and examples.',
          },
          preferred_language: {
            type: Type.STRING,
            description: 'Preferred programming language, e.g. "Python", "JavaScript", "Any".',
          },
        },
        required: ['question_title', 'question_description', 'preferred_language'],
      },
    },
  ],
};

/**
 * Central hook that manages the entire interview session.
 *
 * NEW ARCHITECTURE (Spring Boot backend + ephemeral tokens):
 *   1. POST /api/sessions          → create session in DB
 *   2. POST /api/session/token     → fetch ephemeral token + systemPrompt from Spring Boot
 *   3. GoogleGenAI({ apiKey: token }) + ai.live.connect() → direct Gemini Live API
 */
export function useInterviewSession() {
  const [status, setStatus]     = useState<SessionStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError]       = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId]     = useState<string | null>(null);
  const [activeCodingQuestion, setActiveCodingQuestion] = useState<CodingQuestion | null>(null);

  const geminiSessionRef = useRef<Session | null>(null);
  // A status ref avoids stale closure in Gemini callbacks
  const statusRef = useRef<SessionStatus>('idle');
  
  // Track pending coding call so we can resolve the sync function call
  const pendingCodingCallRef = useRef<{ id: string; name: string } | null>(null);

  const { startRecording, stopRecording, playChunk, clearQueue, destroy } = useAudioProcessor();

  const updateStatus = useCallback((s: SessionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { geminiSessionRef.current?.close(); } catch { /* ignore */ }
      destroy();
    };
  }, [destroy]);

  // ──────────────────────────────────────────────────────────────────
  // Helpers
  // ──────────────────────────────────────────────────────────────────

  const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      // Merge streaming chunks from same role continuously
      if (last?.role === role) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() }];
    });
  }, []);

  // ──────────────────────────────────────────────────────────────────
  // Start interview — fetch token → connect to Gemini Live directly
  // ──────────────────────────────────────────────────────────────────

  const startInterview = useCallback(async (config: SessionConfig) => {
    if (!config.domain.trim()) {
      setError('Please enter an interview domain first.');
      return;
    }

    setError(null);
    setMessages([]);
    pendingCodingCallRef.current = null;
    updateStatus('connecting');

    try {
      // ── Step 1: Create session record in the Spring Boot database ──
      fetch('/api/sessions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain:      config.domain,
          personaId:   config.personaId,
          jdSessionId: config.jdSessionId,
        }),
      })
        .then(r => r.json())
        .then(json => { if (json.success && json.data?.id) setSessionId(json.data.id); })
        .catch(() => { /* non-fatal — evaluation still works */ });

      // ── Step 2: Fetch ephemeral token + persona system prompt ──
      const tokenRes = await fetch('/api/session/token', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain:            config.domain,
          personaId:         config.personaId,
          customSystemPrompt: config.customSystemPrompt,
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.json().catch(() => ({ message: 'Token request failed' }));
        throw new Error(err.message || `Token request failed (${tokenRes.status})`);
      }

      const tokenJson = await tokenRes.json();
      const ephemeralToken: string = tokenJson.data?.token;
      const serverSystemPrompt: string | undefined = tokenJson.data?.systemPrompt;

      if (!ephemeralToken) throw new Error('No ephemeral token received from server');

      // ── Step 3: Build system instruction ───────────────────────────
      const defaultSystemPrompt =
        `You are a senior, highly experienced technical interviewer at a top-tier tech company conducting a rigorous ${config.domain} interview. ` +
        `Your style is professional, warm, and highly focused. You conduct real-world, realistic interviews. NEVER break character. You are the interviewer, NOT an AI assistant.\n\n` +
        `CRITICAL INSTRUCTIONS FOR INTERVIEW FLOW:\n` +
        `1. PHASE 1: Introduction. Briefly introduce yourself and ask the candidate to briefly introduce their background.\n` +
        `2. PHASE 2: Deep Dive. Ask targeted, escalating questions. Probe deeply into tradeoff decisions, architecture, and constraints. Do NOT accept superficial answers. Ask follow-up questions to test their limits.\n` +
        `3. PHASE 3: Coding Challenge. Mid-way through, you MUST use the present_coding_question tool to test algorithmic thinking.\n` +
        `4. PHASE 4: Conclusion. Wrap up gracefully, thank them, and IMMEDIATELY call the end_interview tool.\n\n` +
        `STRICT RULES:\n` +
        `- Keep your conversational turns CONCISE. Ask exactly ONE question at a time. Do not overwhelm the candidate with multiple questions at once.\n` +
        `- DO NOT provide answers, hints, or complete code for them. Let them struggle if necessary.\n` +
        `- If the candidate is vague, actively interrupt their line of reasoning and ask for a concrete real-world example.\n` +
        `- Use "Any" for preferred_language in coding tools if not specified.`;

      const finalSystemInstruction =
        (serverSystemPrompt && serverSystemPrompt.trim().length > 0)
          ? serverSystemPrompt
          : (config.customSystemPrompt || defaultSystemPrompt);

      // ── Step 4: Connect directly to Gemini Live API ─────────────────
      const ai = new GoogleGenAI({ 
        apiKey: ephemeralToken,
        httpOptions: { apiVersion: 'v1alpha' }
      });

      const session = await ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: ['AUDIO'] as any,
          systemInstruction: {
            parts: [{ text: finalSystemInstruction }],
          },
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
          tools: [INTERVIEW_TOOLS as any],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Charon' },
            },
          },
        },
        callbacks: {
          onopen: () => {
            console.log('[Gemini Live] Connected');
            updateStatus('active');
            setIsRecording(true);

            // Start mic → stream 16kHz PCM to Gemini in real time
            startRecording((base64: string) => {
              try {
                session.sendRealtimeInput({
                  audio: { data: base64, mimeType: AUDIO_MIME },
                });
              } catch { /* session may be closing */ }
            }).catch((err: Error) => {
              setError('Microphone access denied: ' + err.message);
              updateStatus('error');
            });
          },

          onmessage: (response) => {
            // Check for tool calls first!
            if (response.toolCall) {
              const functionResponses: any[] = [];
              for (const fc of response.toolCall.functionCalls ?? []) {
                console.log('[Gemini Live] Tool call:', fc.name, fc.args);
                
                if (fc.name === 'end_interview') {
                  functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: 'interview_ended' },
                  });
                  // Trigger end session flow
                  stopRecording();
                  setIsRecording(false);
                  updateStatus('ended');
                  
                } else if (fc.name === 'present_coding_question') {
                  const args = fc.args as any;
                  // Store pending call so we can resolve when code is submitted
                  pendingCodingCallRef.current = { id: fc.id || '', name: fc.name || '' };
                  
                  stopRecording(); // Pause mic while typing
                  setIsRecording(false);
                  
                  setActiveCodingQuestion({
                    title: args.question_title || 'Coding Challenge',
                    description: args.question_description || '',
                    preferredLanguage: args.preferred_language || 'Any',
                  });
                  // Do NOT add to functionResponses yet -- we will respond when they submit
                } else {
                  functionResponses.push({
                    id: fc.id,
                    name: fc.name,
                    response: { result: 'unknown_tool' },
                  });
                }
              }
              
              if (functionResponses.length > 0) {
                try {
                   // Cast to any since standard typescript definitions for sendToolResponse might vary
                   (session as any).sendToolResponse({ functionResponses });
                } catch (e) { console.error('Failed to send tool response', e); }
              }
            }

            const content = response.serverContent;
            if (!content) return;

            // ── Audio output from Gemini ──────────────────────────────
            if (content.modelTurn?.parts) {
              for (const part of content.modelTurn.parts) {
                if (part.inlineData?.data) {
                  playChunk(part.inlineData.data);
                }
              }
            }

            // ── Text transcripts ─────────────────────────────────────
            if (content.outputTranscription?.text) {
              addMessage('assistant', content.outputTranscription.text);
            }
            if (content.inputTranscription?.text) {
              addMessage('user', content.inputTranscription.text);
            }

            // ── Interruption → clear audio queue ─────────────────────
            if (content.interrupted) {
              clearQueue();
            }
          },

          onerror: (event: ErrorEvent) => {
            console.error('[Gemini Live] Error:', event);
            setError('Live API error: ' + (event.message || 'Unknown error'));
            updateStatus('error');
            setIsRecording(false);
            stopRecording();
          },

          onclose: () => {
            console.log('[Gemini Live] Session closed');
            const current = statusRef.current;
            if (current !== 'ended' && current !== 'error') {
              updateStatus('ended');
            }
            setIsRecording(false);
            stopRecording();
          },
        },
      });

      geminiSessionRef.current = session;

    } catch (err) {
      console.error('[Interview] Failed to start:', err);
      setError(err instanceof Error ? err.message : 'Failed to start interview session');
      updateStatus('error');
      setIsRecording(false);
    }
  }, [updateStatus, startRecording, stopRecording, playChunk, clearQueue, addMessage]);

  // ──────────────────────────────────────────────────────────────────
  // End interview manually
  // ──────────────────────────────────────────────────────────────────

  const endInterview = useCallback(() => {
    try {
      // Signal audio stream end so Gemini flushes cached audio buffers
      geminiSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
    } catch { /* already closed */ }

    stopRecording();
    setIsRecording(false);
    updateStatus('ended');
    setActiveCodingQuestion(null);

    // Give 500ms for final audio to drain, then close
    const session = geminiSessionRef.current;
    geminiSessionRef.current = null;
    setTimeout(() => {
      try { session?.close(); } catch { /* ignore */ }
    }, 500);
  }, [stopRecording, updateStatus]);

  // ──────────────────────────────────────────────────────────────────
  // Reset
  // ──────────────────────────────────────────────────────────────────

  const resetSession = useCallback(() => {
    try { geminiSessionRef.current?.close(); } catch { /* ignore */ }
    geminiSessionRef.current = null;
    pendingCodingCallRef.current = null;
    destroy();
    updateStatus('idle');
    setMessages([]);
    setError(null);
    setIsRecording(false);
    setSessionId(null);
    setActiveCodingQuestion(null);
  }, [destroy, updateStatus]);

  // ──────────────────────────────────────────────────────────────────
  // Code submission (Resolves the pending tool call)
  // ──────────────────────────────────────────────────────────────────

  const submitCode = useCallback((code: string, language: string) => {
    if (pendingCodingCallRef.current) {
        // Resolve the outstanding tool call!
        try {
            (geminiSessionRef.current as any)?.sendToolResponse({
                functionResponses: [{
                    id: pendingCodingCallRef.current.id,
                    name: pendingCodingCallRef.current.name,
                    response: { result: 'code_submitted', language, code }
                }]
            });
        } catch (e) {
            console.error('Failed to send code tool response', e);
        }
        pendingCodingCallRef.current = null;
    } else {
        // Fallback if no pending tool call -- just inject as text
        const codeMessage = `[CODE SUBMISSION – ${language}]\n\`\`\`${language}\n${code}\n\`\`\`\nPlease evaluate this solution.`;
        try {
            geminiSessionRef.current?.sendRealtimeInput({ text: codeMessage });
        } catch { /* ignore */ }
    }

    setActiveCodingQuestion(null);
    setIsRecording(true);
    startRecording((base64: string) => {
      try {
        geminiSessionRef.current?.sendRealtimeInput({
          audio: { data: base64, mimeType: AUDIO_MIME },
        });
      } catch { /* ignore */ }
    }).catch(() => {});
  }, [startRecording]);

  // ──────────────────────────────────────────────────────────────────
  // Transcript helper
  // ──────────────────────────────────────────────────────────────────

  const getTranscript = useCallback(() => {
    return messages
      .map(m => `[${m.role === 'user' ? 'You' : 'Interviewer'}]: ${m.text}`)
      .join('\n');
  }, [messages]);

  return {
    status,
    messages,
    error,
    isRecording,
    sessionId,
    activeCodingQuestion,
    startInterview,
    endInterview,
    resetSession,
    getTranscript,
    submitCode,
  };
}

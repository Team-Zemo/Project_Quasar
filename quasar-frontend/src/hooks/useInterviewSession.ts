import { useState, useRef, useCallback, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import type { Session } from '@google/genai';
import type { Message, SessionStatus, SessionConfig, CodingQuestion } from '../types/interview';
import { useAudioProcessor } from './useAudioProcessor';

const GEMINI_MODEL = 'gemini-2.0-flash-live-001';
const AUDIO_MIME   = 'audio/pcm;rate=16000';

/**
 * Central hook that manages the entire interview session.
 *
 * NEW ARCHITECTURE (Spring Boot backend + ephemeral tokens):
 *   1. POST /api/sessions          → create session in DB
 *   2. POST /api/session/token     → fetch ephemeral token + systemPrompt from Spring Boot
 *   3. GoogleGenAI({ apiKey: token }) + ai.live.connect() → direct Gemini Live API
 *
 * No WebSocket proxy is needed — the frontend talks directly to Gemini
 * using the short-lived ephemeral token issued by the backend.
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
      // Merge streaming chunks from same role within 3 seconds
      if (last?.role === role && Date.now() - last.timestamp < 3000) {
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
        `You are a professional senior technical interviewer conducting a rigorous yet fair ${config.domain} interview. ` +
        `Open by introducing yourself briefly, then ask the first question. Follow up deeply on every answer — probe for depth, tradeoffs, and concrete examples. ` +
        `Stay in character at all times. Do not provide answers or hints. ` +
        `Vary question difficulty based on answer quality. ` +
        `After 8–12 exchanges, conclude the interview gracefully and thank the candidate.`;

      const finalSystemInstruction =
        (serverSystemPrompt && serverSystemPrompt.trim().length > 0)
          ? serverSystemPrompt
          : (config.customSystemPrompt || defaultSystemPrompt);

      // ── Step 4: Connect directly to Gemini Live API ─────────────────
      const ai = new GoogleGenAI({ apiKey: ephemeralToken });

      const session = await ai.live.connect({
        model: GEMINI_MODEL,
        config: {
          responseModalities: ['AUDIO'],
          systemInstruction: {
            parts: [{ text: finalSystemInstruction }],
          },
          outputAudioTranscription: {},
          inputAudioTranscription:  {},
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

            // ── Generation complete ───────────────────────────────────
            if (content.generationComplete) {
              // no-op: voice continues, nothing to do
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
  // End interview
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
    destroy();
    updateStatus('idle');
    setMessages([]);
    setError(null);
    setIsRecording(false);
    setSessionId(null);
    setActiveCodingQuestion(null);
  }, [destroy, updateStatus]);

  // ──────────────────────────────────────────────────────────────────
  // Code submission (sends code as text to Gemini for evaluation)
  // ──────────────────────────────────────────────────────────────────

  const submitCode = useCallback((code: string, language: string) => {
    const codeMessage =
      `[CODE SUBMISSION – ${language}]\n\`\`\`${language}\n${code}\n\`\`\`\nPlease evaluate this solution.`;

    try {
      geminiSessionRef.current?.sendRealtimeInput({ text: codeMessage });
    } catch { /* session may be closed */ }

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

import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message, ServerMessage, BrowserMessage, SessionStatus, SessionConfig, CodingQuestion } from '../types/interview';
import { useAudioProcessor } from './useAudioProcessor';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/interview`;

/** 
 * Central hook for the interview session.
 *
 * Race-condition fixes applied:
 *  1. statusRef — keeps onclose/onerror handlers from reading stale React state.
 *  2. msgHandlerRef — ws.onmessage always calls the latest handleServerMessage
 *     without recreation of the WebSocket.
 *  3. Teardown guard — startInterview closes any in-flight socket before
 *     creating a new one to prevent phantom onopen/onclose pairs.
 */
export function useInterviewSession() {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeCodingQuestion, setActiveCodingQuestion] = useState<CodingQuestion | null>(null);

  const wsRef    = useRef<WebSocket | null>(null);
  const { startRecording, stopRecording, playChunk, clearQueue, setMuted: setProcessorMuted, destroy } = useAudioProcessor();
  const [isMuted, setIsMuted] = useState(true);

  // ── Refs that let socket callbacks always read the latest values ────
  /** Mirror of `status` that is safe to read inside WebSocket callbacks */
  const statusRef = useRef<SessionStatus>('idle');
  /** Always points to the latest handleServerMessage — avoids stale closure */
  const msgHandlerRef = useRef<((msg: ServerMessage) => void) | null>(null);

  /** Synchronously update both the ref and the React state */
  const setStatusSynced = useCallback((s: SessionStatus) => {
    statusRef.current = s;
    setStatus(s);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      destroy();
    };
  }, [destroy]);

  // ─────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────

  const sendWsMessage = useCallback((msg: BrowserMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const addMessage = useCallback((role: 'user' | 'assistant', text: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === role) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() }];
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────
  // Incoming message router
  // ─────────────────────────────────────────────────────────────────

  const handleServerMessage = useCallback(
    (msg: ServerMessage) => {
      switch (msg.type) {
        case 'connected':
          break;

        case 'session_ready':
          setStatusSynced('active');
          setIsRecording(true);
          setIsMuted(true);
          startRecording((base64) => {
            sendWsMessage({ type: 'audio', data: base64 });
          }).then(() => {
            setProcessorMuted(true);
          }).catch((err) => {
            setError('Microphone access denied: ' + err.message);
            setStatusSynced('error');
          });
          break;

        case 'audio':
          if (msg.data) playChunk(msg.data);
          break;

        case 'interrupted':
          clearQueue();
          break;

        case 'transcript_user':
          if (msg.text) addMessage('user', msg.text);
          break;

        case 'transcript_model':
          if (msg.text) addMessage('assistant', msg.text);
          break;

        case 'interview_ended_by_ai':
          setIsRecording(false);
          stopRecording();
          break;

        case 'coding_question':
          setIsRecording(false);
          stopRecording();
          setActiveCodingQuestion({
            title: msg.questionTitle ?? 'Coding Challenge',
            description: msg.questionDescription ?? '',
            preferredLanguage: msg.preferredLanguage ?? 'Any',
          });
          break;

        case 'session_ended':
          setStatusSynced('ended');
          setIsRecording(false);
          setActiveCodingQuestion(null);
          stopRecording();
          break;

        case 'error':
          setError(msg.message ?? 'An unknown error occurred.');
          setStatusSynced('error');
          setIsRecording(false);
          stopRecording();
          break;
      }
    },
    [startRecording, stopRecording, playChunk, clearQueue, addMessage, sendWsMessage, setStatusSynced, setProcessorMuted],
  );

  // Keep the ref pointing to the latest handler — no socket recreation needed
  useEffect(() => {
    msgHandlerRef.current = handleServerMessage;
  }, [handleServerMessage]);

  // ─────────────────────────────────────────────────────────────────
  // Public API
  // ─────────────────────────────────────────────────────────────────

  const startInterview = useCallback(
    (config: SessionConfig) => {
      if (!config.domain.trim()) {
        setError('Please enter a domain first.');
        return;
      }

      setError(null);
      setMessages([]);
      setStatusSynced('connecting');

      // ── Tear down any existing connection first ─────────────────
      const prev = wsRef.current;
      if (prev && prev.readyState < WebSocket.CLOSING) {
        // Silence handlers so stale events don't fire after teardown
        prev.onopen    = null;
        prev.onmessage = null;
        prev.onclose   = null;
        prev.onerror   = null;
        prev.close();
      }
      wsRef.current = null;

      // ── Create session in DB (or reuse pipeline session) ────────
      if (config.pipelineSessionId) {
        setSessionId(config.pipelineSessionId);
      } else {
        fetch('/api/sessions', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: config.domain,
            personaId: config.personaId,
            jdSessionId: config.jdSessionId,
          }),
        })
          .then(res => res.json())
          .then(json => { if (json.success && json.data) setSessionId(json.data.id); })
          .catch(() => {});
      }

      // ── Open new WebSocket ──────────────────────────────────────
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        // Guard: verify this socket is still the current one
        if (wsRef.current !== ws) return;
        sendWsMessage({
          type: 'setup',
          domain: config.domain,
          personaId: config.personaId,
          customSystemPrompt: config.customSystemPrompt,
        });
      };

      ws.onmessage = (event) => {
        // Guard: verify this socket is still the current one
        if (wsRef.current !== ws) return;
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          // Use ref so we always call the latest handler without re-creating the socket
          msgHandlerRef.current?.(msg);
        } catch {
          console.error('Failed to parse server message:', event.data);
        }
      };

      ws.onclose = () => {
        // Guard: only react if this is still the current socket
        if (wsRef.current !== ws) return;
        wsRef.current = null;
        // Read statusRef not stale state closure
        if (statusRef.current !== 'ended') {
          setStatusSynced('idle');
          setIsRecording(false);
          stopRecording();
        }
      };

      ws.onerror = () => {
        // Guard: only react if this is still the current socket
        if (wsRef.current !== ws) return;
        setError('WebSocket connection failed. Is the backend running?');
        setStatusSynced('error');
        setIsRecording(false);
        stopRecording();
      };
    },
    [sendWsMessage, stopRecording, setStatusSynced],
    // Note: handleServerMessage intentionally excluded — msgHandlerRef keeps it fresh
  );

  const endInterview = useCallback(() => {
    sendWsMessage({ type: 'end' });
    stopRecording();
    setIsRecording(false);
    setStatusSynced('ended');
    // Give the 'end' message time to flush before closing the socket
    const ws = wsRef.current;
    wsRef.current = null;
    setTimeout(() => { ws?.close(); }, 200);
  }, [sendWsMessage, stopRecording, setStatusSynced]);

  const resetSession = useCallback(() => {
    destroy();
    setStatusSynced('idle');
    setMessages([]);
    setError(null);
    setIsRecording(false);
    setSessionId(null);
    setActiveCodingQuestion(null);
  }, [destroy, setStatusSynced]);

  const submitCode = useCallback((code: string, language: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'code_submission',
        code,
        language,
      } satisfies BrowserMessage));
    }
    setActiveCodingQuestion(null);
    setIsRecording(true);
    setIsMuted(true);
    startRecording((base64) => {
      sendWsMessage({ type: 'audio', data: base64 });
    }).then(() => {
      setProcessorMuted(true);
    }).catch(() => {});
  }, [sendWsMessage, startRecording, setProcessorMuted]);

  const getTranscript = useCallback(() => {
    return messages.map(m => `[${m.role === 'user' ? 'You' : 'Interviewer'}]: ${m.text}`).join('\n');
  }, [messages]);

  const setMuted = useCallback((muted: boolean) => {
    setProcessorMuted(muted);
    setIsMuted(muted);
  }, [setProcessorMuted]);

  return {
    status,
    messages,
    error,
    isRecording,
    isMuted,
    sessionId,
    activeCodingQuestion,
    startInterview,
    endInterview,
    resetSession,
    getTranscript,
    submitCode,
    setMuted,
  };
}

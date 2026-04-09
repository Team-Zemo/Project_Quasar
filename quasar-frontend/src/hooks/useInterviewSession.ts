import { useState, useRef, useCallback, useEffect } from 'react';
import type { Message, ServerMessage, BrowserMessage, SessionStatus, SessionConfig, CodingQuestion } from '../types/interview';
import { useAudioProcessor } from './useAudioProcessor';

const WS_PROTOCOL = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${WS_PROTOCOL}//${window.location.host}/ws/interview`;

/**
 * Central hook that manages the entire interview session:
 * - WebSocket connection to backend
 * - Audio capture & playback via useAudioProcessor
 * - Message state (transcript log)
 * - Session status machine
 */
export function useInterviewSession() {
  const [status, setStatus] = useState<SessionStatus>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [activeCodingQuestion, setActiveCodingQuestion] = useState<CodingQuestion | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const { startRecording, stopRecording, playChunk, clearQueue, setMuted: setProcessorMuted, destroy } = useAudioProcessor();
  const [isMuted, setIsMuted] = useState(true); // PTT: starts muted

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
      // Append to last message of same role (streaming transcription chunks)
      if (last?.role === role) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: last.text + text },
        ];
      }
      return [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, role, text, timestamp: Date.now() },
      ];
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
          setStatus('active');
          setIsRecording(true);
          setIsMuted(true); // Start muted — push-to-talk
          startRecording((base64) => {
            sendWsMessage({ type: 'audio', data: base64 });
          }).then(() => {
            // Ensure processor starts in muted state
            setProcessorMuted(true);
          }).catch((err) => {
            setError('Microphone access denied: ' + err.message);
            setStatus('error');
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
          // AI gracefully concluded — stop mic immediately, let final audio finish
          setIsRecording(false);
          stopRecording();
          // session_ended will arrive ~3.5s later from backend to fully close out
          break;

        case 'coding_question':
          // AI is presenting a coding challenge — pause mic, surface the code editor
          setIsRecording(false);
          stopRecording();
          setActiveCodingQuestion({
            title: msg.questionTitle ?? 'Coding Challenge',
            description: msg.questionDescription ?? '',
            preferredLanguage: msg.preferredLanguage ?? 'Any',
          });
          break;

        case 'session_ended':
          setStatus('ended');
          setIsRecording(false);
          setActiveCodingQuestion(null);
          stopRecording();
          break;

        case 'error':
          setError(msg.message ?? 'An unknown error occurred.');
          setStatus('error');
          setIsRecording(false);
          stopRecording();
          break;
      }
    },
    [startRecording, stopRecording, playChunk, clearQueue, addMessage, sendWsMessage]
  );

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
      setStatus('connecting');

      // Create session in DB (or reuse pipeline-provided session)
      if (config.pipelineSessionId) {
        // Pipeline flow already created a session — reuse it
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
          .then(json => {
            if (json.success && json.data) {
              setSessionId(json.data.id);
            }
          })
          .catch(() => {});
      }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        sendWsMessage({
          type: 'setup',
          domain: config.domain,
          personaId: config.personaId,
          customSystemPrompt: config.customSystemPrompt,
        });
      };

      ws.onmessage = (event) => {
        try {
          const msg: ServerMessage = JSON.parse(event.data);
          handleServerMessage(msg);
        } catch {
          console.error('Failed to parse server message:', event.data);
        }
      };

      ws.onclose = () => {
        if (status !== 'ended') {
          setStatus('idle');
          setIsRecording(false);
          stopRecording();
        }
      };

      ws.onerror = () => {
        setError('WebSocket connection failed. Is the backend running on port 8080?');
        setStatus('error');
        setIsRecording(false);
        stopRecording();
      };
    },
    [sendWsMessage, handleServerMessage, stopRecording, status]
  );

  const endInterview = useCallback(() => {
    sendWsMessage({ type: 'end' });
    stopRecording();
    setIsRecording(false);
    setStatus('ended');
    // Give the 'end' message time to flush before closing the socket
    const ws = wsRef.current;
    wsRef.current = null;
    setTimeout(() => {
      ws?.close();
    }, 200);
  }, [sendWsMessage, stopRecording]);

  const resetSession = useCallback(() => {
    destroy();
    setStatus('idle');
    setMessages([]);
    setError(null);
    setIsRecording(false);
    setSessionId(null);
    setActiveCodingQuestion(null);
  }, [destroy]);

  /**
   * Submit the candidate's code. Sends it to the backend which closes the
   * pending present_coding_question tool call so Gemini can evaluate it.
   */
  const submitCode = useCallback((code: string, language: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'code_submission',
        code,
        language,
      } satisfies BrowserMessage));
    }
    // Close the editor and resume voice capture (muted — PTT)
    setActiveCodingQuestion(null);
    setIsRecording(true);
    setIsMuted(true);
    startRecording((base64) => {
      sendWsMessage({ type: 'audio', data: base64 });
    }).then(() => {
      setProcessorMuted(true);
    }).catch(() => {});
  }, [sendWsMessage, startRecording, setProcessorMuted]);

  /**
   * Get the full transcript from current messages
   */
  const getTranscript = useCallback(() => {
    return messages.map(m => `[${m.role === 'user' ? 'You' : 'Interviewer'}]: ${m.text}`).join('\n');
  }, [messages]);

  /** Toggle mute state for push-to-talk */
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

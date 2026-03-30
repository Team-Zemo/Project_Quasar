// Shared TypeScript types for Interview AI

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export interface ServerMessage {
  type:
    | 'connected'
    | 'session_ready'
    | 'session_ended'
    | 'transcript_user'
    | 'transcript_model'
    | 'audio'
    | 'interrupted'
    | 'error';
  text?: string;
  data?: string;
  message?: string;
}

export interface BrowserMessage {
  type: 'setup' | 'audio' | 'interrupt' | 'end';
  domain?: string;
  data?: string;
  personaId?: string;
  customSystemPrompt?: string;
}

export type SessionStatus =
  | 'idle'
  | 'connecting'
  | 'ready'
  | 'active'
  | 'ended'
  | 'error';

export interface EmotionSnapshot {
  t: number;
  confidence: number;
  nervousness: number;
  eyeContact: boolean;
}

export interface FillerBucket {
  t: number;
  count: number;
  words?: string[];
}

export interface SessionConfig {
  domain: string;
  personaId?: string;
  jdSessionId?: string;
  customSystemPrompt?: string;
}

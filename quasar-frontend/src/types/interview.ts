// Shared TypeScript types for Interview AI

export interface CodingQuestion {
  title: string;
  description: string;
  preferredLanguage: string;
}

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
    | 'interview_ended_by_ai'
    | 'coding_question'
    | 'transcript_user'
    | 'transcript_model'
    | 'audio'
    | 'interrupted'
    | 'error';
  text?: string;
  data?: string;
  message?: string;
  closingRemark?: string;
  // coding_question fields
  questionTitle?: string;
  questionDescription?: string;
  preferredLanguage?: string;
}

export interface BrowserMessage {
  type: 'setup' | 'audio' | 'interrupt' | 'end' | 'code_submission';
  domain?: string;
  data?: string;
  personaId?: string;
  customSystemPrompt?: string;
  // code_submission fields
  code?: string;
  language?: string;
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

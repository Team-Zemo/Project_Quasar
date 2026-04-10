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

export interface HeadPose {
  pitch: number; // degrees, positive = tilt down
  yaw:   number; // degrees, positive = turn right
  roll:  number; // degrees, positive = tilt right
}

/** Microanalysis frame captured every ~200ms during an interview session */
export interface EmotionSnapshot {
  t: number;          // elapsed seconds since session start

  // ── Core (v1, always present) ──────────────────────────────────
  confidence:  number;  // 0–100
  nervousness: number;  // 0–100
  eyeContact:  boolean;

  // ── Microanalysis (v2, present when MediaPipe is available) ────
  faceDetected?:   boolean;
  attentionScore?: number;  // 0–100  (head-pose centering)
  stressScore?:    number;  // 0–100  (brow furrow + frown signals)
  smileScore?:     number;  // 0–100  (ARKit mouthSmile blendshapes)
  blinkRate?:      number;  // blinks per minute (rolling 60-s window)
  headPose?:       HeadPose;
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
  /** If provided, the hook will reuse this session ID instead of creating a new one via POST /api/sessions */
  pipelineSessionId?: string;
}

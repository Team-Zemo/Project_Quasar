/**
 * EmotionAnalyzer — v2  (main-thread MediaPipe implementation)
 *
 * Replaces face-api.js (3 CDN models, main thread) with:
 *   • @mediapipe/tasks-vision FaceLandmarker (npm, single model)
 *   • 52 ARKit blendshapes  →  8 micro-metrics
 *   • Head-pose transformation matrix (pitch / yaw / roll)
 *   • GPU (WebGL2) delegate, CPU fallback
 *   • Time-gated rAF loop (5 fps analysis, ~5 ms/frame GPU)
 *
 * Note on threading: MediaPipe WASM SIMD + GPU delegate is fast enough
 * (~3–8 ms per frame at 5 fps = <4% frame budget) that running on the
 * main thread is practical and avoids Vite module-worker bundling issues.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';
import type { EmotionSnapshot } from '../types/interview';

// ─── CDN (pinned to installed version) ───────────────────────────────
const WASM_PATH =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ─── Tuning constants ─────────────────────────────────────────────────
const ANALYSIS_FPS   = 5;               // frames sent to landmarker per second
const FRAME_INTERVAL = 1000 / ANALYSIS_FPS;
const SNAPSHOT_EVERY = 2;              // emit onSnapshot every N frames (~400 ms)
const BLINK_THRESH   = 0.35;
const BLINK_WINDOW   = 60_000;         // ms for blink-rate window
const NERV_WINDOW    = 20;             // rolling buffer size (~4 s at 5 fps)

// ─── Props ────────────────────────────────────────────────────────────
interface Props {
  isActive: boolean;
  onSnapshot: (s: EmotionSnapshot) => void;
  /**
   * Fires every time the detected face count changes.
   * 0 = no face, 1 = ok, 2+ = multiple faces (potential violation).
   */
  onFaceCountChange?: (count: number) => void;
}

// ─── Pure helpers ─────────────────────────────────────────────────────

/** Get a single blendshape score by ARKit name */
function bs(
  cats: ReadonlyArray<{ categoryName: string; score: number }>,
  name: string,
): number {
  return cats.find(c => c.categoryName === name)?.score ?? 0;
}

/**
 * Extract pitch / yaw / roll (degrees) from a column-major 4×4 matrix.
 * Near identity (0,0,0) = face looking straight at camera.
 */
function headPoseFromMatrix(m: number[] | Float32Array) {
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const D = 180 / Math.PI;
  if (sy > 1e-6) {
    return {
      pitch: Math.atan2(-r20, sy)   * D,
      yaw:   Math.atan2(r10, r00)   * D,
      roll:  Math.atan2(r21, r22)   * D,
    };
  }
  return { pitch: Math.atan2(-r20, sy) * D, yaw: 0, roll: 0 };
}

function levelOf(v: number): 'low' | 'medium' | 'high' {
  return v < 30 ? 'low' : v < 65 ? 'medium' : 'high';
}

// Consecutive frames with ≥2 faces needed before firing onFaceCountChange(2)
// At 5 fps this is 1.0 s — avoids false triggers from momentary occlusions
const MULTI_FACE_CONFIRM_FRAMES = 5;

// ─── Sub-components ───────────────────────────────────────────────────

const LEVEL_STYLE = {
  low:    { text: '#22c55e', bg: 'rgba(34,197,94,0.14)',  border: 'rgba(34,197,94,0.3)' },
  medium: { text: '#f97316', bg: 'rgba(249,115,22,0.14)', border: 'rgba(249,115,22,0.3)' },
  high:   { text: '#ef4444', bg: 'rgba(239,68,68,0.14)',  border: 'rgba(239,68,68,0.3)' },
};

function LevelPill({ label, level }: { label: string; level: 'low' | 'medium' | 'high' }) {
  const s = LEVEL_STYLE[level];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </span>
      <span style={{ fontSize: 9, fontWeight: 800, color: s.text, background: s.bg, border: `1px solid ${s.border}`, padding: '2px 7px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {level}
      </span>
    </div>
  );
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
      <div style={{ height: '100%', borderRadius: 99, width: `${value}%`, background: color, transition: 'width 0.4s ease' }} />
    </div>
  );
}

function HeadPoseCompass({ pitch, yaw }: { pitch: number; yaw: number }) {
  const R = 14;               // px from centre
  const RANGE = 40;           // degrees = full radius
  const dx =  Math.max(-R, Math.min(R, (yaw   / RANGE) * R));
  const dy =  Math.max(-R, Math.min(R, (pitch / RANGE) * R));
  const on = Math.abs(yaw) < 8 && Math.abs(pitch) < 8;
  return (
    <div title={`Yaw ${yaw.toFixed(0)}°  Pitch ${pitch.toFixed(0)}°`}
      style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: `1px solid ${on ? 'rgba(34,197,94,0.5)' : 'rgba(255,255,255,0.12)'}`, flexShrink: 0 }}>
      {/* crosshair */}
      <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.14)', transform: 'translateY(-50%)' }} />
      <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.14)', transform: 'translateX(-50%)' }} />
      {/* gaze dot */}
      <div style={{ position: 'absolute', top: `calc(50% + ${dy}px)`, left: `calc(50% + ${dx}px)`, transform: 'translate(-50%,-50%)', width: 7, height: 7, borderRadius: '50%', background: on ? '#22c55e' : '#f97316', boxShadow: on ? '0 0 6px rgba(34,197,94,0.8)' : '0 0 6px rgba(249,115,22,0.8)', transition: 'all 0.15s ease' }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────
export function EmotionAnalyzer({ isActive, onSnapshot, onFaceCountChange }: Props) {
  const videoRef        = useRef<HTMLVideoElement>(null);
  const streamRef       = useRef<MediaStream | null>(null);
  const landmarkerRef   = useRef<FaceLandmarker | null>(null);
  const rafRef          = useRef<number>(0);
  const lastFrameRef    = useRef<number>(0);
  const frameCountRef   = useRef<number>(0);
  const sessionStartRef = useRef<number>(0);

  // Blink tracking (persistent across frames, no re-render)
  const prevBlinkLRef    = useRef(false);
  const prevBlinkRRef    = useRef(false);
  const blinkTimesRef    = useRef<number[]>([]);

  // Nervousness rolling buffer
  const nervBufRef       = useRef<number[]>([]);

  // Multi-face detection tracking
  const multiFaceCountRef    = useRef(0);   // consecutive multi-face frames
  const lastReportedFaceCount = useRef(-1); // last count fired to onFaceCountChange
  const onFaceCountChangeRef  = useRef(onFaceCountChange);
  useEffect(() => { onFaceCountChangeRef.current = onFaceCountChange; }, [onFaceCountChange]);

  const [status, setStatus]       = useState<'loading' | 'ready' | 'error'>('loading');
  const [streamOn, setStreamOn]   = useState(false);
  const [delegate, setDelegate]   = useState<'GPU' | 'CPU'>('GPU');
  const [snap, setSnap]           = useState<EmotionSnapshot | null>(null);
  const [faceCount, setFaceCount] = useState(0); // 0/1/2+

  // ── Stable snapshot ref to avoid rAF closure capturing stale function
  const onSnapshotRef = useRef(onSnapshot);
  useEffect(() => { onSnapshotRef.current = onSnapshot; }, [onSnapshot]);

  // ── MediaPipe init ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
        const opts = {
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
          runningMode: 'VIDEO' as const,
          numFaces: 2, // 2 so we can detect the multiple-faces violation
        };

        // 1st: GPU
        let fl: FaceLandmarker | null = null;
        try {
          fl = await FaceLandmarker.createFromOptions(vision, {
            ...opts,
            baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' },
          });
        } catch {
          if (cancelled) return;
          setDelegate('CPU');
          fl = await FaceLandmarker.createFromOptions(vision, {
            ...opts,
            baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'CPU' },
          });
        }

        if (cancelled) { fl.close(); return; }
        landmarkerRef.current = fl;
        setStatus('ready');
      } catch (err) {
        console.error('[EmotionAnalyzer] Model failed to load:', err);
        if (!cancelled) setStatus('error');
      }
    };

    init();
    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  // ── Camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive) return;
    let alive = true;

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' }, audio: false })
      .then(stream => {
        if (!alive) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamOn(true);
          sessionStartRef.current = performance.now();
          frameCountRef.current   = 0;
        }
      })
      .catch(err => console.error('[EmotionAnalyzer] Camera denied:', err));

    return () => {
      alive = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      setStreamOn(false);
    };
  }, [isActive]);

  // ── Detection loop ─────────────────────────────────────────────────
  const processFrame = useCallback((result: FaceLandmarkerResult, nowMs: number) => {
    const t = Math.round((nowMs - sessionStartRef.current) / 1000);

    // ── Face count & multi-face detection ───────────────────────────
    const detectedFaces = result.faceBlendshapes?.length ?? 0;
    setFaceCount(detectedFaces);

    if (detectedFaces >= 2) {
      // Require MULTI_FACE_CONFIRM_FRAMES consecutive frames before firing
      multiFaceCountRef.current++;
      if (
        multiFaceCountRef.current >= MULTI_FACE_CONFIRM_FRAMES &&
        lastReportedFaceCount.current !== 2
      ) {
        lastReportedFaceCount.current = 2;
        onFaceCountChangeRef.current?.(2);
      }
    } else {
      multiFaceCountRef.current = 0;
      if (lastReportedFaceCount.current !== detectedFaces) {
        lastReportedFaceCount.current = detectedFaces;
        onFaceCountChangeRef.current?.(detectedFaces);
      }
    }

    if (!result.faceBlendshapes?.length) {
      const empty: EmotionSnapshot = { t, confidence: 0, nervousness: 0, eyeContact: false, faceDetected: false, attentionScore: 0, stressScore: 0, smileScore: 0, blinkRate: 0, headPose: { pitch: 0, yaw: 0, roll: 0 } };
      setSnap(empty);
      return empty;
    }

    const cats = result.faceBlendshapes[0].categories;

    // Blendshapes
    const eyeBlinkL   = bs(cats, 'eyeBlinkLeft');
    const eyeBlinkR   = bs(cats, 'eyeBlinkRight');
    const mouthSmileL = bs(cats, 'mouthSmileLeft');
    const mouthSmileR = bs(cats, 'mouthSmileRight');
    const browInnerUp = bs(cats, 'browInnerUp');
    const browDownL   = bs(cats, 'browDownLeft');
    const browDownR   = bs(cats, 'browDownRight');
    const jawOpen     = bs(cats, 'jawOpen');
    const eyeLookOutL = bs(cats, 'eyeLookOutLeft');
    const eyeLookOutR = bs(cats, 'eyeLookOutRight');
    const eyeLookUpL  = bs(cats, 'eyeLookUpLeft');
    const eyeLookDownL= bs(cats, 'eyeLookDownLeft');
    const noseSneerL  = bs(cats, 'noseSneerLeft');
    const noseSneerR  = bs(cats, 'noseSneerRight');
    const mouthFrownL = bs(cats, 'mouthFrownLeft');
    const mouthFrownR = bs(cats, 'mouthFrownRight');
    const cheekPuff   = bs(cats, 'cheekPuff');

    // Head pose
    let headPose = { pitch: 0, yaw: 0, roll: 0 };
    if (result.facialTransformationMatrixes?.length) {
      headPose = headPoseFromMatrix(result.facialTransformationMatrixes[0].data);
    }

    // Blink rate
    const blinkL = eyeBlinkL > BLINK_THRESH;
    const blinkR = eyeBlinkR > BLINK_THRESH;
    if ((!prevBlinkLRef.current && blinkL) || (!prevBlinkRRef.current && blinkR)) {
      blinkTimesRef.current.push(nowMs);
    }
    prevBlinkLRef.current = blinkL;
    prevBlinkRRef.current = blinkR;
    const cutoff = nowMs - BLINK_WINDOW;
    while (blinkTimesRef.current.length && blinkTimesRef.current[0] < cutoff) {
      blinkTimesRef.current.shift();
    }
    const elapsed  = Math.min(nowMs - sessionStartRef.current, BLINK_WINDOW);
    const blinkRate = elapsed > 3000
      ? Math.round((blinkTimesRef.current.length / elapsed) * 60_000)
      : 0;

    // Smile
    const smileScore = Math.round(((mouthSmileL + mouthSmileR) / 2) * 100);

    // Eye contact
    const gazeDev  = (eyeLookOutL + eyeLookOutR + eyeLookUpL + eyeLookDownL) / 4;
    const facing   = Math.abs(headPose.yaw) < 20 && Math.abs(headPose.pitch) < 20;
    const eyeContact = facing && gazeDev < 0.28;

    // Attention
    const attentionScore = Math.round(
      Math.max(0, 100 - Math.min(55, Math.abs(headPose.yaw) * 1.6) - Math.min(35, Math.abs(headPose.pitch) * 1.4))
    );

    // Stress
    const stressScore = Math.round(
      Math.min(100, (browInnerUp * 0.25 + (browDownL + browDownR) * 0.20 + (noseSneerL + noseSneerR) * 0.20 + (mouthFrownL + mouthFrownR) * 0.20 + cheekPuff * 0.15) * 120)
    );

    // Nervousness (rolling variance)
    const nervBuf = nervBufRef.current;
    nervBuf.push(jawOpen * 0.6 + browInnerUp * 0.4);
    if (nervBuf.length > NERV_WINDOW) nervBuf.shift();
    let nervousness = 0;
    if (nervBuf.length >= 4) {
      const mean = nervBuf.reduce((a, b) => a + b, 0) / nervBuf.length;
      const variance = nervBuf.reduce((s, v) => s + (v - mean) ** 2, 0) / nervBuf.length;
      nervousness = Math.round(Math.min(100, Math.sqrt(variance) * 320));
    }

    // Confidence
    const confidence = Math.round(
      Math.min(100, smileScore * 0.30 + attentionScore * 0.35 + (100 - stressScore) * 0.20 + (eyeContact ? 15 : 0))
    );

    const snapshot: EmotionSnapshot = {
      t, faceDetected: true,
      confidence, nervousness, eyeContact,
      attentionScore, stressScore, smileScore, blinkRate, headPose,
    };
    setSnap(snapshot);
    return snapshot;
  }, []);

  // ── rAF loop ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isActive || !streamOn || status !== 'ready') return;

    const loop = (now: DOMHighResTimeStamp) => {
      rafRef.current = requestAnimationFrame(loop);
      if (now - lastFrameRef.current < FRAME_INTERVAL) return;
      lastFrameRef.current = now;

      const video = videoRef.current;
      const fl    = landmarkerRef.current;
      if (!video || video.readyState < 2 || !fl) return;

      try {
        const result = fl.detectForVideo(video, performance.now());
        const s = processFrame(result, performance.now());
        frameCountRef.current++;
        if (frameCountRef.current % SNAPSHOT_EVERY === 0 && s) {
          onSnapshotRef.current(s);
        }
      } catch (err) {
        console.warn('[EmotionAnalyzer] Detection error:', err);
      }
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isActive, streamOn, status, processFrame]);

  if (!isActive) return null;

  // ── Derived display values ─────────────────────────────────────────
  const m          = snap;
  const confidence  = m?.confidence    ?? 0;
  const attention   = m?.attentionScore ?? 0;
  const stress      = m?.stressScore   ?? 0;
  const nervousness = m?.nervousness   ?? 0;
  const smile       = m?.smileScore    ?? 0;
  const blinkRate   = m?.blinkRate     ?? 0;
  const eyeContact  = m?.eyeContact    ?? false;
  const pose        = m?.headPose      ?? { pitch: 0, yaw: 0, roll: 0 };
  const faceOk      = m?.faceDetected  ?? false;
  const analyzing   = status === 'ready' && streamOn;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8, userSelect: 'none' }}>

      {/* ── Video card ──────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', width: '100%', aspectRatio: '4/3',
        background: '#000', borderRadius: 16, overflow: 'hidden',
        border: `2px solid ${eyeContact ? 'rgba(34,197,94,0.45)' : 'rgba(255,255,255,0.06)'}`,
        transition: 'border-color 0.5s ease',
        boxShadow: eyeContact ? '0 0 18px rgba(34,197,94,0.12) inset' : 'none',
      }}>

        <video ref={videoRef} autoPlay muted playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
        />

        {/* Loading overlay */}
        {(!streamOn || status === 'loading') && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.72)', gap: 12, zIndex: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', border: '3px solid rgba(249,115,22,0.25)', borderTopColor: '#f97316', animation: 'ea-spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              {!streamOn ? 'Waiting for camera…' : 'Loading model…'}
            </span>
          </div>
        )}

        {/* Error overlay */}
        {status === 'error' && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', zIndex: 8 }}>
            <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 700 }}>⚠ Model failed to load</span>
          </div>
        )}

        {/* Confidence bar — top edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: 'rgba(255,255,255,0.07)', zIndex: 4 }}>
          <div style={{ height: '100%', width: `${confidence}%`, background: 'linear-gradient(90deg,#f97316,#fb923c)', transition: 'width 0.4s ease' }} />
        </div>

        {/* Status badge — top-left */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)', padding: '4px 10px', borderRadius: 99, border: '1px solid rgba(255,255,255,0.09)', zIndex: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: analyzing && faceOk ? '#ef4444' : '#6b7280', boxShadow: analyzing && faceOk ? '0 0 6px rgba(239,68,68,0.8)' : 'none', animation: analyzing && faceOk ? 'ea-pulse 1.5s ease-in-out infinite' : 'none' }} />
          <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {analyzing ? (faceOk ? 'LIVE' : 'NO FACE') : 'LOADING'}
          </span>
          {analyzing && (
            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.35)', marginLeft: 2 }}>{delegate}</span>
          )}
        </div>

        {/* Head-pose compass — top-right */}
        {analyzing && (
          <div style={{ position: 'absolute', top: 10, right: 10, zIndex: 5 }}>
            <HeadPoseCompass pitch={pose.pitch} yaw={pose.yaw} />
          </div>
        )}

        {/* ⚠ Multi-face violation warning — centre-top */}
        {analyzing && faceCount >= 2 && (
          <div style={{
            position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)',
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'rgba(239,68,68,0.92)', backdropFilter: 'blur(8px)',
            padding: '4px 10px', borderRadius: 99,
            border: '1px solid rgba(239,68,68,0.6)',
            boxShadow: '0 0 14px rgba(239,68,68,0.5)',
            animation: 'ea-pulse 1s ease-in-out infinite',
            zIndex: 7, whiteSpace: 'nowrap',
          }}>
            <span style={{ fontSize: 11 }}>⚠</span>
            <span style={{ fontSize: 9, fontWeight: 800, color: '#fff', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              MULTIPLE FACES DETECTED
            </span>
          </div>
        )}

        {/* Bottom overlay — 4 core metrics */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top,rgba(0,0,0,0.88) 0%,rgba(0,0,0,0.55) 60%,transparent 100%)', padding: '22px 12px 10px', zIndex: 5 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4 }}>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Confidence</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#f97316', filter: 'drop-shadow(0 0 5px rgba(249,115,22,0.55))' }}>{confidence}%</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Attention</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#3b82f6', filter: 'drop-shadow(0 0 5px rgba(59,130,246,0.55))' }}>{attention}%</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Eye Contact</span>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: eyeContact ? '#22c55e' : 'rgba(255,255,255,0.15)', boxShadow: eyeContact ? '0 0 10px rgba(34,197,94,0.7)' : 'none', transition: 'all 0.3s ease', marginTop: 3 }} />
            </div>

            <LevelPill label="Stress" level={levelOf(stress)} />
          </div>
        </div>
      </div>

      {/* ── Micro-analysis strip ─────────────────────────────────────── */}
      {analyzing && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '8px 12px', gap: 8 }}>
          <LevelPill label="Nerv." level={levelOf(nervousness)} />
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)' }} />
          {/* Smile */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Smile</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#fbbf24' }}>{smile}%</span>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)' }} />
          {/* Blink rate */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Blinks</span>
            <span style={{ fontSize: 13, fontWeight: 900, color: '#a78bfa' }}>{blinkRate}/min</span>
          </div>
          <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.07)' }} />
          {/* Head pose */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Head Pose</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.5)', fontVariantNumeric: 'tabular-nums' }}>
              P{pose.pitch >= 0 ? '+' : ''}{pose.pitch.toFixed(0)}°&nbsp;
              Y{pose.yaw   >= 0 ? '+' : ''}{pose.yaw.toFixed(0)}°&nbsp;
              R{pose.roll  >= 0 ? '+' : ''}{pose.roll.toFixed(0)}°
            </span>
          </div>
        </div>
      )}

      {/* ── Score progress bars ──────────────────────────────────────── */}
      {analyzing && faceOk && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '0 2px' }}>
          {[
            { label: 'Conf.',  value: confidence,  color: 'linear-gradient(90deg,#f97316,#fb923c)' },
            { label: 'Attn.',  value: attention,   color: 'linear-gradient(90deg,#3b82f6,#60a5fa)' },
            { label: 'Stress', value: stress,      color: 'linear-gradient(90deg,#ef4444,#f87171)' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', width: 40, textAlign: 'right', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
              <ScoreBar value={value} color={color} />
              <span style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.5)', width: 28, textAlign: 'right' }}>{value}%</span>
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes ea-spin  { to { transform: rotate(360deg); } }
        @keyframes ea-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.55;transform:scale(1.3)} }
      `}</style>
    </div>
  );
}

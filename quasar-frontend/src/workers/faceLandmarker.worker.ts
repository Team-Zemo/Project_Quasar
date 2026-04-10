/// <reference lib="webworker" />
/**
 * faceLandmarker.worker.ts
 *
 * MediaPipe FaceLandmarker running inside a Web Worker.
 *
 * Pipeline:
 *   Main thread ──ImageBitmap (transferable)──▶ Worker
 *                                               │
 *              FaceLandmarker.detectForVideo()  │
 *                 52 ARKit blendshapes           │
 *                 Head-pose 4×4 matrix           │
 *                 Derived micro-metrics          │
 *   Main thread ◀──────── MicroMetrics ──────────┘
 *
 * GPU delegate (WebGL2) is attempted first; falls back to CPU (WASM) if
 * the browser does not expose WebGL in this worker context.
 */

import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

// ─── CDN Paths (pinned to installed version 0.10.34) ────────────────
const WASM_PATH  = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm';
const MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// ─── Singleton landmarker instance ──────────────────────────────────
let landmarker: FaceLandmarker | null = null;

// ─── Blink-rate tracking ─────────────────────────────────────────────
const BLINK_THRESHOLD     = 0.35; // blendshape score to count as blink
const BLINK_WINDOW_MS     = 60_000;
let   prevBlinkL          = false;
let   prevBlinkR          = false;
const blinkTimestamps: number[] = [];

// ─── Nervousness rolling buffer ──────────────────────────────────────
const NERV_WINDOW = 20; // ~4 seconds at 200 ms
const nervBuffer: number[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────

/** Extract a blendshape value by ARKit category name */
function bs(
  categories: ReadonlyArray<{ categoryName: string; score: number }>,
  name: string,
): number {
  return categories.find(c => c.categoryName === name)?.score ?? 0;
}

/**
 * Extract pitch / yaw / roll (degrees) from a column-major 4×4 matrix.
 *
 * MediaPipe's facialTransformationMatrixes gives a *model-to-world* matrix
 * (face canonical → camera space).  Near identity = facing straight ahead.
 *
 *   Layout (column-major):
 *   [ m0  m4  m8  m12 ]
 *   [ m1  m5  m9  m13 ]
 *   [ m2  m6  m10 m14 ]
 *   [ m3  m7  m11 m15 ]
 *
 * We decompose using ZYX Euler convention valid for ±90° pitch.
 */
function extractHeadPose(m: number[] | Float32Array): { pitch: number; yaw: number; roll: number } {
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  const DEG = 180 / Math.PI;

  const sy = Math.sqrt(r00 * r00 + r10 * r10);
  const singular = sy < 1e-6;

  let pitch: number, yaw: number, roll: number;
  if (!singular) {
    pitch = Math.atan2(-r20, sy) * DEG;
    yaw   = Math.atan2(r10, r00) * DEG;
    roll  = Math.atan2(r21, r22) * DEG;
  } else {
    // Gimbal-lock fallback (rare in normal face tracking)
    pitch = Math.atan2(-r20, sy) * DEG;
    yaw   = 0;
    roll  = 0;
  }
  return { pitch, yaw, roll };
}

/** Compute all micro-analysis metrics from a single FaceLandmarker result */
function processResult(
  result: FaceLandmarkerResult,
  nowMs: number,
  sessionStartMs: number,
): {
  t: number;
  faceDetected: boolean;
  confidence: number;
  nervousness: number;
  eyeContact: boolean;
  attentionScore: number;
  stressScore: number;
  smileScore: number;
  blinkRate: number;
  headPose: { pitch: number; yaw: number; roll: number };
} {
  const t = Math.round((nowMs - sessionStartMs) / 1000);

  // ── No face → zeroed-out snapshot ─────────────────────────────────
  if (!result.faceBlendshapes?.length) {
    return {
      t,
      faceDetected:  false,
      confidence:    0,
      nervousness:   0,
      eyeContact:    false,
      attentionScore: 0,
      stressScore:   0,
      smileScore:    0,
      blinkRate:     0,
      headPose:      { pitch: 0, yaw: 0, roll: 0 },
    };
  }

  const cats = result.faceBlendshapes[0].categories;

  // ── ARKit blendshapes ──────────────────────────────────────────────
  const eyeBlinkL      = bs(cats, 'eyeBlinkLeft');
  const eyeBlinkR      = bs(cats, 'eyeBlinkRight');
  const mouthSmileL    = bs(cats, 'mouthSmileLeft');
  const mouthSmileR    = bs(cats, 'mouthSmileRight');
  const browInnerUp    = bs(cats, 'browInnerUp');
  const browDownL      = bs(cats, 'browDownLeft');
  const browDownR      = bs(cats, 'browDownRight');
  const jawOpen        = bs(cats, 'jawOpen');
  const eyeLookOutL    = bs(cats, 'eyeLookOutLeft');
  const eyeLookOutR    = bs(cats, 'eyeLookOutRight');
  const eyeLookUpL     = bs(cats, 'eyeLookUpLeft');
  const eyeLookDownL   = bs(cats, 'eyeLookDownLeft');
  const noseSneerL     = bs(cats, 'noseSneerLeft');
  const noseSneerR     = bs(cats, 'noseSneerRight');
  const mouthFrownL    = bs(cats, 'mouthFrownLeft');
  const mouthFrownR    = bs(cats, 'mouthFrownRight');
  const cheekPuff      = bs(cats, 'cheekPuff');

  // ── Head pose ──────────────────────────────────────────────────────
  let headPose = { pitch: 0, yaw: 0, roll: 0 };
  if (result.facialTransformationMatrixes?.length) {
    headPose = extractHeadPose(result.facialTransformationMatrixes[0].data);
  }

  // ── Blink detection & rate ─────────────────────────────────────────
  const blinkL = eyeBlinkL > BLINK_THRESHOLD;
  const blinkR = eyeBlinkR > BLINK_THRESHOLD;
  // Rising-edge detection (open→closed)
  if ((!prevBlinkL && blinkL) || (!prevBlinkR && blinkR)) {
    blinkTimestamps.push(nowMs);
  }
  prevBlinkL = blinkL;
  prevBlinkR = blinkR;

  // Evict blinks older than 1 minute
  const cutoff = nowMs - BLINK_WINDOW_MS;
  while (blinkTimestamps.length && blinkTimestamps[0] < cutoff) blinkTimestamps.shift();

  // Normalise to blinks/min based on actual elapsed time (avoid cold-start inflation)
  const elapsed = Math.min(nowMs - sessionStartMs, BLINK_WINDOW_MS);
  const blinkRate = elapsed > 3000
    ? Math.round((blinkTimestamps.length / elapsed) * 60_000)
    : 0;

  // ── Smile (0–100) ──────────────────────────────────────────────────
  const smileScore = Math.round(((mouthSmileL + mouthSmileR) / 2) * 100);

  // ── Gaze-based eye contact ─────────────────────────────────────────
  //  Using gaze blendshapes + head pose for a combined estimate.
  const gazeDeviation = (eyeLookOutL + eyeLookOutR + eyeLookUpL + eyeLookDownL) / 4;
  const headFacing    = Math.abs(headPose.yaw) < 20 && Math.abs(headPose.pitch) < 20;
  const eyeContact    = headFacing && gazeDeviation < 0.28;

  // ── Attention (0–100): head-pose centering ─────────────────────────
  const yawPenalty   = Math.min(55, Math.abs(headPose.yaw)   * 1.6);
  const pitchPenalty = Math.min(35, Math.abs(headPose.pitch) * 1.4);
  const attentionScore = Math.round(Math.max(0, 100 - yawPenalty - pitchPenalty));

  // ── Stress (0–100): brow furrow + nose sneer + frown ──────────────
  const stressRaw =
    browInnerUp * 0.25 +
    (browDownL + browDownR) * 0.20 +
    (noseSneerL + noseSneerR) * 0.20 +
    (mouthFrownL + mouthFrownR) * 0.20 +
    cheekPuff * 0.15;
  const stressScore = Math.round(Math.min(100, stressRaw * 120));

  // ── Nervousness: rolling variance of jaw + brow signal ────────────
  const nervSignal = jawOpen * 0.6 + browInnerUp * 0.4;
  nervBuffer.push(nervSignal);
  if (nervBuffer.length > NERV_WINDOW) nervBuffer.shift();

  let nervousness = 0;
  if (nervBuffer.length >= 4) {
    const mean     = nervBuffer.reduce((a, b) => a + b, 0) / nervBuffer.length;
    const variance = nervBuffer.reduce((s, v) => s + (v - mean) ** 2, 0) / nervBuffer.length;
    nervousness    = Math.round(Math.min(100, Math.sqrt(variance) * 320));
  }

  // ── Confidence: composite of smile + attention + calm brow + gaze ─
  const confidence = Math.round(
    Math.min(100,
      smileScore           * 0.30 +
      attentionScore       * 0.35 +
      (100 - stressScore)  * 0.20 +
      (eyeContact ? 15 : 0),
    ),
  );

  return {
    t,
    faceDetected:  true,
    confidence,
    nervousness,
    eyeContact,
    attentionScore,
    stressScore,
    smileScore,
    blinkRate,
    headPose,
  };
}

// ─── Landmarker factory (GPU → CPU fallback) ─────────────────────────
async function createLandmarker(): Promise<FaceLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);
  const base = {
    baseOptions:                       { modelAssetPath: MODEL_PATH },
    outputFaceBlendshapes:             true,
    outputFacialTransformationMatrixes: true,
    runningMode:                       'VIDEO' as const,
    numFaces:                          1,
  };
  // 1st attempt: GPU (WebGL2)
  try {
    return await FaceLandmarker.createFromOptions(vision, {
      ...base,
      baseOptions: { ...base.baseOptions, delegate: 'GPU' },
    });
  } catch {
    self.postMessage({ type: 'delegate', value: 'CPU' });
  }
  // 2nd attempt: CPU (WASM SIMD)
  return FaceLandmarker.createFromOptions(vision, {
    ...base,
    baseOptions: { ...base.baseOptions, delegate: 'CPU' },
  });
}

// ─── Session start timestamp (set on first frame) ────────────────────
let sessionStartMs = 0;

// ─── Message handler ─────────────────────────────────────────────────
self.addEventListener('message', async (e: MessageEvent) => {
  const { type, data } = e.data as {
    type: 'init' | 'frame' | 'destroy';
    data?: { imageBitmap: ImageBitmap; timestamp: number };
  };

  // ── Init ───────────────────────────────────────────────────────────
  if (type === 'init') {
    try {
      landmarker     = await createLandmarker();
      sessionStartMs = performance.now();
      self.postMessage({ type: 'ready' });
    } catch (err) {
      self.postMessage({ type: 'error', message: String(err) });
    }
    return;
  }

  // ── Frame ──────────────────────────────────────────────────────────
  if (type === 'frame') {
    if (!landmarker || !data) return;
    const { imageBitmap, timestamp } = data;
    try {
      const result  = landmarker.detectForVideo(imageBitmap, timestamp);
      imageBitmap.close(); // free GPU texture memory immediately
      const metrics = processResult(result, timestamp, sessionStartMs);
      (self as unknown as Worker).postMessage({ type: 'result', data: metrics });
    } catch {
      try { imageBitmap.close(); } catch { /* already closed */ }
    }
    return;
  }

  // ── Destroy ────────────────────────────────────────────────────────
  if (type === 'destroy') {
    landmarker?.close();
    landmarker = null;
  }
});

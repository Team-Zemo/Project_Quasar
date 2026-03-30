import { useEffect, useRef, useState } from 'react';

interface EmotionSnapshot {
  t: number;
  confidence: number;
  nervousness: number;
  eyeContact: boolean;
}

interface EmotionAnalyzerProps {
  isActive: boolean;
  onSnapshot: (snapshot: EmotionSnapshot) => void;
}

// Rolling buffer for nervousness calculation
const NERVOUSNESS_WINDOW = 10; // 5 seconds at 500ms intervals

export function EmotionAnalyzer({ isActive, onSnapshot }: EmotionAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const intervalRef = useRef<number | null>(null);
  const faceapiRef = useRef<any>(null);
  const nervousnessBuffer = useRef<number[]>([]);
  const sessionStartRef = useRef<number>(Date.now());
  const streamRef = useRef<MediaStream | null>(null);

  const [confidence, setConfidence] = useState(0);
  const [nervousness, setNervousness] = useState(0);
  const [eyeContact, setEyeContact] = useState(false);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [streamActive, setStreamActive] = useState(false);

  // Load face-api.js from CDN
  useEffect(() => {
    if ((window as any).faceapi) {
      faceapiRef.current = (window as any).faceapi;
      loadModels();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
    script.async = true;
    script.onload = () => {
      faceapiRef.current = (window as any).faceapi;
      loadModels();
    };
    document.head.appendChild(script);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const loadModels = async () => {
    const faceapi = faceapiRef.current;
    if (!faceapi) return;

    const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.12/model/';

    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (err) {
      console.error('Failed to load face-api models:', err);
    }
  };

  // Start webcam
  useEffect(() => {
    if (!isActive) return;

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamActive(true);
          sessionStartRef.current = Date.now();
        }
      } catch (err) {
        console.error('Camera access denied for emotion analysis:', err);
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      setStreamActive(false);
    };
  }, [isActive]);

  // Run detection every 500ms
  useEffect(() => {
    if (!isActive || !modelsLoaded || !streamActive) return;

    const faceapi = faceapiRef.current;
    if (!faceapi) return;

    const detect = async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceExpressions();

        if (!detection) {
          setEyeContact(false);
          return;
        }

        const expr = detection.expressions;

        // Confidence: weighted composite
        const confScore = Math.min(100, Math.max(0,
          ((expr.happy || 0) * 40 +
           (expr.neutral || 0) * 35 -
           (expr.fearful || 0) * 25 -
           (expr.surprised || 0) * 15 +
           50)
        ));

        // Nervousness: variance of negative expressions
        const negativeSignal = (expr.fearful || 0) + (expr.surprised || 0) + (expr.disgusted || 0);
        nervousnessBuffer.current.push(negativeSignal);
        if (nervousnessBuffer.current.length > NERVOUSNESS_WINDOW) {
          nervousnessBuffer.current.shift();
        }

        let nervScore = 0;
        if (nervousnessBuffer.current.length >= 3) {
          const mean = nervousnessBuffer.current.reduce((a, b) => a + b, 0) / nervousnessBuffer.current.length;
          const variance = nervousnessBuffer.current.reduce((sum, v) => sum + (v - mean) ** 2, 0) / nervousnessBuffer.current.length;
          nervScore = Math.min(100, Math.sqrt(variance) * 200);
        }

        // Eye contact: face detected + nose in center 60% of frame
        const landmarks = detection.landmarks;
        const nose = landmarks.getNose();
        const noseTip = nose[3];
        const frameWidth = video.videoWidth;
        const frameHeight = video.videoHeight;
        const centerX = frameWidth * 0.2;
        const centerXEnd = frameWidth * 0.8;
        const centerY = frameHeight * 0.2;
        const centerYEnd = frameHeight * 0.8;
        const hasEyeContact = noseTip.x >= centerX && noseTip.x <= centerXEnd &&
                              noseTip.y >= centerY && noseTip.y <= centerYEnd;

        setConfidence(Math.round(confScore));
        setNervousness(Math.round(nervScore));
        setEyeContact(hasEyeContact);

        const elapsedSeconds = Math.round((Date.now() - sessionStartRef.current) / 1000);

        onSnapshot({
          t: elapsedSeconds,
          confidence: Math.round(confScore),
          nervousness: Math.round(nervScore),
          eyeContact: hasEyeContact,
        });
      } catch (err) {
        // Silent fail for individual frames
      }
    };

    intervalRef.current = window.setInterval(detect, 500);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, modelsLoaded, streamActive, onSnapshot]);

  const getNervousnessLevel = (): 'low' | 'medium' | 'high' => {
    if (nervousness < 25) return 'low';
    if (nervousness < 60) return 'medium';
    return 'high';
  };

  if (!isActive) return null;

  return (
    <div className="emotion-analyzer">
      {/* Live webcam feed */}
      <div className="webcam-container">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="webcam-video"
        />

        {/* Overlay: eye contact ring */}
        <div className={`webcam-eye-ring ${eyeContact ? 'webcam-eye-ring--on' : 'webcam-eye-ring--off'}`} />

        {/* Overlay: status badge */}
        <div className="webcam-status-badge">
          <span className={`webcam-status-dot ${streamActive ? 'webcam-status-dot--live' : ''}`} />
          <span>{streamActive ? 'LIVE' : 'LOADING'}</span>
        </div>

        {/* Overlay: confidence bar */}
        <div className="webcam-confidence-bar">
          <div className="webcam-confidence-fill" style={{ width: `${confidence}%` }} />
        </div>

        {/* Overlay: bottom gauges */}
        <div className="webcam-gauges">
          <div className="webcam-gauge">
            <span className="webcam-gauge__label">Confidence</span>
            <span className="webcam-gauge__value">{confidence}%</span>
          </div>
          <div className="webcam-gauge">
            <span className="webcam-gauge__label">Nervous</span>
            <span className={`nervousness-pill nervousness-pill--${getNervousnessLevel()}`}>
              {getNervousnessLevel().toUpperCase()}
            </span>
          </div>
          <div className="webcam-gauge">
            <span className="webcam-gauge__label">Eye Contact</span>
            <div className={`eye-contact-dot ${eyeContact ? 'eye-contact-dot--on' : 'eye-contact-dot--off'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

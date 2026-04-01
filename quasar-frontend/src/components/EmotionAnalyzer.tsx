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
    <div className="flex flex-col w-full shrink-0">
      {/* Live webcam feed */}
      <div className="relative w-full aspect-video md:aspect-[4/3] bg-black rounded-2xl overflow-hidden shadow-lg border border-[var(--c-border)]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover scale-[1.05]"
        />

        {/* Overlay: eye contact ring */}
        <div className={`absolute inset-0 border-[3px] rounded-2xl transition-colors duration-500 pointer-events-none z-10 ${eyeContact ? 'border-green-500/50 shadow-[inset_0_0_20px_rgba(34,197,94,0.3)]' : 'border-transparent'}`} />

        {/* Overlay: status badge */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-2 z-20 shadow-sm border border-white/10">
          <span className={`w-2 h-2 rounded-full transition-colors ${streamActive ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-gray-500'}`} />
          <span className="text-[10px] font-bold text-white tracking-widest uppercase">{streamActive ? 'LIVE' : 'LOADING'}</span>
        </div>

        {/* Overlay: confidence bar */}
        <div className="absolute top-0 inset-x-0 h-1 bg-white/10 z-20">
          <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300" style={{ width: `${confidence}%` }} />
        </div>

        {/* Overlay: bottom gauges */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent pt-6 pb-3 px-3 flex justify-between items-end z-20 backdrop-blur-[2px]">
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest shadow-black drop-shadow-md">Confidence</span>
            <span className="text-[14px] font-black text-white shadow-black drop-shadow-md">{confidence}%</span>
          </div>
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest shadow-black drop-shadow-md">Nervous</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider ${
              getNervousnessLevel() === 'low' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              getNervousnessLevel() === 'medium' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
              'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {getNervousnessLevel().toUpperCase()}
            </span>
          </div>
          <div className="flex flex-col items-center gap-1.5 flex-1">
            <span className="text-[9px] font-bold text-white/70 uppercase tracking-widest shadow-black drop-shadow-md">Eye Contact</span>
            <div className={`w-3.5 h-3.5 rounded-full mt-0.5 transition-colors duration-300 ${eyeContact ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-white/20'}`} />
          </div>
        </div>
      </div>
    </div>
  );
}

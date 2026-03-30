import { useEffect, useRef, useState, useCallback } from 'react';

interface FillerBucket {
  t: number;
  count: number;
  words: string[];
}

interface FillerDetectorProps {
  isActive: boolean;
  onUpdate: (data: {
    totalFillers: number;
    fillerRate: number;
    transcript: string;
    fillerBuckets: FillerBucket[];
  }) => void;
}

const FILLERS = /\b(um+|uh+|like|you know|basically|literally|actually|so+|right\?|okay so|i mean)\b/gi;

export function FillerDetector({ isActive, onUpdate }: FillerDetectorProps) {
  const [totalFillers, setTotalFillers] = useState(0);
  const [fillerRate, setFillerRate] = useState(0);
  const [supported, setSupported] = useState(true);

  const recognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');
  const startTimeRef = useRef(Date.now());
  const fillerCountRef = useRef(0);
  const bucketsRef = useRef<FillerBucket[]>([]);
  const currentBucketRef = useRef<FillerBucket>({ t: 0, count: 0, words: [] });
  const bucketTimerRef = useRef<number | null>(null);

  const countFillers = useCallback((text: string): { count: number; words: string[] } => {
    const matches = text.match(FILLERS) || [];
    return { count: matches.length, words: matches.map(m => m.toLowerCase()) };
  }, []);

  useEffect(() => {
    if (!isActive) return;

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognitionRef.current = recognition;

    startTimeRef.current = Date.now();
    fillerCountRef.current = 0;
    bucketsRef.current = [];
    currentBucketRef.current = { t: 0, count: 0, words: [] };

    recognition.onresult = (event: any) => {
      let fullTranscript = '';
      for (let i = 0; i < event.results.length; i++) {
        fullTranscript += event.results[i][0].transcript;
      }

      transcriptRef.current = fullTranscript;

      // Count total fillers
      const { count, words } = countFillers(fullTranscript);
      fillerCountRef.current = count;
      setTotalFillers(count);

      // Calculate rate per minute
      const elapsedMinutes = (Date.now() - startTimeRef.current) / 60000;
      const rate = elapsedMinutes > 0 ? parseFloat((count / elapsedMinutes).toFixed(1)) : 0;
      setFillerRate(rate);

      // Update current bucket
      const elapsedSeconds = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const bucketIndex = Math.floor(elapsedSeconds / 10);
      const bucketStartTime = bucketIndex * 10;

      if (currentBucketRef.current.t !== bucketStartTime) {
        // Finalize previous bucket
        if (currentBucketRef.current.count > 0 || bucketsRef.current.length > 0) {
          bucketsRef.current.push({ ...currentBucketRef.current });
        }
        currentBucketRef.current = { t: bucketStartTime, count: 0, words: [] };
      }

      // Filler words in the latest result only
      if (event.results.length > 0) {
        const latestResult = event.results[event.results.length - 1];
        if (latestResult.isFinal) {
          const { count: latestCount, words: latestWords } = countFillers(latestResult[0].transcript);
          currentBucketRef.current.count += latestCount;
          currentBucketRef.current.words.push(...latestWords);
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.error('Speech recognition error:', event.error);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still active
      if (isActive && recognitionRef.current) {
        try {
          recognition.start();
        } catch (e) {
          // Already started
        }
      }
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition:', e);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
        recognitionRef.current = null;
      }
    };
  }, [isActive, countFillers]);

  // Periodically emit data
  useEffect(() => {
    if (!isActive) return;

    const timer = window.setInterval(() => {
      // Finalize current bucket
      const allBuckets = [...bucketsRef.current];
      if (currentBucketRef.current.count > 0) {
        allBuckets.push({ ...currentBucketRef.current });
      }

      onUpdate({
        totalFillers: fillerCountRef.current,
        fillerRate: parseFloat(((Date.now() - startTimeRef.current) / 60000 > 0
          ? fillerCountRef.current / ((Date.now() - startTimeRef.current) / 60000)
          : 0).toFixed(1)),
        transcript: transcriptRef.current,
        fillerBuckets: allBuckets,
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isActive, onUpdate]);

  if (!isActive) return null;

  if (!supported) {
    return (
      <div className="filler-detector filler-detector--unsupported">
        <span className="filler-detector__icon">🎤</span>
        <span>Speech detection not supported in this browser</span>
      </div>
    );
  }

  return (
    <div className="filler-detector">
      <div className="filler-counter">
        <span className="filler-counter__icon">🎯</span>
        <span className="filler-counter__text">
          Fillers: <strong>{totalFillers}</strong>
          {fillerRate > 0 && <span className="filler-counter__rate"> ({fillerRate}/min)</span>}
        </span>
      </div>
    </div>
  );
}

import { useRef, useCallback } from 'react';
import { AudioProcessor } from '../lib/audio-utils';

/**
 * React hook that encapsulates the AudioProcessor lifecycle.
 * Provides stable callbacks for recording and playback.
 */
export function useAudioProcessor() {
  const processorRef = useRef<AudioProcessor | null>(null);

  const getOrCreate = useCallback((): AudioProcessor => {
    if (!processorRef.current) {
      processorRef.current = new AudioProcessor(16000);
    }
    return processorRef.current;
  }, []);

  const startRecording = useCallback(
    async (onAudioData: (base64: string) => void): Promise<void> => {
      const processor = getOrCreate();
      await processor.startRecording(onAudioData);
    },
    [getOrCreate]
  );

  const stopRecording = useCallback((): void => {
    processorRef.current?.stopRecording();
  }, []);

  const playChunk = useCallback((base64: string): void => {
    processorRef.current?.playAudioChunk(base64);
  }, []);

  const clearQueue = useCallback((): void => {
    processorRef.current?.clearPlaybackQueue();
  }, []);

  const destroy = useCallback((): void => {
    processorRef.current?.stopRecording();
    processorRef.current?.stopPlayback();
    processorRef.current = null;
  }, []);

  return { startRecording, stopRecording, playChunk, clearQueue, destroy };
}

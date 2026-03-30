/**
 * Audio utility for handling PCM audio for Gemini Live API.
 * Ported from the interview-ai prototype — adapted for backend proxy architecture.
 */

export class AudioProcessor {
  private audioContext: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private nextStartTime = 0;
  private playbackContext: AudioContext | null = null;
  private activeSources: AudioBufferSourceNode[] = [];

  private readonly sampleRate: number;

  constructor(sampleRate: number = 16000) {
    this.sampleRate = sampleRate;
  }

  async startRecording(onAudioData: (base64Data: string) => void): Promise<void> {
    this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    this.source = this.audioContext.createMediaStreamSource(this.stream);
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      const pcmData = this.floatTo16BitPCM(inputData);
      const base64Data = this.arrayBufferToBase64(pcmData.buffer);
      onAudioData(base64Data);
    };
  }

  stopRecording(): void {
    this.processor?.disconnect();
    this.processor = null;
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioContext?.close();
    this.audioContext = null;
  }

  playAudioChunk(base64Data: string): void {
    if (!this.playbackContext) {
      // Gemini outputs 24kHz PCM
      this.playbackContext = new AudioContext({ sampleRate: 24000 });
      this.nextStartTime = 0;
    }

    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const pcmData = new Int16Array(bytes.buffer);
    const floatData = this.pcmToFloat32(pcmData);

    const buffer = this.playbackContext.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);

    const sourceNode = this.playbackContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.connect(this.playbackContext.destination);

    sourceNode.onended = () => {
      const index = this.activeSources.indexOf(sourceNode);
      if (index > -1) this.activeSources.splice(index, 1);
    };
    this.activeSources.push(sourceNode);

    const startTime = Math.max(this.playbackContext.currentTime, this.nextStartTime);
    sourceNode.start(startTime);
    this.nextStartTime = startTime + buffer.duration;
  }

  clearPlaybackQueue(): void {
    this.activeSources.forEach(source => {
      try {
        source.stop();
        source.disconnect();
      } catch (e) {
        // Ignored if already stopped
      }
    });
    this.activeSources = [];
    this.nextStartTime = this.playbackContext?.currentTime ?? 0;
  }

  stopPlayback(): void {
    this.clearPlaybackQueue();
    this.playbackContext?.close();
    this.playbackContext = null;
    this.nextStartTime = 0;
  }

  private floatTo16BitPCM(input: Float32Array): Int16Array {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  }

  private pcmToFloat32(input: Int16Array): Float32Array {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i++) {
      output[i] = input[i] / 32768;
    }
    return output;
  }

  private arrayBufferToBase64(buffer: ArrayBufferLike): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}

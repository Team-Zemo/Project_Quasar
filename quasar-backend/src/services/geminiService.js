const { GoogleGenAI, Modality } = require('@google/genai');
const config = require('../config/env');
const logger = require('../utils/logger');

// Initialize Gemini SDK with global config
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

class GeminiService {
  constructor(domain, callbacks, customSystemPrompt) {
    this.domain = domain || "General";
    this.callbacks = callbacks || {};
    this.session = null;
    this.isConnected = false;
    this.customSystemPrompt = customSystemPrompt || null;
  }

  /**
   * Establish connection to Gemini Live API
   */
  async connect() {
    try {
      logger.info(`Starting Gemini LIVE API session for domain: ${this.domain}`);
      this.session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
          },
          systemInstruction: this._buildSystemPrompt(),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            logger.info("Gemini API connection opened natively");
            this.isConnected = true;
            if (typeof this.callbacks.onOpen === 'function') {
              this.callbacks.onOpen();
            }
          },
          onmessage: async (message) => {
             this._handleMessage(message);
          },
          onclose: () => {
            logger.info("Gemini API connection closed natively");
            this.isConnected = false;
            if (typeof this.callbacks.onClose === 'function') {
              this.callbacks.onClose();
            }
          },
          onerror: (error) => {
            logger.error("Gemini API error intercepted", { error });
            if (typeof this.callbacks.onError === 'function') {
              this.callbacks.onError(error);
            }
          }
        }
      });
      return this.session;
    } catch (err) {
      logger.error("Failed to establish Gemini Live API connection:", err);
      throw err;
    }
  }

  _buildSystemPrompt() {
    // Use custom persona system prompt if provided
    if (this.customSystemPrompt) {
      return `${this.customSystemPrompt}\n\nThe interview domain is: ${this.domain}. The conversation is real-time voice-based.`;
    }

    return `You are an expert interviewer for the domain: ${this.domain}. 
    Your goal is to conduct a professional, challenging, and realistic interview.
    Ask one question at a time. Wait for the user's response. 
    Provide brief feedback if necessary, then move to the next question.
    Be professional, encouraging, but rigorous.
    The conversation is real-time voice-based.`;
  }

  /**
   * Route incoming structured Gemini messages to standard standardized output types
   */
  _handleMessage(geminiMessage) {
    if (typeof this.callbacks.onMessage !== 'function') return;

    // Handle audio chunk outputs
    const audioData = geminiMessage.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
      this.callbacks.onMessage({ type: 'audio', data: audioData });
    }

    // Handle AI textual transcription
    const modelTranscription = geminiMessage.serverContent?.modelTurn?.parts?.[0]?.text;
    if (modelTranscription) {
      this.callbacks.onMessage({ type: 'transcript_model', text: modelTranscription });
    }

    // Handle User voice transcription
    const userTranscription = geminiMessage.serverContent?.inputAudioTranscription?.transcription;
    if (userTranscription) {
      this.callbacks.onMessage({ type: 'transcript_user', text: userTranscription });
    }

    // Handle model speech interruptions
    if (geminiMessage.serverContent?.interrupted) {
      this.callbacks.onMessage({ type: 'interrupted' });
    }
  }

  /**
   * Submits base64 audio frames (PCM 16kHz) to Gemini
   * @param {string} base64Data 
   */
  sendAudio(base64Data) {
    if (this.session && this.isConnected) {
      try {
        this.session.sendRealtimeInput({
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      } catch (err) {
        logger.error('Failed to send audio to Gemini within active session', { err });
      }
    } else {
      logger.warn('Attempted to send audio but Gemini is not fully connected');
    }
  }

  /**
   * Terminate active Gemini connection
   */
  disconnect() {
    if (this.session && this.isConnected) {
      logger.info('Closing Gemini session explicitly from service layer');
      try {
        this.session.close();
      } catch(e) {
        logger.error('Error during Gemini session closure:', e);
      } finally {
        this.session = null;
        this.isConnected = false;
      }
    }
  }
}

module.exports = GeminiService;

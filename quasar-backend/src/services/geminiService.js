const { GoogleGenAI, Modality } = require('@google/genai');
const config = require('../config/env');
const logger = require('../utils/logger');

// Initialize Gemini SDK with global config
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

// ── Tool declaration ────────────────────────────────────────────────
// The model calls this when it decides the interview is complete.
const END_INTERVIEW_TOOL = {
  functionDeclarations: [
    {
      name: 'end_interview',
      description:
        'Call this function when the interview is complete. ' +
        'Use it after delivering your closing remarks and thanking the candidate. ' +
        'This will gracefully end the session on the client side.',
      parameters: {
        type: 'object',
        properties: {
          closing_remark: {
            type: 'string',
            description: 'A short, warm closing message to the candidate summarising the session.',
          },
        },
        required: ['closing_remark'],
      },
    },
  ],
};

class GeminiService {
  constructor(domain, callbacks, customSystemPrompt) {
    this.domain = domain || 'General';
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
        model: 'gemini-3.1-flash-live-preview',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: this._buildSystemPrompt(),
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          tools: [END_INTERVIEW_TOOL],
        },
        callbacks: {
          onopen: () => {
            logger.info('Gemini API connection opened natively');
            this.isConnected = true;
            if (typeof this.callbacks.onOpen === 'function') {
              this.callbacks.onOpen();
            }
          },
          onmessage: async (message) => {
            await this._handleMessage(message);
          },
          onclose: () => {
            logger.info('Gemini API connection closed natively');
            this.isConnected = false;
            if (typeof this.callbacks.onClose === 'function') {
              this.callbacks.onClose();
            }
          },
          onerror: (error) => {
            logger.error('Gemini API error intercepted', { error });
            if (typeof this.callbacks.onError === 'function') {
              this.callbacks.onError(error);
            }
          },
        },
      });
      return this.session;
    } catch (err) {
      logger.error('Failed to establish Gemini Live API connection:', err);
      throw err;
    }
  }

  _buildSystemPrompt() {
    // Custom persona/JD prompt — append structure guidance and tool instruction
    if (this.customSystemPrompt) {
      return (
        this.customSystemPrompt +
        `\n\n` +
        `The interview domain is: ${this.domain}. The conversation is real-time voice-based.\n` +
        this._interviewStructureGuidance()
      );
    }

    return (
      `You are an expert technical interviewer specializing in: ${this.domain}.\n` +
      `Your style is professional, warm, and focused. You conduct real-world, realistic interviews.\n\n` +
      this._interviewStructureGuidance()
    );
  }

  _interviewStructureGuidance() {
    return `## Interview Structure — Follow This Carefully

PHASE 1 — INTRODUCTION (do this first, always):
- Greet the candidate warmly by name if known, otherwise "Hello, welcome!"
- Briefly introduce yourself: "I'm your interviewer today for this ${this.domain} session."
- Give a one-sentence overview of what to expect: "We'll go through a mix of conceptual and situational questions. Feel free to take a moment before answering."
- Ask a simple warm-up: "Could you start by telling me a little about yourself and your experience with ${this.domain}?"

PHASE 2 — CORE INTERVIEW (8 to 10 questions total, including follow-ups):
- Ask questions ONE AT A TIME. Never ask multiple questions at once.
- Wait for the full answer before proceeding.
- Cover a balanced mix: fundamentals, problem-solving, real-world scenarios, and one behavioral/situational question.
- Follow-up rule: Only ask a follow-up if the answer was notably incomplete, vague, or particularly interesting. Maximum two follow-ups per main question. Do not chain follow-ups.
- Acknowledge each answer briefly ("That's a good point.", "Interesting approach.", "Got it.") — keep acknowledgements short, max one sentence.
- Do NOT provide correct answers, coaching, or scoring during the interview. Stay neutral.
- Aim for 8 questions total (including any follow-ups). Do not exceed 10 exchanges before closing.
- Keep track mentally. After roughly 8 main responses from the candidate, move to closing.

PHASE 3 — CLOSING (always end using the end_interview function):
- Deliver a natural verbal closing: thank the candidate, mention feedback will follow.
- Example: "That wraps up our session today. Thank you so much for your time — you've covered some really solid ground. We'll be in touch with feedback soon. Best of luck!"
- Immediately after saying this, call the \`end_interview\` function with your closing_remark.

## Critical Rules
- This is a VOICE interview — keep responses concise and natural. No bullet lists or markdown in speech.
- Never break character. You are a real interviewer.
- Never ask more than 10 questions total.
- Always end the interview by calling end_interview — do not let the session drift indefinitely.`;
  }

  /**
   * Route incoming structured Gemini messages to standardised output types.
   * Handles: audio, transcriptions, interruptions, AND function calls.
   */
  async _handleMessage(geminiMessage) {
    if (typeof this.callbacks.onMessage !== 'function') return;

    // ── Audio output ───────────────────────────────────────────────
    const parts = geminiMessage.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        this.callbacks.onMessage({ type: 'audio', data: part.inlineData.data });
      }
      if (part.text) {
        this.callbacks.onMessage({ type: 'transcript_model', text: part.text });
      }
    }

    // ── Transcriptions ─────────────────────────────────────────────
    const userTranscription =
      geminiMessage.serverContent?.inputAudioTranscription?.transcription;
    if (userTranscription) {
      this.callbacks.onMessage({ type: 'transcript_user', text: userTranscription });
    }

    const modelTranscription =
      geminiMessage.serverContent?.outputAudioTranscription?.transcription;
    if (modelTranscription) {
      this.callbacks.onMessage({ type: 'transcript_model', text: modelTranscription });
    }

    // ── Interruptions ──────────────────────────────────────────────
    if (geminiMessage.serverContent?.interrupted) {
      this.callbacks.onMessage({ type: 'interrupted' });
    }

    // ── Function calls (synchronous) ───────────────────────────────
    if (geminiMessage.toolCall) {
      await this._handleToolCall(geminiMessage.toolCall);
    }
  }

  /**
   * Handle synchronous tool/function calls from the model.
   * The Live API requires a tool response even for side-effectful calls.
   * @param {object} toolCall
   */
  async _handleToolCall(toolCall) {
    const functionResponses = [];

    for (const fc of toolCall.functionCalls ?? []) {
      logger.info(`Gemini requested function call: ${fc.name}`, { args: fc.args });

      if (fc.name === 'end_interview') {
        const closingRemark = fc.args?.closing_remark ?? 'Thank you for the interview!';

        // Acknowledge to the model synchronously (required by Live API)
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: 'interview_ended' },
        });

        // Notify the client — the front-end will trigger its own teardown
        if (typeof this.callbacks.onMessage === 'function') {
          this.callbacks.onMessage({
            type: 'interview_ended_by_ai',
            closingRemark,
          });
        }
      } else {
        // Unknown tool — respond with a no-op so the model isn't blocked
        functionResponses.push({
          id: fc.id,
          name: fc.name,
          response: { result: 'unknown_tool' },
        });
      }
    }

    if (functionResponses.length > 0 && this.session && this.isConnected) {
      try {
        this.session.sendToolResponse({ functionResponses });
        logger.info('Sent tool response for function calls', {
          count: functionResponses.length,
        });
      } catch (err) {
        logger.error('Failed to send tool response to Gemini', { err: err.message });
      }
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
          audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' },
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
      } catch (e) {
        logger.error('Error during Gemini session closure:', e);
      } finally {
        this.session = null;
        this.isConnected = false;
      }
    }
  }
}

module.exports = GeminiService;

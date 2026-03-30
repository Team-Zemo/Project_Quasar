const { GoogleGenAI, Modality } = require('@google/genai');
const config = require('../config/env');
const logger = require('../utils/logger');

// Initialize Gemini SDK with global config
const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });

// ── Tool declarations ───────────────────────────────────────────────
const INTERVIEW_TOOLS = {
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
    {
      name: 'present_coding_question',
      description:
        'Call this function when you want to present a coding challenge to the candidate. ' +
        "Say the question out loud first, then immediately call this function. " +
        'The system will pause audio capture and show the candidate a code editor. ' +
        "You must wait silently — do NOT speak again until you receive the candidate's code submission.",
      parameters: {
        type: 'object',
        properties: {
          question_title: {
            type: 'string',
            description: 'Short title of the coding question, e.g. "Reverse a Linked List".',
          },
          question_description: {
            type: 'string',
            description: 'Full problem statement including constraints and examples.',
          },
          preferred_language: {
            type: 'string',
            description: 'Preferred programming language, e.g. "Python", "JavaScript", "Any".',
          },
        },
        required: ['question_title', 'question_description', 'preferred_language'],
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
    this._pendingCodingCall = null;
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
          tools: [INTERVIEW_TOOLS],
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
    return (
      '## Interview Structure — Follow This Carefully\n' +
      '\n' +
      'PHASE 1 — INTRODUCTION (do this first, always):\n' +
      '- Greet the candidate warmly by name if known, otherwise "Hello, welcome!"\n' +
      `- Briefly introduce yourself: "I'm your interviewer today for this ${this.domain} session."\n` +
      '- Give a one-sentence overview of what to expect: "We\'ll go through a mix of conceptual and situational questions. Feel free to take a moment before answering."\n' +
      `- Ask a simple warm-up: "Could you start by telling me a little about yourself and your experience with ${this.domain}?"\n` +
      '\n' +
      'PHASE 2 — CORE INTERVIEW (8 to 10 questions total, including follow-ups):\n' +
      '- Ask questions ONE AT A TIME. Never ask multiple questions at once.\n' +
      '- Wait for the full answer before proceeding.\n' +
      '- Cover a balanced mix: fundamentals, problem-solving, real-world scenarios, and one behavioral/situational question.\n' +
      '- Follow-up rule: Only ask a follow-up if the answer was notably incomplete, vague, or particularly interesting. Maximum two follow-ups per main question. Do not chain follow-ups.\n' +
      '- Acknowledge each answer briefly ("That\'s a good point.", "Interesting approach.", "Got it.") — keep acknowledgements short, max one sentence.\n' +
      '- Do NOT provide correct answers, coaching, or scoring during the interview. Stay neutral.\n' +
      '- Aim for 8 questions total (including any follow-ups). Do not exceed 10 exchanges before closing.\n' +
      '- Keep track mentally. After roughly 8 main responses from the candidate, move to closing.\n' +
      '\n' +
      'CODING QUESTIONS (use sparingly — maximum 1 or 2 per session):\n' +
      '- If the domain is technical/engineering, include 1 coding question mid-interview (not first, not last).\n' +
      '- To present a coding question: first SAY the problem out loud clearly and concisely, then IMMEDIATELY call `present_coding_question` with the full details.\n' +
      '- The candidate will type their code in an editor. You will receive their submission as a tool response — do NOT speak until you receive it.\n' +
      '- Once you receive the code, evaluate it verbally: comment on correctness, edge cases, time/space complexity, and code clarity. Ask a brief verbal follow-up if needed.\n' +
      '- Pick problems appropriate to the domain. Examples: algorithms for SWE, SQL queries for data, regex for backend, etc.\n' +
      '- Keep coding questions concise — solvable in 10-15 minutes. No massive system-design problems.\n' +
      '- Specify preferred_language based on what the candidate mentioned or the JD. Use "Any" if not specified.\n' +
      '\n' +
      'PHASE 3 — CLOSING (always end using the end_interview function):\n' +
      '- Deliver a natural verbal closing: thank the candidate, mention feedback will follow.\n' +
      '- Example: "That wraps up our session today. Thank you so much for your time — you\'ve covered some really solid ground. We\'ll be in touch with feedback soon. Best of luck!"\n' +
      '- Immediately after saying this, call the `end_interview` function with your closing_remark.\n' +
      '\n' +
      '## Critical Rules\n' +
      '- This is a VOICE interview — keep responses concise and natural. No bullet lists or markdown in speech.\n' +
      '- Never break character. You are a real interviewer.\n' +
      '- Never ask more than 10 questions total.\n' +
      '- Always end the interview by calling end_interview — do not let the session drift indefinitely.'
    );
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
          this.callbacks.onMessage({ type: 'interview_ended_by_ai', closingRemark });
        }

      } else if (fc.name === 'present_coding_question') {
        const { question_title, question_description, preferred_language } = fc.args ?? {};

        // Store the pending call — we respond ONLY when the user submits their code.
        // Gemini will be blocked (waiting for tool response) until submitCode() is called.
        this._pendingCodingCall = { id: fc.id, name: fc.name };

        // Signal the client to open the code editor
        if (typeof this.callbacks.onMessage === 'function') {
          this.callbacks.onMessage({
            type: 'coding_question',
            questionTitle: question_title,
            questionDescription: question_description,
            preferredLanguage: preferred_language ?? 'Any',
          });
        }

        // Do NOT push a functionResponse here — Gemini waits until submitCode() responds.
        continue;

      } else {
        // Unknown tool — respond with a no-op so the model is not blocked
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
        logger.info('Sent tool response for function calls', { count: functionResponses.length });
      } catch (err) {
        logger.error('Failed to send tool response to Gemini', { err: err.message });
      }
    }
  }

  /**
   * Send the user's code submission back to Gemini as a tool response.
   * This unblocks the model (which was waiting on present_coding_question) so
   * it can evaluate the code verbally and continue the interview.
   * @param {string} code
   * @param {string} language
   */
  submitCode(code, language) {
    if (!this.session || !this.isConnected) {
      logger.warn('submitCode called but Gemini is not connected');
      return;
    }

    if (this._pendingCodingCall) {
      try {
        this.session.sendToolResponse({
          functionResponses: [{
            id: this._pendingCodingCall.id,
            name: this._pendingCodingCall.name,
            response: { result: 'code_submitted', language, code },
          }],
        });
        logger.info('Sent code submission as tool response to Gemini', { language });
      } catch (err) {
        logger.error('Failed to send code tool response', { err: err.message });
      }
      this._pendingCodingCall = null;
    } else {
      // Fallback: no pending call — inject as plain text
      const text = '[Candidate submitted code in ' + language + ']:\n```' + language.toLowerCase() + '\n' + code + '\n```';
      try {
        this.session.sendRealtimeInput({ text });
        logger.info('Sent code as fallback text input to Gemini');
      } catch (err) {
        logger.error('Failed to sendRealtimeInput for code', { err: err.message });
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

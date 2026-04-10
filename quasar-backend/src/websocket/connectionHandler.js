const GeminiService = require('../services/geminiService');
const Persona = require('../models/Persona');
const User = require('../models/User');
const logger = require('../utils/logger');
const WebSocket = require('ws');

class ConnectionHandler {
  /**
   * Represents an abstraction around a single browser -> backend WebSocket
   * @param {WebSocket} ws 
   * @param {object} user - Authenticated user object from JWT ({ id, email, name })
   */
  constructor(ws, user) {
    this.ws = ws;
    this.user = user || null;
    this.geminiService = null;
    this.isClientConnected = true;
    this.sessionId = null;

    this._bindWebSocketEvents();
    
    // Announce connection readiness to client
    this._sendToClient({ type: 'connected' });
  }

  _bindWebSocketEvents() {
    this.ws.on('message', async (data) => {
      try {
        await this._handleClientMessage(JSON.parse(data.toString()));
      } catch (err) {
        logger.error('Failed to handle incoming websocket command payload', { err });
      }
    });

    this.ws.on('close', () => {
      logger.info('Client web-socket closed');
      this.isClientConnected = false;
      this._teardownGemini();
    });

    this.ws.on('error', (error) => {
      logger.error('WebSocket connection error intercepted', { error });
      this.isClientConnected = false;
      this._teardownGemini();
    });
  }

  /**
   * Parses JSON string events originating from front-end applications
   * @param {object} payload 
   */
  async _handleClientMessage(payload) {
    logger.debug(`Incoming Client WS request: [${payload.type}]`);

    switch (payload.type) {
      case 'setup':
        await this._initGeminiSession(payload.domain, payload.personaId, payload.customSystemPrompt);
        break;

      case 'audio':
        if (this.geminiService) {
           this.geminiService.sendAudio(payload.data);
        } else {
           logger.warn('Audio frames received before Gemini readiness');
        }
        break;

      case 'code_submission':
        if (this.geminiService) {
          logger.info('Forwarding code submission to Gemini', { language: payload.language });
          this.geminiService.submitCode(payload.code ?? '', payload.language ?? 'Unknown');
        } else {
          logger.warn('Code submission received before Gemini readiness');
        }
        break;

      case 'end':
        this._teardownGemini();
        this._sendToClient({ type: 'session_ended' });
        break;

      // Unused gracefully omitted
      case 'interrupt':
      default:
        break;
    }
  }

  /**
   * Initializes Gemini LLM service bridge with optional persona
   * @param {string} domain 
   * @param {string} personaId 
   * @param {string} customSystemPrompt 
   */
  async _initGeminiSession(domain, personaId, customSystemPrompt) {
    this._teardownGemini();

    // Fetch persona system prompt if provided
    let systemPrompt = null;
    if (personaId) {
      try {
        const persona = await Persona.findById(personaId).select('systemPrompt').lean();
        if (persona) {
          systemPrompt = persona.systemPrompt;
          logger.info(`Using persona system prompt: ${personaId}`);
        }
      } catch (err) {
        logger.warn('Failed to fetch persona, using default', { err: err.message });
      }
    }

    // Use custom system prompt (from JD questions) if provided
    if (customSystemPrompt) {
      systemPrompt = customSystemPrompt;
    }

    // Append candidate platform context (GitHub + LeetCode) to the system prompt
    // so the AI interviewer knows their actual projects and coding history.
    if (this.user?.id) {
      try {
        const candidate = await User.findById(this.user.id)
          .select('platformContext leetcodeStats projects githubUsername leetcodeUsername skills')
          .lean();

        if (candidate?.platformContext) {
          const contextNote =
            '\n\n## Candidate Background (from verified external platforms)\n' +
            'Use this to tailor questions to their actual experience. ' +
            'Reference specific projects or skills they have demonstrated.\n' +
            candidate.platformContext;
          systemPrompt = (systemPrompt || '') + contextNote;
        }
      } catch (err) {
        logger.warn('Failed to fetch candidate platform context for interview', { err: err.message });
      }
    }

    this.geminiService = new GeminiService(domain, {
      onOpen: () => {
        this._sendToClient({ type: 'session_ready' });
      },
      onMessage: (messageObj) => {
        this._sendToClient(messageObj);

        // AI decided the interview is over — forward to client then tear down
        if (messageObj.type === 'interview_ended_by_ai') {
          logger.info('AI called end_interview — scheduling graceful teardown', {
            userId: this.user?.id,
          });
          // Give the final audio 3.5 s to finish playing on the client before closing
          setTimeout(() => {
            this._teardownGemini();
            this._sendToClient({ type: 'session_ended' });
          }, 3500);
        }
      },
      onClose: () => {
        this._sendToClient({ type: 'session_ended' });
      },
      onError: (err) => {
        this._sendToClient({ type: 'error', message: 'Gemini Session failed.' });
      }
    }, systemPrompt);

    try {
      await this.geminiService.connect();
    } catch (err) {
      logger.error("Failed to connect Gemini at setup:", err);
      this._sendToClient({ type: 'error', message: 'Initialization failed for interview.' });
    }
  }

  /**
   * Securely emits messages down the socket stream
   * @param {object} messageBody 
   */
  _sendToClient(messageBody) {
    if (this.isClientConnected && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(messageBody));
      } catch (err) {
        logger.error('Failed pushing payload to web client', err);
      }
    }
  }

  /**
   * Kills associated resource instances
   */
  _teardownGemini() {
    if (this.geminiService) {
      this.geminiService.disconnect();
      this.geminiService = null;
    }
  }
}

module.exports = ConnectionHandler;

const GeminiService = require('../services/geminiService');
const { pool } = require('../config/database');
const logger = require('../utils/logger');
const WebSocket = require('ws');

class ConnectionHandler {
  /**
   * Represents an abstraction around a single browser -> backend WebSocket
   * @param {WebSocket} ws 
   */
  constructor(ws) {
    this.ws = ws;
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
        const result = await pool.query('SELECT system_prompt FROM personas WHERE id = $1', [personaId]);
        if (result.rows.length > 0) {
          systemPrompt = result.rows[0].system_prompt;
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

    this.geminiService = new GeminiService(domain, {
      onOpen: () => {
        this._sendToClient({ type: 'session_ready' });
      },
      onMessage: (messageObj) => {
        this._sendToClient(messageObj);
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

const { WebSocketServer } = require('ws');
const logger = require('../utils/logger');
const ConnectionHandler = require('./connectionHandler');

class SocketManager {
  /**
   * Initializes real-time application routes
   * @param {import('http').Server} server 
   */
  static init(server) {
    const wss = new WebSocketServer({ server, path: '/ws/interview' });
    logger.info('Live interview websocket route registered (/ws/interview)');

    wss.on('connection', (ws, req) => {
      logger.info(`Websocket client bound from ${req.socket.remoteAddress}`);
      // Launch a new connection instance per connected browser
      new ConnectionHandler(ws);
    });

    wss.on('error', (err) => {
      logger.error('Main WebSocketServer global failure:', err);
    });

    return wss;
  }
}

module.exports = SocketManager;

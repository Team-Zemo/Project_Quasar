const { WebSocketServer } = require('ws');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const config = require('../config/env');
const ConnectionHandler = require('./connectionHandler');

/**
 * Parses a raw Cookie header string into a key-value map.
 * @param {string} cookieHeader
 * @returns {Record<string, string>}
 */
function parseCookies(cookieHeader = '') {
  return Object.fromEntries(
    cookieHeader.split(';').map(pair => {
      const [key, ...rest] = pair.trim().split('=');
      return [key.trim(), decodeURIComponent(rest.join('=').trim())];
    }).filter(([key]) => key)
  );
}

class SocketManager {
  /**
   * Initializes real-time application routes with JWT authentication.
   * @param {import('http').Server} server 
   */
  static init(server) {
    const wss = new WebSocketServer({ noServer: true });
    logger.info('Live interview websocket route registered (/ws/interview) — auth required');

    // Intercept the upgrade handshake to authenticate BEFORE the WS connection is accepted
    server.on('upgrade', (req, socket, head) => {
      if (req.url !== '/ws/interview') {
        socket.destroy();
        return;
      }

      const cookies = parseCookies(req.headers.cookie);
      const token = cookies.accessToken;

      if (!token) {
        logger.warn('WS upgrade rejected: no accessToken cookie');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      try {
        const decoded = jwt.verify(token, config.jwtAccessSecret);
        req.user = { id: decoded.sub, email: decoded.email, name: decoded.name };
      } catch (err) {
        logger.warn('WS upgrade rejected: invalid/expired token', { err: err.message });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    });

    wss.on('connection', (ws, req) => {
      logger.info(`Authenticated WS client connected: user=${req.user?.id} from ${req.socket.remoteAddress}`);
      new ConnectionHandler(ws, req.user);
    });

    wss.on('error', (err) => {
      logger.error('Main WebSocketServer global failure:', err);
    });

    return wss;
  }
}

module.exports = SocketManager;

const http = require('http');
const app = require('./app');
const config = require('./config/env');
const logger = require('./utils/logger');
const SocketManager = require('./websocket/socketManager');
const { initDatabase } = require('./config/database');

// Wrap Express Application inside Native HTTP server for WS
const server = http.createServer(app);

// Initialize database tables then start server
async function start() {
  try {
    await initDatabase();
    logger.info('Database initialized successfully');
  } catch (err) {
    logger.error('Database initialization failed — continuing without DB', { err: err.message });
  }

  // Spin up WS server bound on the HTTP listener instance
  SocketManager.init(server);

  server.listen(config.port, () => {
    logger.info(`Starting Backend Services Node Environment: ${config.nodeEnv}`);
    logger.info(`Server is globally listening securely via port: ${config.port}`);
  });
}

start();

process.on('uncaughtException', (err) => {
  logger.error('CRITICAL FAULT: Uncaught generic node application exception', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('CRITICAL FAULT: Missing catch boundary resolving async promises:', { promise, reason });
  process.exit(1);
});

module.exports = server;

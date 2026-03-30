const mongoose = require('mongoose');
const config = require('./env');
const logger = require('../utils/logger');

async function connectDatabase() {
  try {
    await mongoose.connect(config.mongoUri);
    logger.info('MongoDB connected successfully');
  } catch (err) {
    logger.error('MongoDB connection failed', { err: err.message });
    throw err;
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error', { err: err.message });
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

module.exports = { connectDatabase };

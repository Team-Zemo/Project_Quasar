const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const passport = require('passport');

const config = require('./config/env');
const logger = require('./utils/logger');
const { configurePassport } = require('./config/passport');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

const app = express();

// Set security headers
app.use(helmet());

// Compress responses
app.use(compression());

// Parse cookies
app.use(cookieParser());

// Parse incoming payloads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Enable configured CORS — credentials required for cookie auth
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

// Passport initialization
configurePassport();
app.use(passport.initialize());

// Route HTTP access logs dynamically based on environment
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));
}

// Health check
app.get('/health', (req, res) => res.status(200).json({ success: true, message: 'Quasar Backend API Health Okay', data: { version: '2.0.0' } }));
app.get('/', (req, res) => res.send('Quasar Backend is currently running. Connect via API or WS'));

// Routes
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);

// Centralized unknown route catcher
app.use((req, res, next) => {
  res.status(404).json({ success: false, message: 'REST endpoint resource missing', data: null });
});

// Primary fault handler boundary — never leak stack traces
app.use((err, req, res, next) => {
  logger.error('Unhandled Application Issue:', { err: err.message, stack: err.stack });
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: config.nodeEnv === 'development' ? err.message : 'Internal API Platform Fault',
    data: null
  });
});

module.exports = app;

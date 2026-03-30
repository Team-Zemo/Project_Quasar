require('dotenv').config();

const config = {
  port: process.env.PORT || 8080,
  geminiApiKey: process.env.GEMINI_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // JWT
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'quasar-access-secret-change-in-prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'quasar-refresh-secret-change-in-prod',
  jwtAccessExpiry: '15m',
  jwtRefreshExpiry: '7d',

  // PostgreSQL
  pgHost: process.env.PG_HOST || 'localhost',
  pgPort: parseInt(process.env.PG_PORT || '5432', 10),
  pgUser: process.env.PG_USER || 'postgres',
  pgPassword: process.env.PG_PASSWORD || 'postgres',
  pgDatabase: process.env.PG_DATABASE || 'quasar',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  appUrl: process.env.APP_URL || 'http://localhost:8080',
};

if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
}

module.exports = config;

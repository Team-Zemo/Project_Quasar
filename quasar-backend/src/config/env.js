require('dotenv').config();

const config = {
  port: process.env.PORT || 8081,
  geminiApiKey: process.env.GEMINI_API_KEY,
  groqApiKey: process.env.GROQ_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // JWT
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'quasar-access-secret-change-in-prod',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'quasar-refresh-secret-change-in-prod',
  jwtAccessExpiry: '15m',
  jwtRefreshExpiry: '7d',

  // MongoDB
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/quasar',

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
  appUrl: process.env.APP_URL || 'http://localhost:8081',

  // GitHub OAuth
  githubClientId: process.env.GITHUB_CLIENT_ID || '',
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET || '',

  // Email (Nodemailer / Gmail SMTP)
  smtpHost: process.env.SMTP_HOST || 'smtp.gmail.com',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@quasar.app',
};

if (!config.geminiApiKey) {
  throw new Error('GEMINI_API_KEY is not defined in the environment variables.');
}

if (!config.groqApiKey) {
  console.warn('GROQ_API_KEY is not set — JD parsing and transcript evaluation will fail.');
}

module.exports = config;

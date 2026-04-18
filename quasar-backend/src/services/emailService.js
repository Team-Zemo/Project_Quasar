/**
 * Quasar Email Service
 * All transactional emails in a unified, branded HTML template.
 *
 * Emails implemented:
 *  1. sendWelcome               — New user registered (email or OAuth)
 *  2. sendPasswordReset         — Forgot password / reset link
 *  3. sendPasswordChanged       — Security confirmation after password change
 *  4. sendApplicationSubmitted  — Candidate applied to a job
 *  5. sendScreeningResult       — AI screening pass/fail result
 *  6. sendPipelineNotification  — Final selection or rejection
 */

const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

// ── Transport singleton ─────────────────────────────────────────────

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  if (!config.smtpUser || !config.smtpPass) {
    logger.warn('SMTP credentials not configured — email sending will be skipped');
    return null;
  }

  _transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass,
    },
    pool: true,
    maxConnections: 3,
  });

  return _transporter;
}

// ── Shared design tokens ────────────────────────────────────────────

const BRAND = {
  bg: '#09090f',
  surface: '#11111c',
  surfaceBorder: '#1e1e2e',
  accent: '#f97316',        // orange-500
  accentAlt: '#fb923c',     // orange-400
  purple: '#7c3aed',
  success: '#22c55e',
  error: '#ef4444',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, sans-serif",
  appName: 'Quasar',
  tagline: 'AI-Powered Smart Hiring Platform',
  helpUrl: config.corsOrigin + '/profile',
  appUrl: config.corsOrigin,
};

// ── Base HTML template builder ──────────────────────────────────────

/**
 * Wraps content in the full Quasar branded email shell.
 *
 * @param {object} opts
 * @param {string} opts.preheader    — Short preview text (hidden in email client)
 * @param {string} opts.accentColor  — CTA button / accent color override
 * @param {string} opts.body         — Inner HTML (everything inside the card)
 * @returns {string} Complete HTML email string
 */
function buildEmail({ preheader = '', accentColor = BRAND.accent, body }) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${BRAND.appName}</title>
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
  <style>
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; }
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; outline: none; text-decoration: none; }
    a { color: ${accentColor}; }

    body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: ${BRAND.bg};
      font-family: ${BRAND.fontFamily};
      color: ${BRAND.textPrimary};
    }

    /* Outer wrapper */
    .email-wrapper {
      width: 100%;
      background-color: ${BRAND.bg};
      padding: 40px 16px;
    }

    /* Card */
    .email-card {
      max-width: 560px;
      margin: 0 auto;
      background-color: ${BRAND.surface};
      border: 1px solid ${BRAND.surfaceBorder};
      border-radius: 20px;
      overflow: hidden;
    }

    /* Top accent bar */
    .accent-bar {
      height: 4px;
      background: linear-gradient(90deg, ${accentColor}, ${BRAND.accentAlt});
    }

    /* Header */
    .email-header {
      padding: 32px 40px 24px;
      border-bottom: 1px solid ${BRAND.surfaceBorder};
    }
    .logo-lockup {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
    }
    .logo-mark {
      width: 40px;
      height: 40px;
      background: linear-gradient(135deg, ${accentColor} 0%, ${BRAND.accentAlt} 100%);
      border-radius: 10px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      color: #ffffff;
      letter-spacing: -1px;
      text-decoration: none;
    }
    .logo-name {
      font-size: 20px;
      font-weight: 800;
      color: ${BRAND.textPrimary};
      letter-spacing: -0.5px;
      text-decoration: none;
    }

    /* Body */
    .email-body {
      padding: 36px 40px;
    }

    /* Typography */
    .email-heading {
      font-size: 26px;
      font-weight: 800;
      color: ${BRAND.textPrimary};
      margin: 0 0 8px;
      letter-spacing: -0.5px;
      line-height: 1.2;
    }
    .email-subheading {
      font-size: 14px;
      color: ${BRAND.textSecondary};
      margin: 0 0 28px;
      line-height: 1.6;
    }
    .email-p {
      font-size: 15px;
      color: ${BRAND.textSecondary};
      line-height: 1.7;
      margin: 0 0 20px;
    }
    .email-p strong {
      color: ${BRAND.textPrimary};
      font-weight: 600;
    }

    /* CTA Button */
    .btn-wrap {
      margin: 28px 0;
    }
    .btn-cta {
      display: inline-block;
      background: linear-gradient(135deg, ${accentColor} 0%, ${BRAND.accentAlt} 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 15px 32px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 700;
      letter-spacing: -0.2px;
      line-height: 1;
    }
    .btn-cta:hover { opacity: 0.92; }

    /* Info box */
    .info-box {
      background-color: ${BRAND.bg};
      border: 1px solid ${BRAND.surfaceBorder};
      border-radius: 12px;
      padding: 18px 20px;
      margin: 20px 0;
    }
    .info-box-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: ${BRAND.textMuted};
      margin: 0 0 4px;
    }
    .info-box-value {
      font-size: 15px;
      font-weight: 600;
      color: ${BRAND.textPrimary};
      margin: 0;
    }

    /* Stat row */
    .stat-row {
      display: flex;
      gap: 12px;
      margin: 20px 0;
    }
    .stat-item {
      flex: 1;
      background: ${BRAND.bg};
      border: 1px solid ${BRAND.surfaceBorder};
      border-radius: 12px;
      padding: 14px 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 22px;
      font-weight: 800;
      margin: 0 0 2px;
      line-height: 1;
    }
    .stat-label {
      font-size: 11px;
      color: ${BRAND.textMuted};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0;
    }

    /* Badge / pill */
    .pill {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.3px;
    }
    .pill-success { background: rgba(34,197,94,0.12); color: #22c55e; border: 1px solid rgba(34,197,94,0.2); }
    .pill-error   { background: rgba(239,68,68,0.12);  color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
    .pill-info    { background: rgba(249,115,22,0.12); color: ${accentColor}; border: 1px solid rgba(249,115,22,0.2); }

    /* Divider */
    .divider {
      border: none;
      border-top: 1px solid ${BRAND.surfaceBorder};
      margin: 24px 0;
    }

    /* Link */
    .text-link {
      color: ${accentColor};
      text-decoration: none;
      font-weight: 500;
    }
    .text-link:hover { text-decoration: underline; }

    /* Fallback URL block */
    .url-fallback {
      font-size: 12px;
      color: ${BRAND.textMuted};
      word-break: break-all;
      margin: 8px 0 0;
    }

    /* Alert box */
    .alert-box {
      border-radius: 12px;
      padding: 14px 18px;
      font-size: 13px;
      line-height: 1.6;
      margin: 20px 0;
    }
    .alert-warning {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.2);
      color: #fca5a5;
    }
    .alert-success {
      background: rgba(34,197,94,0.08);
      border: 1px solid rgba(34,197,94,0.2);
      color: #86efac;
    }
    .alert-info {
      background: rgba(249,115,22,0.08);
      border: 1px solid rgba(249,115,22,0.2);
      color: #fdba74;
    }

    /* Footer */
    .email-footer {
      padding: 24px 40px;
      border-top: 1px solid ${BRAND.surfaceBorder};
      text-align: center;
    }
    .footer-text {
      font-size: 12px;
      color: ${BRAND.textMuted};
      margin: 0 0 4px;
      line-height: 1.6;
    }
    .footer-tagline {
      font-size: 11px;
      color: ${BRAND.textMuted};
      opacity: 0.6;
      margin: 8px 0 0;
    }

    /* Responsive */
    @media only screen and (max-width: 600px) {
      .email-header, .email-body, .email-footer { padding-left: 24px !important; padding-right: 24px !important; }
      .email-heading { font-size: 22px !important; }
      .stat-row { flex-direction: column !important; }
      .btn-cta { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body>
  <!-- Preheader (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌&nbsp;‌</div>

  <div class="email-wrapper">
    <div class="email-card">
      <!-- Top accent bar -->
      <div class="accent-bar"></div>

      <!-- Header -->
      <div class="email-header">
        <a href="${BRAND.appUrl}" class="logo-lockup" style="display:inline-flex;align-items:center;gap:12px;text-decoration:none;">
          <span class="logo-mark">Q</span>
          <span class="logo-name">${BRAND.appName}</span>
        </a>
      </div>

      <!-- Body -->
      <div class="email-body">
        ${body}
      </div>

      <!-- Footer -->
      <div class="email-footer">
        <p class="footer-text">
          You're receiving this because you have an account on
          <a href="${BRAND.appUrl}" class="text-link">${BRAND.appName}</a>.
        </p>
        <p class="footer-text">
          If you have questions, visit your
          <a href="${BRAND.helpUrl}" class="text-link">profile page</a>.
        </p>
        <p class="footer-tagline">${BRAND.appName} &mdash; ${BRAND.tagline}</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

// ── Plain-text builder ──────────────────────────────────────────────

function buildPlainText(lines) {
  return [
    `${BRAND.appName} — ${BRAND.tagline}`,
    '─'.repeat(48),
    ...lines,
    '',
    '─'.repeat(48),
    `${BRAND.appName} | ${BRAND.appUrl}`,
  ].join('\n');
}

// ── Core send helper ────────────────────────────────────────────────

async function send({ to, subject, html, text }) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('Email skipped — SMTP not configured', { to, subject });
    return false;
  }

  try {
    await transport.sendMail({
      from: `"${BRAND.appName}" <${config.emailFrom}>`,
      to,
      subject,
      html,
      text,
    });
    logger.info('Email sent', { to, subject });
    return true;
  } catch (err) {
    logger.error('Email send failed', { to, subject, err: err.message });
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════════
// Email #1 — Welcome
// Triggered: authController.register() + passport.js new OAuth user
// ══════════════════════════════════════════════════════════════════════

/**
 * Send welcome email to a newly registered user.
 * @param {string} to       — recipient email
 * @param {string} name     — user's name
 * @param {'candidate'|'recruiter'|null} role — user's role (if known)
 * @param {'email'|'google'|'github'} provider — how they signed up
 */
async function sendWelcome(to, name, role = null, provider = 'email') {
  const firstName = (name || 'there').split(' ')[0];
  const providerNote = provider !== 'email'
    ? `You signed up using your ${provider.charAt(0).toUpperCase() + provider.slice(1)} account.`
    : 'Your account is secured with a password.';

  const nextSteps = role === 'recruiter'
    ? `<li>Post your first job opening</li><li>Define your hiring pipeline (screening, MCQ, tech rounds, HR)</li><li>Review AI-ranked candidates as they apply</li>`
    : role === 'candidate'
    ? `<li>Upload your resume — our AI will parse your skills automatically</li><li>Browse active job postings and apply in one click</li><li>Practice with AI interviewers to ace the real thing</li>`
    : `<li>Complete your profile setup</li><li>Explore the platform features</li><li>Connect with opportunities</li>`;

  const body = `
    <h1 class="email-heading">Welcome to ${BRAND.appName}, ${firstName}! 🎉</h1>
    <p class="email-subheading">Your account is ready. Let's get you started.</p>

    <p class="email-p">
      We're excited to have you on board. ${providerNote}
    </p>

    <div class="info-box">
      <p class="info-box-label">Signed up as</p>
      <p class="info-box-value">${to}</p>
    </div>

    <p class="email-p" style="margin-top:24px;"><strong>Here's what to do next:</strong></p>
    <ul style="color:${BRAND.textSecondary};font-size:15px;line-height:2;padding-left:20px;margin:0 0 28px;">
      ${nextSteps}
    </ul>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">Go to ${BRAND.appName} &rarr;</a>
    </div>

    <hr class="divider" />
    <p class="email-p" style="font-size:13px;color:${BRAND.textMuted};">
      If you did not create this account, please ignore this email or
      <a href="${BRAND.appUrl}/forgot-password" class="text-link">reset your password</a> to secure your account.
    </p>
  `;

  const html = buildEmail({
    preheader: `Welcome to ${BRAND.appName}, ${firstName}! Your account is ready to go.`,
    accentColor: BRAND.accent,
    body,
  });

  const text = buildPlainText([
    `Welcome to ${BRAND.appName}, ${firstName}!`,
    '',
    `Your account is ready. ${providerNote}`,
    '',
    `Get started at: ${BRAND.appUrl}`,
  ]);

  return send({
    to,
    subject: `Welcome to ${BRAND.appName}, ${firstName}! 🎉`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #2 — Password Reset
// Triggered: authController.forgotPassword()
// ══════════════════════════════════════════════════════════════════════

/**
 * Send a password reset link email.
 * @param {string} to         — recipient email
 * @param {string} resetToken — raw (unhashed) reset token
 */
async function sendPasswordReset(to, resetToken) {
  const resetUrl = `${config.corsOrigin}/reset-password?token=${resetToken}`;

  const body = `
    <h1 class="email-heading">Reset your password</h1>
    <p class="email-subheading">We received a request to reset the password on your account.</p>

    <p class="email-p">
      Click the button below to set a new password. This link expires in <strong>1 hour</strong>.
    </p>

    <div class="btn-wrap">
      <a href="${resetUrl}" class="btn-cta">Reset Password &rarr;</a>
    </div>

    <p class="url-fallback">
      Or copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" class="text-link">${resetUrl}</a>
    </p>

    <hr class="divider" />

    <div class="alert-box alert-warning">
      <strong>Didn't request this?</strong> Your password has <em>not</em> been changed. You can safely ignore this email.
      If you're concerned, <a href="${BRAND.helpUrl}" class="text-link" style="color:#fca5a5;">secure your account here</a>.
    </div>
  `;

  const html = buildEmail({
    preheader: 'Reset your Quasar password — link expires in 1 hour.',
    accentColor: BRAND.purple,
    body,
  });

  const text = buildPlainText([
    'Reset your Quasar password',
    '',
    'Click the link below to set a new password (expires in 1 hour):',
    resetUrl,
    '',
    "If you didn't request this, you can safely ignore this email.",
  ]);

  return send({
    to,
    subject: `Reset your ${BRAND.appName} password`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #3 — Password Changed Confirmation
// Triggered: authController.changePassword()
// ══════════════════════════════════════════════════════════════════════

/**
 * Send password changed security confirmation.
 * @param {string} to   — recipient email
 * @param {string} name — user's name
 */
async function sendPasswordChanged(to, name) {
  const firstName = (name || 'there').split(' ')[0];
  const timestamp = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  });

  const body = `
    <h1 class="email-heading">Password changed</h1>
    <p class="email-subheading">Your ${BRAND.appName} account password was just updated.</p>

    <p class="email-p">Hi <strong>${firstName}</strong>,</p>
    <p class="email-p">
      Your account password was successfully changed on <strong>${timestamp} IST</strong>.
      If this was you, no further action is needed.
    </p>

    <div class="alert-box alert-warning">
      <strong>Wasn't you?</strong> Someone may have access to your account.
      <a href="${config.corsOrigin}/forgot-password" class="text-link" style="color:#fca5a5;">
        Reset your password immediately &rarr;
      </a>
    </div>

    <hr class="divider" />

    <p class="email-p" style="font-size:13px;color:${BRAND.textMuted};">
      For your security, all other active sessions have been preserved.
      If you notice any suspicious activity, contact support immediately.
    </p>
  `;

  const html = buildEmail({
    preheader: `Your ${BRAND.appName} password was just changed. Wasn't you? Take action now.`,
    accentColor: BRAND.purple,
    body,
  });

  const text = buildPlainText([
    `Password changed — ${BRAND.appName}`,
    '',
    `Hi ${firstName},`,
    `Your password was changed at ${timestamp} IST.`,
    '',
    `Wasn't you? Reset it immediately: ${config.corsOrigin}/forgot-password`,
  ]);

  return send({
    to,
    subject: `Your ${BRAND.appName} password was changed`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #4 — Application Submitted Confirmation
// Triggered: applicationController.applyToJob()
// ══════════════════════════════════════════════════════════════════════

/**
 * Confirm to a candidate that their application was received.
 * @param {string} to          — candidate email
 * @param {string} name        — candidate name
 * @param {string} jobTitle    — job title
 * @param {string} company     — company name
 * @param {string} applicationId — application ID for reference
 */
async function sendApplicationSubmitted(to, name, jobTitle, company, applicationId) {
  const firstName = (name || 'there').split(' ')[0];
  const refId = applicationId ? String(applicationId).slice(-8).toUpperCase() : '—';

  const body = `
    <h1 class="email-heading">Application submitted! ✅</h1>
    <p class="email-subheading">You're in the pipeline — here's what happens next.</p>

    <p class="email-p">Hi <strong>${firstName}</strong>,</p>
    <p class="email-p">
      Your application for <strong>${jobTitle}</strong> at <strong>${company}</strong> has been received.
      Our AI is now screening your resume against the job requirements — you'll hear back shortly.
    </p>

    <div style="display:flex;gap:12px;margin:20px 0;">
      <div class="info-box" style="flex:1;margin:0;">
        <p class="info-box-label">Position</p>
        <p class="info-box-value">${jobTitle}</p>
      </div>
      <div class="info-box" style="flex:1;margin:0;">
        <p class="info-box-label">Company</p>
        <p class="info-box-value">${company}</p>
      </div>
    </div>

    <div class="info-box">
      <p class="info-box-label">Reference ID</p>
      <p class="info-box-value" style="font-family:monospace;letter-spacing:1px;">#${refId}</p>
    </div>

    <p class="email-p" style="margin-top:24px;"><strong>What happens next:</strong></p>
    <ol style="color:${BRAND.textSecondary};font-size:15px;line-height:2;padding-left:20px;margin:0 0 28px;">
      <li><strong style="color:${BRAND.textPrimary};">AI Screening</strong> — Your resume is matched against the JD</li>
      <li><strong style="color:${BRAND.textPrimary};">Assessment rounds</strong> — MCQ, technical interview, and HR</li>
      <li><strong style="color:${BRAND.textPrimary};">Decision</strong> — You'll receive an email with the outcome</li>
    </ol>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">Track your application &rarr;</a>
    </div>

    <hr class="divider" />

    <div class="alert-box alert-info">
      <strong>Tip:</strong> Use the Quasar AI Coach to prepare for your upcoming interview rounds.
      It knows your profile and can give personalised advice!
    </div>
  `;

  const html = buildEmail({
    preheader: `Application confirmed — ${jobTitle} at ${company}. AI screening in progress.`,
    accentColor: BRAND.accent,
    body,
  });

  const text = buildPlainText([
    `Application submitted — ${jobTitle} at ${company}`,
    '',
    `Hi ${firstName},`,
    `Your application (Ref: #${refId}) has been received and AI screening is in progress.`,
    '',
    `Track your application at: ${BRAND.appUrl}`,
  ]);

  return send({
    to,
    subject: `Application submitted — ${jobTitle} at ${company}`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #5 — Screening Result
// Triggered: applicationController.applyToJob() after AI screening
// ══════════════════════════════════════════════════════════════════════

/**
 * Notify candidate of their AI screening result.
 * @param {string}  to           — candidate email
 * @param {string}  name         — candidate name
 * @param {string}  jobTitle     — job title
 * @param {string}  company      — company name
 * @param {boolean} passed       — whether they passed screening
 * @param {number}  matchScore   — 0–100 match percentage
 * @param {string}  nextStepLabel — e.g. 'MCQ Assessment', 'Technical Interview', 'HR Interview'
 */
async function sendScreeningResult(to, name, jobTitle, company, passed, matchScore, nextStepLabel = '') {
  const firstName = (name || 'there').split(' ')[0];
  const scoreColor = passed ? BRAND.success : BRAND.error;
  const pillClass = passed ? 'pill-success' : 'pill-error';
  const pillText = passed ? '✓ Screening Passed' : '✗ Screening Failed';

  const passedBody = `
    <p class="email-p">
      Great news! Your resume matched <strong>${matchScore}%</strong> of the requirements for
      <strong>${jobTitle}</strong> at <strong>${company}</strong>.
    </p>

    <div style="display:flex;gap:12px;margin:20px 0;">
      <div class="info-box" style="flex:1;margin:0;text-align:center;">
        <p class="info-box-label">Match Score</p>
        <p class="stat-value" style="color:${scoreColor};font-size:32px;font-weight:900;margin:4px 0 0;">${matchScore}%</p>
      </div>
      <div class="info-box" style="flex:1;margin:0;text-align:center;">
        <p class="info-box-label">Status</p>
        <p style="margin:6px 0 0;"><span class="pill pill-success">${pillText}</span></p>
      </div>
    </div>

    <p class="email-p">
      You've been advanced to the next round: <strong>${nextStepLabel || 'next assessment'}</strong>.
      Log in to ${BRAND.appName} to continue.
    </p>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">Continue to ${nextStepLabel || 'next round'} &rarr;</a>
    </div>

    <div class="alert-box alert-info">
      <strong>Prep tip:</strong> Use the Quasar AI Coach to practice for your ${nextStepLabel || 'upcoming round'}.
      It has access to your profile and can simulate the interview experience.
    </div>
  `;

  const failedBody = `
    <p class="email-p">
      Thank you for applying to <strong>${jobTitle}</strong> at <strong>${company}</strong>.
      After reviewing your resume against the job requirements (match score: <strong>${matchScore}%</strong>),
      we were unable to advance your application at this time.
    </p>

    <div style="display:flex;gap:12px;margin:20px 0;">
      <div class="info-box" style="flex:1;margin:0;text-align:center;">
        <p class="info-box-label">Match Score</p>
        <p class="stat-value" style="color:${scoreColor};font-size:32px;font-weight:900;margin:4px 0 0;">${matchScore}%</p>
      </div>
      <div class="info-box" style="flex:1;margin:0;text-align:center;">
        <p class="info-box-label">Status</p>
        <p style="margin:6px 0 0;"><span class="pill pill-error">${pillText}</span></p>
      </div>
    </div>

    <p class="email-p">
      We encourage you to update your resume and skills, then explore other active openings on the platform
      that may be a better fit.
    </p>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">Browse other jobs &rarr;</a>
    </div>

    <div class="alert-box alert-info">
      <strong>Grow your skills:</strong> Use the Quasar AI Coach to identify skill gaps and get a
      personalised improvement plan based on your profile.
    </div>
  `;

  const body = `
    <h1 class="email-heading">${passed ? 'Screening passed! 🎉' : 'Screening update'}</h1>
    <p class="email-subheading">${passed ? 'You\'re moving forward in the hiring pipeline.' : `Your application for ${jobTitle} at ${company}.`}</p>

    <p class="email-p">Hi <strong>${firstName}</strong>,</p>
    ${passed ? passedBody : failedBody}
  `;

  const html = buildEmail({
    preheader: passed
      ? `You passed screening for ${jobTitle} at ${company} with ${matchScore}% match!`
      : `Screening update for your ${jobTitle} application at ${company}.`,
    accentColor: passed ? BRAND.accent : BRAND.purple,
    body,
  });

  const text = buildPlainText([
    passed ? `Screening passed — ${jobTitle} at ${company}` : `Screening update — ${jobTitle} at ${company}`,
    '',
    `Hi ${firstName},`,
    passed
      ? `You passed screening with a ${matchScore}% match score! Next step: ${nextStepLabel || 'review your application'}.`
      : `Your application achieved a ${matchScore}% match score and was not advanced at this time.`,
    '',
    `Log in at: ${BRAND.appUrl}`,
  ]);

  return send({
    to,
    subject: passed
      ? `✅ You passed screening — ${jobTitle} at ${company}`
      : `Screening update — ${jobTitle} at ${company}`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #6 — Final Pipeline Notification (Selection / Rejection)
// Triggered: dashboardController.shortlistCandidate()
// ══════════════════════════════════════════════════════════════════════

/**
 * Send final outcome notification to a candidate.
 * @param {string} to            — candidate email
 * @param {string} candidateName — candidate's full name
 * @param {string} jobTitle      — job title
 * @param {string} company       — company name
 * @param {'selected'|'rejected'} outcome — final outcome
 */
async function sendPipelineNotification(to, candidateName, jobTitle, company, outcome) {
  const firstName = (candidateName || 'there').split(' ')[0];
  const isSelected = outcome === 'selected';

  const selectedBody = `
    <h1 class="email-heading">Congratulations, ${firstName}! 🎉</h1>
    <p class="email-subheading">You've been selected for ${jobTitle} at ${company}.</p>

    <p class="email-p">Hi <strong>${firstName}</strong>,</p>
    <p class="email-p">
      We're thrilled to inform you that you've been <strong>selected</strong> for the
      <strong>${jobTitle}</strong> position at <strong>${company}</strong>.
    </p>

    <div class="alert-box alert-success">
      🎊 The hiring team was impressed with your performance across all assessment stages.
      You stood out from the competition!
    </div>

    <div style="display:flex;gap:12px;margin:20px 0;">
      <div class="info-box" style="flex:1;margin:0;">
        <p class="info-box-label">Position</p>
        <p class="info-box-value">${jobTitle}</p>
      </div>
      <div class="info-box" style="flex:1;margin:0;">
        <p class="info-box-label">Company</p>
        <p class="info-box-value">${company}</p>
      </div>
    </div>

    <p class="email-p">
      The hiring team will be reaching out to you shortly with next steps, including offer details and onboarding information.
      Please keep an eye on your email and phone.
    </p>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">View your offer details &rarr;</a>
    </div>
  `;

  const rejectedBody = `
    <h1 class="email-heading">Application update</h1>
    <p class="email-subheading">An update on your application for ${jobTitle} at ${company}.</p>

    <p class="email-p">Hi <strong>${firstName}</strong>,</p>
    <p class="email-p">
      Thank you for the time and effort you invested in the hiring process for
      <strong>${jobTitle}</strong> at <strong>${company}</strong>.
      After careful evaluation of all candidates, we've decided to move forward with another applicant at this time.
    </p>

    <p class="email-p">
      This is not a reflection of your skills or potential — the competition was strong, and we encourage
      you to continue applying to other roles that match your profile.
    </p>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}" class="btn-cta">Browse other opportunities &rarr;</a>
    </div>

    <div class="alert-box alert-info">
      <strong>Keep growing:</strong> Use the Quasar AI Coach and Interview modules to sharpen your skills
      for your next application.
    </div>
  `;

  const html = buildEmail({
    preheader: isSelected
      ? `🎉 Congratulations! You've been selected for ${jobTitle} at ${company}.`
      : `An update on your ${jobTitle} application at ${company}.`,
    accentColor: isSelected ? BRAND.success : BRAND.purple,
    body: isSelected ? selectedBody : rejectedBody,
  });

  const text = buildPlainText(
    isSelected
      ? [
          `Congratulations, ${firstName}!`,
          '',
          `You've been selected for ${jobTitle} at ${company}.`,
          `The team will be in touch with next steps.`,
          '',
          BRAND.appUrl,
        ]
      : [
          `Application update — ${jobTitle} at ${company}`,
          '',
          `Hi ${firstName},`,
          `After careful review, we've moved forward with another candidate at this time.`,
          `We encourage you to apply to other openings.`,
          '',
          BRAND.appUrl,
        ]
  );

  return send({
    to,
    subject: isSelected
      ? `🎉 You've been selected — ${jobTitle} at ${company}`
      : `Application update — ${jobTitle} at ${company}`,
    html,
    text,
  });
}

// ══════════════════════════════════════════════════════════════════════
// Email #7 — Study Plan Daily Reminder
// Triggered: studyPlanCron.js daily at 8 AM IST
// ══════════════════════════════════════════════════════════════════════

/**
 * Send a daily study plan reminder email.
 * @param {string}  to          — recipient email
 * @param {string}  name        — user name
 * @param {string}  skillName   — what they're learning
 * @param {object}  dayEntry    — { day, focus, resource }
 * @param {object}  progress    — { week, dayIndex, totalDays, completedDays, progressPct }
 */
async function sendStudyPlanReminder(to, name, skillName, dayEntry, progress) {
  const firstName = (name || 'there').split(' ')[0];
  const dayLabel = dayEntry.day || 'Today';
  const focusTopic = dayEntry.focus || 'Continue your studies';
  const resource = dayEntry.resource && dayEntry.resource !== '-'
    ? dayEntry.resource
    : null;

  const progressBarWidth = Math.max(progress.progressPct, 3); // min 3% for visibility

  const body = `
    <h1 class="email-heading">📖 Today's Study Focus</h1>
    <p class="email-subheading">Week ${progress.week} · ${dayLabel} — ${skillName}</p>

    <p class="email-p">Hey <strong>${firstName}</strong>, here's what to focus on today:</p>

    <div class="info-box" style="border-left:4px solid ${BRAND.accent};">
      <p class="info-box-label">Today's Topic</p>
      <p class="info-box-value" style="font-size:18px;">${focusTopic}</p>
    </div>

    ${resource ? `
    <div class="info-box">
      <p class="info-box-label">Recommended Resource</p>
      <p class="info-box-value">
        ${resource.startsWith('http')
          ? `<a href="${resource}" class="text-link" style="font-size:15px;">${resource}</a>`
          : resource
        }
      </p>
    </div>
    ` : ''}

    <!-- Progress bar -->
    <div style="margin:24px 0;">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
        <span style="font-size:12px;font-weight:700;color:${BRAND.textSecondary};">PROGRESS</span>
        <span style="font-size:12px;font-weight:700;color:${BRAND.accent};">${progress.progressPct}%</span>
      </div>
      <div style="height:8px;background:${BRAND.bg};border:1px solid ${BRAND.surfaceBorder};border-radius:99px;overflow:hidden;">
        <div style="width:${progressBarWidth}%;height:100%;background:linear-gradient(90deg,${BRAND.accent},${BRAND.accentAlt});border-radius:99px;"></div>
      </div>
      <p style="font-size:12px;color:${BRAND.textMuted};margin-top:6px;">
        Day ${progress.dayIndex} of ${progress.totalDays} · ${progress.completedDays} days completed
      </p>
    </div>

    <div class="btn-wrap">
      <a href="${BRAND.appUrl}/study-plan" class="btn-cta">Open Study Plan &rarr;</a>
    </div>

    <hr class="divider" />

    <div class="alert-box alert-info">
      <strong>💡 Tip:</strong> Consistency beats intensity. Even 30 minutes of focused study today
      will keep your momentum strong. Mark this day as done when you're finished!
    </div>
  `;

  const html = buildEmail({
    preheader: `Study reminder: ${focusTopic} — Week ${progress.week}, ${dayLabel}`,
    accentColor: BRAND.accent,
    body,
  });

  const text = buildPlainText([
    `📖 Today's Study Focus — ${skillName}`,
    `Week ${progress.week}, ${dayLabel}`,
    '',
    `Topic: ${focusTopic}`,
    resource ? `Resource: ${resource}` : '',
    '',
    `Progress: Day ${progress.dayIndex}/${progress.totalDays} (${progress.progressPct}%)`,
    '',
    `Open your plan: ${BRAND.appUrl}/study-plan`,
  ]);

  return send({
    to,
    subject: `📖 Day ${progress.dayIndex}: ${focusTopic} — ${skillName}`,
    html,
    text,
  });
}

// ── Exports ─────────────────────────────────────────────────────────

module.exports = {
  sendWelcome,
  sendPasswordReset,
  sendPasswordChanged,
  sendApplicationSubmitted,
  sendScreeningResult,
  sendPipelineNotification,
  sendStudyPlanReminder,
};

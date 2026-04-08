const nodemailer = require('nodemailer');
const config = require('../config/env');
const logger = require('../utils/logger');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (!config.smtpUser || !config.smtpPass) {
    logger.warn('SMTP credentials not configured — email sending will be skipped');
    return null;
  }

  transporter = nodemailer.createTransport({
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

  return transporter;
}

/**
 * Send a password reset email with a tokenized link.
 * @param {string} to  - recipient email address
 * @param {string} resetToken - raw (unhashed) reset token
 * @returns {Promise<boolean>} - true if sent, false if SMTP not configured
 */
async function sendPasswordReset(to, resetToken) {
  const transport = getTransporter();
  if (!transport) return false;

  const resetUrl = `${config.corsOrigin}/reset-password?token=${resetToken}`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d14; color: #e2e8f0; margin: 0; padding: 40px 20px; }
    .card { max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { width: 48px; height: 48px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; margin-bottom: 24px; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p { font-size: 14px; line-height: 1.7; color: #94a3b8; margin: 0 0 24px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; text-decoration: none; padding: 14px 28px; border-radius: 10px; font-weight: 600; font-size: 14px; }
    .note { font-size: 12px; color: #64748b; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); }
    .url { word-break: break-all; font-size: 12px; color: #6366f1; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">AI</div>
    <h1>Reset your password</h1>
    <p>We received a request to reset the password for your Interview Quasar account. Click the button below to set a new password. This link expires in <strong>1 hour</strong>.</p>
    <a href="${resetUrl}" class="btn">Reset Password</a>
    <div class="note">
      <p style="margin:0 0 8px">If you didn't request this, you can safely ignore this email — your password will not change.</p>
      <p style="margin:0">Or copy this link: <span class="url">${resetUrl}</span></p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"Interview Quasar" <${config.emailFrom}>`,
      to,
      subject: 'Reset your Interview Quasar password',
      html,
    });
    logger.info('Password reset email sent', { to });
    return true;
  } catch (err) {
    logger.error('Failed to send password reset email', { err: err.message });
    return false;
  }
}



/**
 * Send a pipeline notification email to a candidate.
 * Used for final selection/rejection notifications.
 * @param {string} to — recipient email
 * @param {string} candidateName — candidate's name
 * @param {string} jobTitle — job title they applied for
 * @param {string} company — company name
 * @param {'selected' | 'rejected'} outcome — final outcome
 * @returns {Promise<boolean>}
 */
async function sendPipelineNotification(to, candidateName, jobTitle, company, outcome) {
  const transport = getTransporter();
  if (!transport) return false;

  const isSelected = outcome === 'selected';
  const subject = isSelected
    ? `🎉 Congratulations! You've been selected for ${jobTitle}`
    : `Update on your application for ${jobTitle}`;

  const heading = isSelected
    ? 'You\'ve been selected!'
    : 'Application Update';

  const message = isSelected
    ? `We're thrilled to inform you that you've been <strong>selected</strong> for the <strong>${jobTitle}</strong> position at <strong>${company}</strong>. The hiring team was impressed with your performance across all stages. We'll be in touch shortly with next steps.`
    : `Thank you for your interest in the <strong>${jobTitle}</strong> position at <strong>${company}</strong>. After careful evaluation, we've decided to move forward with other candidates. We encourage you to apply for future openings.`;

  const accentColor = isSelected ? '#22c55e' : '#6366f1';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d14; color: #e2e8f0; margin: 0; padding: 40px 20px; }
    .card { max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
    .logo { width: 48px; height: 48px; background: linear-gradient(135deg, ${accentColor}, #fb923c); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 14px; margin-bottom: 24px; color: white; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
    p { font-size: 14px; line-height: 1.7; color: #94a3b8; margin: 0 0 24px; }
    .greeting { font-size: 14px; color: #e2e8f0; margin-bottom: 16px; }
    .note { font-size: 12px; color: #64748b; margin-top: 24px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">Q</div>
    <h1>${heading}</h1>
    <p class="greeting">Hi ${candidateName},</p>
    <p>${message}</p>
    <div class="note">
      <p style="margin:0">This is an automated notification from the Quasar Recruitment Platform.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"Quasar Recruitment" <${config.emailFrom}>`,
      to,
      subject,
      html,
    });
    logger.info('Pipeline notification email sent', { to, outcome, jobTitle });
    return true;
  } catch (err) {
    logger.error('Failed to send pipeline notification email', { err: err.message });
    return false;
  }
}

module.exports = { sendPasswordReset, sendPipelineNotification };


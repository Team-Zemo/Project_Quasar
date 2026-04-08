package com.teamzemo.quasar.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    private static final Logger log = LoggerFactory.getLogger(EmailService.class);

    private final JavaMailSender mailSender;

    @Value("${app.frontend-url}")
    private String frontendUrl;

    @Value("${spring.mail.username:}")
    private String from;

    public EmailService(JavaMailSender mailSender) {
        this.mailSender = mailSender;
    }

    /**
     * Sends a styled HTML password-reset email with a tokenized link.
     * Matches the Express emailService.js template exactly.
     */
    public boolean sendPasswordReset(String to, String rawToken) {
        try {
            String resetUrl = frontendUrl + "/reset-password?token=" + rawToken;

            String html = """
                <!DOCTYPE html>
                <html>
                <head>
                  <meta charset="UTF-8">
                  <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                           background: #0d0d14; color: #e2e8f0; margin: 0; padding: 40px 20px; }
                    .card { max-width: 480px; margin: 0 auto; background: rgba(255,255,255,0.05);
                            border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; padding: 40px; }
                    h1 { font-size: 22px; font-weight: 700; margin: 0 0 8px; }
                    p { font-size: 14px; line-height: 1.7; color: #94a3b8; margin: 0 0 24px; }
                    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                           color: #fff; text-decoration: none; padding: 14px 28px;
                           border-radius: 10px; font-weight: 600; font-size: 14px; }
                    .note { font-size: 12px; color: #64748b; margin-top: 24px;
                            padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); }
                    .url { word-break: break-all; font-size: 12px; color: #6366f1; }
                  </style>
                </head>
                <body>
                  <div class="card">
                    <h1>Reset your password</h1>
                    <p>We received a request to reset the password for your Quasar account.
                       Click the button below to set a new password.
                       This link expires in <strong>1 hour</strong>.</p>
                    <a href="%s" class="btn">Reset Password</a>
                    <div class="note">
                      <p style="margin:0 0 8px">If you didn't request this, you can safely ignore this email — your password will not change.</p>
                      <p style="margin:0">Or copy this link: <span class="url">%s</span></p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(resetUrl, resetUrl);

            MimeMessage message = mailSender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");
            helper.setFrom("\"Interview Quasar\" <" + from + ">");
            helper.setTo(to);
            helper.setSubject("Reset your Interview Quasar password");
            helper.setText(html, true);

            mailSender.send(message);
            log.info("Password reset email sent to {}", to);
            return true;

        } catch (MessagingException e) {
            log.error("Failed to send password reset email to {}: {}", to, e.getMessage());
            return false;
        }
    }
}

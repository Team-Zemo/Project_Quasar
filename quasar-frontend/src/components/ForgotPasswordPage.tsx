import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../lib/auth';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');
    try {
      const result = await forgotPassword(email);
      if (result.success) {
        setStatus('sent');
        setMessage(result.message);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    } catch {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="topnav__logo" style={{ width: 48, height: 48, fontSize: 14 }}>AI</div>
          <h1 className="auth-card__title">Forgot Password</h1>
          <p className="auth-card__subtitle">Enter your email and we'll send you a reset link</p>
        </div>

        {status === 'sent' ? (
          <div className="auth-success-state">
            <div className="auth-success-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 6 6l1.27-.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              </svg>
            </div>
            <h2 className="auth-success-title">Check your inbox</h2>
            <p className="auth-success-text">
              {message || 'If that email is registered, a reset link has been sent. Check your spam folder if you don\'t see it within a few minutes.'}
            </p>
            <Link to="/login" className="btn-primary btn-full" style={{ marginTop: 24, display: 'block', textAlign: 'center' }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label htmlFor="forgot-email" className="form-label">Email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            {status === 'error' && (
              <div className="error-box" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {message}
              </div>
            )}

            <button type="submit" id="forgot-submit" className="btn-primary btn-full" disabled={status === 'loading'}>
              {status === 'loading' ? <><div className="spinner" />Sending…</> : 'Send Reset Link'}
            </button>

            <p className="auth-footer-text" style={{ marginTop: 16 }}>
              Remember it? <Link to="/login" className="auth-link">Sign in</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}

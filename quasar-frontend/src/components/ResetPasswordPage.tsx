import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../lib/auth';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  // Derive token validity without a side-effect
  const tokenError = !token ? 'Invalid or missing reset token. Please request a new reset link.' : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitStatus('loading');
    try {
      const result = await resetPassword(token, password);
      if (result.success) {
        setSubmitStatus('success');
        setTimeout(() => navigate('/login'), 2500);
      } else {
        setError(result.message);
        setSubmitStatus('idle');
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setSubmitStatus('idle');
    }
  };

  if (submitStatus === 'success') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-success-state">
            <div className="auth-success-icon auth-success-icon--green">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <h2 className="auth-success-title">Password reset!</h2>
            <p className="auth-success-text">Your password has been updated. Redirecting you to sign in…</p>
          </div>
        </div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-card__header">
            <div className="topnav__logo" style={{ width: 48, height: 48, fontSize: 14 }}>AI</div>
            <h1 className="auth-card__title">Invalid Link</h1>
          </div>
          <div className="error-box" role="alert" style={{ marginBottom: 20 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {tokenError}
          </div>
          <Link to="/forgot-password" className="btn-primary btn-full" style={{ display: 'block', textAlign: 'center' }}>
            Request New Link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-card__header">
          <div className="topnav__logo" style={{ width: 48, height: 48, fontSize: 14 }}>AI</div>
          <h1 className="auth-card__title">Set New Password</h1>
          <p className="auth-card__subtitle">Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="reset-password" className="form-label">New Password</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input"
              placeholder="Min. 8 characters"
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <label htmlFor="reset-confirm" className="form-label">Confirm Password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="form-input"
              placeholder="Repeat new password"
              required
            />
          </div>

          {error && (
            <div className="error-box" role="alert">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" id="reset-submit" className="btn-primary btn-full" disabled={submitStatus === 'loading'}>
            {submitStatus === 'loading' ? <><div className="spinner" />Resetting…</> : 'Reset Password'}
          </button>

          <p className="auth-footer-text" style={{ marginTop: 16 }}>
            <Link to="/login" className="auth-link">Back to Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

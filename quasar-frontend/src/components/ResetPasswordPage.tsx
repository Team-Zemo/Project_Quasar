import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { resetPassword } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';

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

  const handleSubmit = async (e: FormEvent) => {
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

  const containerStyle = { padding: '16px' };
  const cardStyle = { padding: '40px' };
  const inputStyle = { padding: '14px 16px' };
  const alertStyle = { padding: '12px 16px' };
  const buttonStyle = { padding: '14px 24px' };

  if (submitStatus === 'success') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--c-bg)]" style={containerStyle}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-lg flex flex-col items-center text-center"
          style={cardStyle}
        >
          <motion.div 
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            className="w-[64px] h-[64px] rounded-full bg-[var(--c-success-dim)] border border-green-500/20 text-[var(--c-success)] flex items-center justify-center mb-5"
          >
            <CheckCircle2 size={32} strokeWidth={2.5} />
          </motion.div>
          <h2 className="text-[20px] font-bold text-[var(--c-text)] mb-3 m-0">Password reset!</h2>
          <p className="text-[14px] text-[var(--c-text-dim)] leading-relaxed m-0 pb-4">
            Your password has been updated. Redirecting you to sign in…
          </p>
        </motion.div>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[var(--c-bg)]" style={containerStyle}>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-[440px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-lg flex flex-col"
          style={cardStyle}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-[48px] h-[48px] flex items-center justify-center rounded-[14px] bg-[var(--c-accent-dim)] border border-[var(--c-accent-glow)] text-[var(--c-accent)] font-black text-[15px] mb-5 shadow-sm">
              AI
            </div>
            <h1 className="text-[24px] font-extrabold text-[var(--c-text)] m-0 mb-2">Invalid Link</h1>
          </div>
          
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px] mb-8" style={alertStyle} role="alert">
            <AlertCircle size={16} strokeWidth={2.5} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">{tokenError}</span>
          </div>
          
          <Link to="/forgot-password" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer no-underline" style={buttonStyle}>
            Request New Link
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--c-bg)]" style={containerStyle}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-[440px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-lg flex flex-col"
        style={cardStyle}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-[48px] h-[48px] flex items-center justify-center rounded-[14px] bg-[var(--c-accent-dim)] border border-[var(--c-accent-glow)] text-[var(--c-accent)] font-black text-[15px] mb-5 tracking-tight shadow-sm">
            AI
          </div>
          <h1 className="text-[24px] font-extrabold text-[var(--c-text)] m-0 mb-2 tracking-tight">Set New Password</h1>
          <p className="text-[14px] text-[var(--c-text-dim)] m-0">Choose a strong password for your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          <div className="flex flex-col gap-2">
            <label htmlFor="reset-password" className="text-[13px] font-semibold text-[var(--c-text)]">New Password</label>
            <input
              id="reset-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={inputStyle}
              placeholder="Min. 8 characters"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="reset-confirm" className="text-[13px] font-semibold text-[var(--c-text)]">Confirm Password</label>
            <input
              id="reset-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={inputStyle}
              placeholder="Repeat new password"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px]" style={alertStyle} role="alert">
              <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" id="reset-submit" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer mt-1" style={buttonStyle} disabled={submitStatus === 'loading'}>
            {submitStatus === 'loading' ? <><Loader2 size={18} className="animate-spin" /> Resetting…</> : 'Reset Password'}
          </button>

          <p className="text-center mt-6 mb-0">
            <Link to="/login" className="text-[13px] text-[var(--c-text-mute)] font-medium hover:text-[var(--c-text)] hover:underline transition-colors">
              Back to Sign In
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Send } from 'lucide-react';

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
    <div className="flex items-center justify-center min-h-screen bg-[var(--c-bg)]" style={{ padding: '16px' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-[440px] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-lg flex flex-col"
        style={{ padding: '40px' }}
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-[48px] h-[48px] flex items-center justify-center rounded-[14px] bg-[var(--c-accent-dim)] border border-[var(--c-accent-glow)] text-[var(--c-accent)] font-black text-[15px] mb-5 tracking-tight shadow-sm">
            AI
          </div>
          <h1 className="text-[24px] font-extrabold text-[var(--c-text)] m-0 mb-2 tracking-tight">Forgot Password</h1>
          <p className="text-[14px] text-[var(--c-text-dim)] m-0">Enter your email and we'll send you a reset link</p>
        </div>

        {status === 'sent' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center pb-2"
          >
            <div className="w-[64px] h-[64px] rounded-full bg-[var(--c-success-dim)] border border-green-500/20 text-[var(--c-success)] flex items-center justify-center mb-5">
              <Send size={28} strokeWidth={2.5} className="ml-[-2px] mt-[2px]" />
            </div>
            <h2 className="text-[20px] font-bold text-[var(--c-text)] mb-3 m-0">Check your inbox</h2>
            <p className="text-[14px] text-[var(--c-text-dim)] leading-relaxed max-w-[320px] m-0">
              {message || 'If that email is registered, a reset link has been sent. Check your spam folder if you don\'t see it within a few minutes.'}
            </p>
            <Link to="/login" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer mt-8 no-underline" style={{ padding: '14px 24px' }}>
              Back to Sign In
            </Link>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
            <div className="flex flex-col gap-2">
              <label htmlFor="forgot-email" className="text-[13px] font-semibold text-[var(--c-text)]">Email address</label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
                style={{ padding: '14px 16px' }}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            {status === 'error' && (
              <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px]" style={{ padding: '12px 16px' }} role="alert">
                <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
                {message}
              </div>
            )}

            <button type="submit" id="forgot-submit" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer mt-1" style={{ padding: '14px 24px' }} disabled={status === 'loading'}>
              {status === 'loading' ? <><Loader2 size={18} className="animate-spin" /> Sending…</> : 'Send Reset Link'}
            </button>

            <p className="text-center mt-4 mb-0 text-[13px] text-[var(--c-text-mute)] font-medium">
              Remember it? <Link to="/login" className="text-[var(--c-text)] font-bold hover:underline">Sign in</Link>
            </p>
          </form>
        )}
      </motion.div>
    </div>
  );
}

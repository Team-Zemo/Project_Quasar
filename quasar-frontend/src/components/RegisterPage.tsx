import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    setLoading(true);

    try {
      const result = await register(email, password, name);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
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
          <h1 className="text-[24px] font-extrabold text-[var(--c-text)] m-0 mb-2 tracking-tight">Create Account</h1>
          <p className="text-[14px] text-[var(--c-text-dim)] m-0">Start your AI interview practice journey</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
          <div className="flex flex-col gap-2">
            <label htmlFor="register-name" className="text-[13px] font-semibold text-[var(--c-text)]">Full Name</label>
            <input
              id="register-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={{ padding: '14px 16px' }}
              placeholder="John Doe"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-email" className="text-[13px] font-semibold text-[var(--c-text)]">Email</label>
            <input
              id="register-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={{ padding: '14px 16px' }}
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-password" className="text-[13px] font-semibold text-[var(--c-text)]">Password</label>
            <input
              id="register-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={{ padding: '14px 16px' }}
              placeholder="Min 8 characters"
              required
              minLength={8}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="register-confirm" className="text-[13px] font-semibold text-[var(--c-text)]">Confirm Password</label>
            <input
              id="register-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
              style={{ padding: '14px 16px' }}
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px]" style={{ padding: '12px 16px' }} role="alert">
              <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
              {error}
            </div>
          )}

          <button type="submit" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer mt-1" style={{ padding: '14px 24px' }} disabled={loading}>
            {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account…</> : 'Create Account'}
          </button>
        </form>

        <p className="text-center mt-8 mb-0 text-[13px] text-[var(--c-text-mute)] font-medium">
          Already have an account? <Link to="/login" className="text-[var(--c-text)] font-bold hover:underline">Sign in</Link>
        </p>
      </motion.div>
    </div>
  );
}

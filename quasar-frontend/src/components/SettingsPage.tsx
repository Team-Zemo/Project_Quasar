import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { changePassword, fetchProfile } from '../lib/auth';
import type { User } from '../lib/auth';
import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { ChevronLeft, User as UserIcon, Lock, CheckCircle2, AlertCircle, Info, Loader2 } from 'lucide-react';

export function SettingsPage() {
  const [profile, setProfile] = useState<User | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchProfile().then((p) => {
      setProfile(p);
      setProfileLoading(false);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }
    if (currentPassword === newPassword) {
      setError('New password must be different from your current password');
      return;
    }

    setLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setSuccess('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        // Refresh profile so hasPassword reflects new state
        fetchProfile().then(setProfile);
      } else {
        setError(result.message);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const providers = profile?.linkedProviders ?? [];
  const hasGoogle = providers.includes('google');
  const hasGitHub = providers.includes('github');
  const hasPassword = profile?.hasPassword ?? false;

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-[var(--c-bg)]" style={{ padding: '64px 20px' }}>
      <motion.div 
        variants={containerVariants} initial="hidden" animate="show"
        className="max-w-[560px] w-full mx-auto flex flex-col gap-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="flex flex-col mb-4">
          <Link to="/" className="inline-flex items-center gap-2 text-[13px] font-medium text-[var(--c-text-dim)] hover:text-[var(--c-text)] transition-colors mb-6">
            <ChevronLeft size={16} strokeWidth={2.5} />
            Back
          </Link>
          <h1 className="text-[28px] font-extrabold tracking-tight text-[var(--c-text)] mb-2 m-0">Account Settings</h1>
          <p className="text-[14px] text-[var(--c-text-dim)] m-0">Manage your account security and preferences</p>
        </motion.div>

        {/* Profile info card */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm" style={{ padding: '24px' }}>
          <div className="w-[48px] h-[48px] rounded-[14px] bg-[var(--c-accent-dim)] border border-[var(--c-accent-glow)] flex items-center justify-center text-[var(--c-accent)] shrink-0">
            <UserIcon size={24} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold text-[var(--c-text)] mb-1 m-0">Profile</h2>
            {profileLoading ? (
              <div className="flex items-center gap-2 text-[13px] text-[var(--c-text-dim)] mt-4">
                <Loader2 size={16} className="animate-spin text-[var(--c-accent)]" />
                <span>Loading…</span>
              </div>
            ) : (
              <div className="flex flex-col gap-1 mt-4">
                <div className="flex items-center gap-3 text-[13px] py-3 border-b border-[var(--c-border)]">
                  <span className="w-[110px] shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">Name</span>
                  <span className="text-[14px] font-medium text-[var(--c-text)] break-all">{profile?.name ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] py-3 border-b border-[var(--c-border)]">
                  <span className="w-[110px] shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">Email</span>
                  <span className="text-[14px] font-medium text-[var(--c-text)] break-all">{profile?.email ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3 text-[13px] py-3 border-b border-[var(--c-border)]">
                  <span className="w-[110px] shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">Password</span>
                  <span className="flex flex-wrap gap-2 items-center text-[14px]">
                    {hasPassword ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-bold tracking-wide bg-[var(--c-success-dim)] border border-green-500/20 text-[var(--c-success)]">
                        <CheckCircle2 size={12} strokeWidth={3} />
                        Set
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-[var(--c-text-mute)]">
                        Not set
                      </span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[13px] py-3">
                  <span className="w-[110px] shrink-0 text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)]">Linked accounts</span>
                  <span className="flex flex-wrap gap-2 items-center text-[14px]">
                    {hasGoogle && (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold tracking-wide bg-white/5 border border-white/10 text-[var(--c-text)]">
                        <svg width="14" height="14" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google
                      </span>
                    )}
                    {hasGitHub && (
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px] text-[12px] font-semibold tracking-wide bg-white/5 border border-white/10 text-[var(--c-text)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        GitHub
                      </span>
                    )}
                    {!hasGoogle && !hasGitHub && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] text-[11px] font-bold tracking-wide bg-white/5 border border-white/10 text-[var(--c-text-mute)]">None</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Change Password Card */}
        <motion.div variants={itemVariants} className="flex flex-col md:flex-row gap-5 bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] shadow-sm" style={{ padding: '24px' }}>
          <div className="w-[48px] h-[48px] rounded-[14px] bg-[var(--c-surface-2)] border border-[var(--c-border)] flex items-center justify-center text-[var(--c-text-mute)] shrink-0">
            <Lock size={22} strokeWidth={2} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[18px] font-bold text-[var(--c-text)] mb-2 m-0">Change Password</h2>
            <p className="text-[13px] text-[var(--c-text-dim)] leading-relaxed m-0">
              {hasPassword
                ? "Update your password. You'll stay signed in on this device."
                : 'You haven\'t set a password yet. Use the form below or Forgot Password to create one.'}
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6 w-full">
              {hasPassword && (
                <div className="flex flex-col gap-2">
                  <label htmlFor="current-password" className="text-[13px] font-semibold text-[var(--c-text)]">Current Password</label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
                    style={{ padding: '14px 16px' }}
                    placeholder="Your current password"
                    required
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div className="flex flex-col gap-2">
                <label htmlFor="new-password" className="text-[13px] font-semibold text-[var(--c-text)]">
                  {hasPassword ? 'New Password' : 'Set Password'}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
                  style={{ padding: '14px 16px' }}
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="confirm-new-password" className="text-[13px] font-semibold text-[var(--c-text)]">Confirm Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] transition-all focus:border-[var(--c-accent)] focus:ring-4 focus:ring-[var(--c-accent-dim)] outline-none"
                  style={{ padding: '14px 16px' }}
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px]" style={{ padding: '12px 16px' }} role="alert">
                  <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
                  {error}
                </div>
              )}

              {success && (
                <div className="flex items-center gap-2 bg-[var(--c-success-dim)] border border-green-500/20 text-[var(--c-success)] text-[13px] font-semibold rounded-[12px]" style={{ padding: '12px 16px' }} role="status">
                  <CheckCircle2 size={16} strokeWidth={2.5} className="shrink-0" />
                  {success}
                </div>
              )}

              <button type="submit" id="change-password-submit" className="flex items-center justify-center gap-2 w-full bg-[var(--c-text)] hover:bg-white text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] transition-all cursor-pointer mt-2" style={{ padding: '14px 24px' }} disabled={loading}>
                {loading ? <><Loader2 size={18} className="animate-spin" /> Updating…</> : hasPassword ? 'Update Password' : 'Set Password'}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Hint */}
        <motion.div variants={itemVariants} className="flex items-start gap-3 text-[12px] text-[var(--c-text-mute)] bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[16px] leading-relaxed shadow-sm" style={{ padding: '16px' }}>
          <Info size={16} strokeWidth={2.5} className="shrink-0 mt-0.5 opacity-60" />
          <span>
            Alternatively, you can use{' '}
            <Link to="/forgot-password" className="text-[var(--c-accent)] font-semibold hover:underline">Forgot Password</Link>{' '}
            to receive a reset link by email.
          </span>
        </motion.div>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { changePassword, fetchProfile } from '../lib/auth';
import type { User } from '../lib/auth';

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

  return (
    <div className="settings-page">
      <div className="settings-container">

        {/* Header */}
        <div className="settings-header">
          <Link to="/" className="settings-back">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back
          </Link>
          <h1 className="settings-title">Account Settings</h1>
          <p className="settings-subtitle">Manage your account security and preferences</p>
        </div>

        {/* Profile info card */}
        <div className="settings-card">
          <div className="settings-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <div className="settings-card__content">
            <h2 className="settings-card__title">Profile</h2>
            {profileLoading ? (
              <div className="settings-profile-loading">
                <div className="spinner" style={{ width: 16, height: 16 }} />
                <span>Loading…</span>
              </div>
            ) : (
              <div className="settings-profile-info">
                <div className="settings-profile-row">
                  <span className="settings-profile-label">Name</span>
                  <span className="settings-profile-value">{profile?.name ?? '—'}</span>
                </div>
                <div className="settings-profile-row">
                  <span className="settings-profile-label">Email</span>
                  <span className="settings-profile-value">{profile?.email ?? '—'}</span>
                </div>
                <div className="settings-profile-row">
                  <span className="settings-profile-label">Password</span>
                  <span className="settings-profile-value settings-profile-badge-row">
                    {hasPassword ? (
                      <span className="settings-badge settings-badge--green">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        Set
                      </span>
                    ) : (
                      <span className="settings-badge settings-badge--dim">Not set</span>
                    )}
                  </span>
                </div>
                <div className="settings-profile-row">
                  <span className="settings-profile-label">Linked accounts</span>
                  <span className="settings-profile-value settings-profile-badge-row">
                    {hasGoogle && (
                      <span className="settings-badge settings-badge--provider">
                        <svg width="12" height="12" viewBox="0 0 24 24">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                        </svg>
                        Google
                      </span>
                    )}
                    {hasGitHub && (
                      <span className="settings-badge settings-badge--provider">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                        </svg>
                        GitHub
                      </span>
                    )}
                    {!hasGoogle && !hasGitHub && (
                      <span className="settings-badge settings-badge--dim">None</span>
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Change Password Card */}
        <div className="settings-card">
          <div className="settings-card__icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div className="settings-card__content">
            <h2 className="settings-card__title">Change Password</h2>
            <p className="settings-card__desc">
              {hasPassword
                ? "Update your password. You'll stay signed in on this device."
                : 'You haven\'t set a password yet. Use the form below or Forgot Password to create one.'}
            </p>

            <form onSubmit={handleSubmit} className="auth-form settings-form">
              {hasPassword && (
                <div className="form-group">
                  <label htmlFor="current-password" className="form-label">Current Password</label>
                  <input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="form-input"
                    placeholder="Your current password"
                    required
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div className="form-group">
                <label htmlFor="new-password" className="form-label">
                  {hasPassword ? 'New Password' : 'Set Password'}
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  placeholder="Min. 8 characters"
                  required
                  autoComplete="new-password"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm-new-password" className="form-label">Confirm Password</label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="form-input"
                  placeholder="Repeat password"
                  required
                  autoComplete="new-password"
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

              {success && (
                <div className="success-box" role="status">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  {success}
                </div>
              )}

              <button type="submit" id="change-password-submit" className="btn-primary" disabled={loading}>
                {loading ? <><div className="spinner" />Updating…</> : hasPassword ? 'Update Password' : 'Set Password'}
              </button>
            </form>
          </div>
        </div>

        {/* Hint */}
        <div className="settings-hint">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
          </svg>
          Alternatively, you can use{' '}
          <Link to="/forgot-password" className="auth-link">Forgot Password</Link>{' '}
          to receive a reset link by email.
        </div>
      </div>
    </div>
  );
}

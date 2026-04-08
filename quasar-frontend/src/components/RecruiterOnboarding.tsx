import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, ArrowRight } from 'lucide-react';
import { apiPost } from '../lib/api';
import { authState } from '../lib/auth';

export function RecruiterOnboarding() {
  const user = authState.getUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim()) {
      setError('Company name is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await apiPost('/api/onboarding/profile', { name, phone, company, location });
      if (res.success) {
        const currentUser = authState.getUser();
        if (currentUser) {
          authState.setUser({ ...currentUser, profileComplete: true, name, phone, company, location });
        }
      } else {
        setError(res.message || 'Failed to save profile');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-2xl p-8 shadow-[var(--shadow-glass)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 border border-orange-500/30 flex items-center justify-center">
              <Building2 size={24} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[var(--c-text)]">Recruiter Setup</h2>
              <p className="text-[var(--c-text-dim)] text-[13px]">Set up your recruiter profile</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Company Name *</label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                placeholder="Acme Corp"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                  placeholder="+91 9876543210"
                />
              </div>
              <div>
                <label className="block text-[12px] font-bold uppercase tracking-wider text-[var(--c-text-mute)] mb-2">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  className="w-full px-4 py-3 bg-[var(--c-surface-2)] border border-[var(--c-border)] rounded-xl text-[var(--c-text)] text-[14px] focus:outline-none focus:border-[var(--c-accent)] transition-colors"
                  placeholder="Mumbai, India"
                />
              </div>
            </div>

            {error && <p className="text-[var(--c-error)] text-[13px] font-medium">{error}</p>}

            <button type="submit" disabled={!name || !company || loading} className="btn-primary btn-full mt-2 flex items-center gap-2 justify-center">
              {loading ? <div className="spinner" /> : <>Complete Setup <ArrowRight size={16} /></>}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

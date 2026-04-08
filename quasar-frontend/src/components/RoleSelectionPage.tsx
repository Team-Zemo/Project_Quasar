import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Briefcase, ArrowRight } from 'lucide-react';
import { apiPost } from '../lib/api';
import { authState } from '../lib/auth';

export function RoleSelectionPage() {
  const [selected, setSelected] = useState<'candidate' | 'recruiter' | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');

    try {
      const res = await apiPost<{ role: string; profileComplete: boolean }>('/api/onboarding/role', { role: selected });
      if (res.success) {
        const currentUser = authState.getUser();
        if (currentUser) {
          authState.setUser({ ...currentUser, role: selected, profileComplete: false });
        }
      } else {
        setError(res.message || 'Failed to set role');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const roles = [
    {
      id: 'candidate' as const,
      icon: Users,
      title: 'Candidate',
      description: 'Practice interviews, apply to jobs, and track your progress through hiring pipelines.',
      features: ['AI Mock Interviews', 'Job Applications', 'Resume Analysis', 'Skill Tracking'],
      gradient: 'from-blue-500/20 to-cyan-500/20',
      border: 'border-blue-500/30',
      activeBorder: 'border-blue-500',
      iconColor: 'text-blue-400',
      glow: 'shadow-[0_0_40px_rgba(59,130,246,0.15)]',
    },
    {
      id: 'recruiter' as const,
      icon: Briefcase,
      title: 'Recruiter',
      description: 'Post jobs, configure hiring pipelines, manage applicants with AI-powered screening.',
      features: ['Job Postings', 'AI Screening', 'MCQ Tests', 'Candidate Rankings'],
      gradient: 'from-orange-500/20 to-amber-500/20',
      border: 'border-orange-500/30',
      activeBorder: 'border-orange-500',
      iconColor: 'text-orange-400',
      glow: 'shadow-[0_0_40px_rgba(249,115,22,0.15)]',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="bg-blob bg-blob--1" aria-hidden="true" />
      <div className="bg-blob bg-blob--2" aria-hidden="true" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center mb-10"
      >
        <div className="w-14 h-14 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] flex items-center justify-center text-white font-black text-xl shadow-lg">
          AI
        </div>
        <h1 className="text-3xl md:text-4xl font-black text-[var(--c-text)] tracking-tight mb-3">
          Welcome to Quasar
        </h1>
        <p className="text-[var(--c-text-dim)] text-[15px] max-w-md mx-auto">
          Choose your role to get started. This determines your experience and cannot be changed later.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-2xl w-full mb-8">
        {roles.map((role, i) => {
          const Icon = role.icon;
          const isActive = selected === role.id;

          return (
            <motion.button
              key={role.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.1 }}
              type="button"
              onClick={() => setSelected(role.id)}
              className={`relative text-left p-6 rounded-2xl border-2 transition-all duration-300 cursor-pointer group ${
                isActive
                  ? `${role.activeBorder} bg-gradient-to-br ${role.gradient} ${role.glow}`
                  : `border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[var(--c-border-2)] hover:bg-[var(--c-surface-2)]`
              }`}
            >
              <div className={`w-12 h-12 rounded-xl bg-[var(--c-surface-3)] border border-[var(--c-border-2)] flex items-center justify-center mb-4 transition-colors ${isActive ? role.iconColor : 'text-[var(--c-text-mute)]'}`}>
                <Icon size={24} strokeWidth={2} />
              </div>

              <h3 className="text-xl font-bold text-[var(--c-text)] mb-2">{role.title}</h3>
              <p className="text-[13px] text-[var(--c-text-dim)] mb-4 leading-relaxed">{role.description}</p>

              <div className="flex flex-wrap gap-2">
                {role.features.map((f) => (
                  <span
                    key={f}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold uppercase tracking-wider bg-[var(--c-surface-3)] text-[var(--c-text-mute)] border border-[var(--c-border)]"
                  >
                    {f}
                  </span>
                ))}
              </div>

              {isActive && (
                <motion.div
                  layoutId="role-check"
                  className={`absolute top-4 right-4 w-6 h-6 rounded-full flex items-center justify-center text-black text-xs font-bold ${
                    role.id === 'candidate' ? 'bg-blue-500' : 'bg-orange-500'
                  }`}
                >
                  ✓
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>

      {error && (
        <p className="text-[var(--c-error)] text-[13px] font-medium mb-4">{error}</p>
      )}

      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        type="button"
        onClick={handleConfirm}
        disabled={!selected || loading}
        className="btn-primary flex items-center gap-2.5"
      >
        {loading ? (
          <div className="spinner" />
        ) : (
          <>
            Continue as {selected ? selected.charAt(0).toUpperCase() + selected.slice(1) : '...'}
            <ArrowRight size={16} strokeWidth={2.5} />
          </>
        )}
      </motion.button>
    </div>
  );
}

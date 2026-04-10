import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  User as UserIcon, Mail, Phone, MapPin, Briefcase, Globe,
  Upload, FileText, Trash2, Save, X, Edit3, CheckCircle2,
  AlertCircle, Lock, Loader2, Plus, Info, Building2,
} from 'lucide-react';
import { changePassword } from '../lib/auth';
import { authState } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import type { User } from '../lib/auth';

interface ProfileData extends User {
  resumeUrl?: string | null;
  githubUrl?: string | null;
  leetcodeUrl?: string | null;
  platformSyncStatus?: 'pending' | 'syncing' | 'completed' | 'failed_fetching' | null;
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [syncingPlatform, setSyncingPlatform] = useState(false);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit form state
  const [form, setForm] = useState({
    name: '', phone: '', headline: '', location: '',
    skills: [] as string[], experience: null as number | null,
    company: '', designation: '', companyWebsite: '',
    githubUrl: '', leetcodeUrl: ''
  });
  const [newSkill, setNewSkill] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/profile', { credentials: 'include' });
      const json = await res.json();
      if (json.success && json.data) {
        setProfile(json.data);
        setResumeUrl(json.data.resumeUrl || null);
        setForm({
          name: json.data.name || '',
          phone: json.data.phone || '',
          headline: json.data.headline || '',
          location: json.data.location || '',
          skills: json.data.skills || [],
          experience: json.data.experience ?? null,
          company: json.data.company || '',
          designation: json.data.designation || '',
          companyWebsite: json.data.companyWebsite || '',
          githubUrl: json.data.githubUrl || '',
          leetcodeUrl: json.data.leetcodeUrl || '',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.success) {
        setProfile(prev => prev ? { ...prev, ...json.data } : prev);
        setEditing(false);
        setMessage({ type: 'success', text: 'Profile updated successfully!' });
        // Update auth state so nav reflects changes
        const currentUser = authState.getUser();
        if (currentUser) {
          authState.setUser({ ...currentUser, ...json.data });
        }
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to update profile' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setMessage({ type: 'error', text: 'Only PDF files are allowed' });
      return;
    }

    setUploadingResume(true);
    setMessage(null);
    try {
      const formData = new FormData();
      formData.append('resume', file);
      const res = await fetch('/api/profile/resume', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const json = await res.json();
      if (json.success) {
        setProfile(prev => prev ? {
          ...prev,
          resumeKey: json.data.resumeKey,
          resumeFilename: json.data.resumeFilename,
          resumeUploadedAt: json.data.resumeUploadedAt,
          skills: json.data.skills,
          experience: json.data.experience,
          headline: json.data.headline || prev.headline,
        } : prev);
        setResumeUrl(json.data.resumeUrl);
        setForm(prev => ({
          ...prev,
          skills: json.data.skills || prev.skills,
          experience: json.data.experience ?? prev.experience,
          headline: json.data.headline || prev.headline,
        }));
        setMessage({ type: 'success', text: 'Resume uploaded and parsed successfully!' });
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to upload resume' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to upload resume' });
    } finally {
      setUploadingResume(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteResume = async () => {
    if (!confirm('Are you sure you want to delete your resume?')) return;
    try {
      const res = await fetch('/api/profile/resume', { method: 'DELETE', credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setProfile(prev => prev ? { ...prev, resumeKey: null, resumeFilename: null, resumeUploadedAt: null } : prev);
        setResumeUrl(null);
        setMessage({ type: 'success', text: 'Resume deleted' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Failed to delete resume' });
    }
  };

  const handleSyncPlatforms = async () => {
    setSyncingPlatform(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/sync-platforms', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ githubUrl: form.githubUrl, leetcodeUrl: form.leetcodeUrl }),
      });
      const json = await res.json();
      if (json.success) {
        setProfile(prev => prev ? { ...prev, platformSyncStatus: 'syncing' } : prev);
        setMessage({ type: 'success', text: 'Platform sync started in background' });
      } else {
        setMessage({ type: 'error', text: json.message || 'Failed to start sync' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong while syncing' });
    } finally {
      setSyncingPlatform(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: 'error', text: 'Passwords do not match' });
      return;
    }
    if (newPassword.length < 8) {
      setPasswordMessage({ type: 'error', text: 'Password must be at least 8 characters' });
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await changePassword(currentPassword, newPassword);
      if (result.success) {
        setPasswordMessage({ type: 'success', text: 'Password changed successfully!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowPasswordForm(false);
      } else {
        setPasswordMessage({ type: 'error', text: result.message });
      }
    } catch {
      setPasswordMessage({ type: 'error', text: 'Something went wrong' });
    } finally {
      setPasswordLoading(false);
    }
  };

  const addSkill = () => {
    const s = newSkill.trim();
    if (s && !form.skills.includes(s)) {
      setForm(prev => ({ ...prev, skills: [...prev.skills, s] }));
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setForm(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="spinner" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center text-[var(--c-text-dim)]">Failed to load profile</div>;
  }

  const isCandidate = profile.role === 'candidate';
  const isRecruiter = profile.role === 'recruiter';
  const providers = profile.linkedProviders ?? [];
  const hasGoogle = providers.includes('google');
  const hasGitHub = providers.includes('github');
  const hasPassword = profile.hasPassword ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-[680px] w-full mx-auto flex flex-col gap-5 py-4"
    >
      {/* Messages */}
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-[13px] font-semibold ${
            message.type === 'success'
              ? 'bg-[var(--c-success-dim)] border border-green-500/20 text-[var(--c-success)]'
              : 'bg-red-500/10 border border-red-500/20 text-red-500'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {message.text}
          <button onClick={() => setMessage(null)} className="ml-auto p-0.5 rounded hover:bg-black/10"><X size={14} /></button>
        </motion.div>
      )}

      {/* Profile Header Card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6">
        <div className="flex items-start gap-5">
          <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-[var(--c-accent)] to-[#fb923c] flex items-center justify-center text-white text-3xl font-black flex-shrink-0 shadow-lg">
            {profile.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                value={form.name}
                onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                className="text-[20px] font-bold text-[var(--c-text)] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-1.5 w-full mb-1 outline-none focus:border-[var(--c-accent)]"
              />
            ) : (
              <h1 className="text-[22px] font-black text-[var(--c-text)] mb-0.5">{profile.name}</h1>
            )}
            {isCandidate && (
              editing ? (
                <input
                  value={form.headline}
                  onChange={e => setForm(prev => ({ ...prev, headline: e.target.value }))}
                  placeholder="Your headline…"
                  className="text-[13px] text-[var(--c-text-dim)] bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-1.5 w-full outline-none focus:border-[var(--c-accent)]"
                />
              ) : (
                <p className="text-[14px] text-[var(--c-text-dim)]">{profile.headline || 'No headline set'}</p>
              )
            )}
            {isRecruiter && (
              <p className="text-[14px] text-[var(--c-text-dim)]">
                {profile.designation ? `${profile.designation} at ` : ''}{profile.company || 'Company not set'}
              </p>
            )}
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12px] text-[var(--c-text-mute)]">
              <span className="flex items-center gap-1"><Mail size={12} /> {profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1"><Phone size={12} /> {profile.phone}</span>}
              {profile.location && <span className="flex items-center gap-1"><MapPin size={12} /> {profile.location}</span>}
              {isCandidate && profile.experience != null && (
                <span className="flex items-center gap-1"><Briefcase size={12} /> {profile.experience} yrs exp</span>
              )}
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setMessage(null); }} className="p-2 rounded-xl hover:bg-[var(--c-surface-2)] text-[var(--c-text-mute)]" title="Cancel">
                  <X size={18} />
                </button>
                <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-[var(--c-accent)] text-white hover:brightness-110 transition-all">
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Save
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-all">
                <Edit3 size={14} /> Edit Profile
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Personal Info Card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6">
        <h2 className="text-[16px] font-bold text-[var(--c-text)] mb-4 flex items-center gap-2">
          <UserIcon size={18} className="text-[var(--c-accent)]" />
          {isRecruiter ? 'Company & Contact' : 'Personal Information'}
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {isRecruiter && (
            <>
              <EditableField label="Company" value={form.company} editing={editing}
                onChange={v => setForm(prev => ({ ...prev, company: v }))} icon={Building2} />
              <EditableField label="Designation" value={form.designation} editing={editing}
                onChange={v => setForm(prev => ({ ...prev, designation: v }))} icon={Briefcase} placeholder="e.g. HR Manager" />
              <EditableField label="Website" value={form.companyWebsite} editing={editing}
                onChange={v => setForm(prev => ({ ...prev, companyWebsite: v }))} icon={Globe} placeholder="https://..." />
            </>
          )}
          <EditableField label="Phone" value={form.phone} editing={editing}
            onChange={v => setForm(prev => ({ ...prev, phone: v }))} icon={Phone} placeholder="+91..." />
          <EditableField label="Location" value={form.location} editing={editing}
            onChange={v => setForm(prev => ({ ...prev, location: v }))} icon={MapPin} placeholder="City, Country" />
          {isCandidate && (
            <EditableField label="Experience (years)" value={form.experience !== null ? String(form.experience) : ''} editing={editing}
              onChange={v => setForm(prev => ({ ...prev, experience: v ? Number(v) : null }))} icon={Briefcase} placeholder="e.g. 3" type="number" />
          )}
        </div>
      </div>

      {/* Skills (Candidate only) */}
      {isCandidate && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6">
          <h2 className="text-[16px] font-bold text-[var(--c-text)] mb-4">Skills</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {form.skills.length === 0 && !editing && (
              <p className="text-[12px] text-[var(--c-text-mute)] italic">No skills added yet. Upload a resume to auto-fill.</p>
            )}
            {form.skills.map(s => (
              <span key={s} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold bg-[var(--c-accent-dim)] text-[var(--c-accent)] border border-[var(--c-accent)]/20">
                {s}
                {editing && (
                  <button onClick={() => removeSkill(s)} className="hover:text-[var(--c-error)] transition-colors"><X size={12} /></button>
                )}
              </span>
            ))}
          </div>
          {editing && (
            <div className="flex gap-2">
              <input
                value={newSkill}
                onChange={e => setNewSkill(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill..."
                className="flex-1 bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]"
              />
              <button onClick={addSkill} className="p-2 rounded-xl bg-[var(--c-accent-dim)] text-[var(--c-accent)] hover:bg-[var(--c-accent)] hover:text-white transition-all">
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* External Platforms (Candidate only) */}
      {isCandidate && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6 mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[var(--c-text)] flex items-center gap-2">
              <Globe size={18} className="text-[var(--c-accent)]" />
              External Platforms
            </h2>
            {profile.platformSyncStatus && (
              <span className={`text-[12px] font-semibold px-2.5 py-1 rounded-lg ${
                profile.platformSyncStatus === 'completed' ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]' :
                profile.platformSyncStatus === 'syncing' ? 'bg-blue-500/10 text-blue-500' :
                profile.platformSyncStatus === 'failed_fetching' ? 'bg-[var(--c-error-dim)] text-[var(--c-error)]' :
                'bg-[var(--c-surface-2)] text-[var(--c-text-mute)]'
              }`}>
                {profile.platformSyncStatus === 'syncing' ? 'Syncing...' : 
                 profile.platformSyncStatus === 'completed' ? 'Synced' : 
                 profile.platformSyncStatus === 'failed_fetching' ? 'Sync Failed' : 'Pending'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EditableField label="GitHub URL" value={form.githubUrl} editing={editing}
              onChange={v => setForm(prev => ({ ...prev, githubUrl: v }))} icon={Globe} placeholder="https://github.com/..." />
            <EditableField label="LeetCode URL" value={form.leetcodeUrl} editing={editing}
              onChange={v => setForm(prev => ({ ...prev, leetcodeUrl: v }))} icon={Globe} placeholder="https://leetcode.com/..." />
          </div>
          
          <div className="mt-4 pt-4 border-t border-[var(--c-border)] flex items-center justify-between">
             <button
               onClick={() => navigate('/platforms')}
               className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold text-[var(--c-text-mute)] hover:text-[var(--c-text)] hover:bg-[var(--c-surface-2)] transition-all border border-[var(--c-border)]"
             >
               <Globe size={14} /> View Details
             </button>
             <button onClick={handleSyncPlatforms} disabled={syncingPlatform} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold bg-[var(--c-accent-dim)] text-[var(--c-accent)] hover:bg-[var(--c-accent)] hover:text-white transition-all">
               {syncingPlatform ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />} 
               {profile.platformSyncStatus === 'completed' ? 'Force Resync' : 'Sync Platforms'}
             </button>
          </div>
        </div>
      )}

      {/* Resume Section (Candidate only) */}
      {isCandidate && (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6">
          <h2 className="text-[16px] font-bold text-[var(--c-text)] mb-4 flex items-center gap-2">
            <FileText size={18} className="text-[var(--c-accent)]" />
            Resume
          </h2>

          {profile.resumeKey ? (
            <div className="space-y-4">
              {/* Resume info bar */}
              <div className="flex items-center justify-between bg-[var(--c-bg)] rounded-xl p-4 border border-[var(--c-border)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[var(--c-text)]">{profile.resumeFilename || 'resume.pdf'}</p>
                    <p className="text-[11px] text-[var(--c-text-mute)]">
                      Uploaded {profile.resumeUploadedAt ? new Date(profile.resumeUploadedAt).toLocaleDateString() : 'recently'}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-all cursor-pointer">
                    <Upload size={14} /> Replace
                    <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" />
                  </label>
                  <button onClick={handleDeleteResume} className="p-2 rounded-xl text-[var(--c-text-mute)] hover:text-[var(--c-error)] hover:bg-[var(--c-error-dim)] transition-all" title="Delete resume">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* PDF viewer */}
              {resumeUrl && (
                <div className="rounded-xl overflow-hidden border border-[var(--c-border)] bg-white">
                  <iframe src={resumeUrl} className="w-full h-[500px]" title="Resume Preview" />
                </div>
              )}

              {uploadingResume && (
                <div className="flex items-center gap-2 text-[13px] text-[var(--c-accent)]">
                  <Loader2 size={16} className="animate-spin" /> Uploading and parsing...
                </div>
              )}
            </div>
          ) : (
            <div className="border-2 border-dashed border-[var(--c-border)] rounded-2xl p-8 text-center hover:border-[var(--c-accent)]/40 transition-colors">
              <Upload size={32} className="mx-auto text-[var(--c-text-mute)] mb-3" />
              <p className="text-[14px] font-semibold text-[var(--c-text)] mb-1">Upload your resume</p>
              <p className="text-[12px] text-[var(--c-text-mute)] mb-4">PDF format, max 10 MB. AI will auto-extract your skills and experience.</p>
              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-accent)] text-white hover:brightness-110 transition-all cursor-pointer">
                {uploadingResume ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {uploadingResume ? 'Uploading...' : 'Choose PDF'}
                <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleResumeUpload} className="hidden" disabled={uploadingResume} />
              </label>
            </div>
          )}
        </div>
      )}

      {/* Account Security Card */}
      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[24px] p-6">
        <h2 className="text-[16px] font-bold text-[var(--c-text)] mb-4 flex items-center gap-2">
          <Lock size={18} className="text-[var(--c-text-mute)]" />
          Account Security
        </h2>

        {/* Linked providers */}
        <div className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--c-border)]">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)] w-[100px]">Linked</span>
          <div className="flex gap-2">
            {hasGoogle && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[var(--c-text)]">
                <svg width="12" height="12" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Google
              </span>
            )}
            {hasGitHub && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[var(--c-surface-2)] border border-[var(--c-border)] text-[var(--c-text)]">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/></svg>
                GitHub
              </span>
            )}
            {!hasGoogle && !hasGitHub && (
              <span className="text-[11px] text-[var(--c-text-mute)]">No linked accounts</span>
            )}
          </div>
        </div>

        {/* Password */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[13px] font-semibold text-[var(--c-text)]">Password</p>
            <p className="text-[11px] text-[var(--c-text-mute)]">
              {hasPassword ? 'Your password is set' : 'No password set — using social login only'}
            </p>
          </div>
          <button
            onClick={() => setShowPasswordForm(!showPasswordForm)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-bold border border-[var(--c-border)] text-[var(--c-text-dim)] hover:bg-[var(--c-surface-2)] transition-all"
          >
            {showPasswordForm ? 'Cancel' : hasPassword ? 'Change' : 'Set Password'}
          </button>
        </div>

        {showPasswordForm && (
          <form onSubmit={handlePasswordChange} className="mt-4 pt-4 border-t border-[var(--c-border)] space-y-3">
            {hasPassword && (
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                placeholder="Current password" required autoComplete="current-password"
                className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
            )}
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="New password (min 8 chars)" required autoComplete="new-password"
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password" required autoComplete="new-password"
              className="w-full bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2.5 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)]" />

            {passwordMessage && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold ${
                passwordMessage.type === 'success'
                  ? 'bg-[var(--c-success-dim)] text-[var(--c-success)]'
                  : 'bg-red-500/10 text-red-500'
              }`}>
                {passwordMessage.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                {passwordMessage.text}
              </div>
            )}

            <button type="submit" disabled={passwordLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--c-text)] text-[var(--c-bg)] hover:brightness-110 transition-all"
            >
              {passwordLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              {hasPassword ? 'Update Password' : 'Set Password'}
            </button>
          </form>
        )}
      </div>

      {/* Hint */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-[var(--c-surface)] border border-[var(--c-border)] text-[12px] text-[var(--c-text-mute)]">
        <Info size={14} className="flex-shrink-0 mt-0.5 opacity-60" />
        <span>Your profile data is used by the AI Coach to personalize advice and career guidance.</span>
      </div>
    </motion.div>
  );
}

/* ── Reusable editable field component ───────────────────────────── */

function EditableField({ label, value, editing, onChange, icon: Icon, placeholder, type = 'text' }: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  icon: React.ElementType;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-wider text-[var(--c-text-mute)] flex items-center gap-1.5">
        <Icon size={12} /> {label}
      </label>
      {editing ? (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || label}
          className="bg-[var(--c-bg)] border border-[var(--c-border)] rounded-xl px-3 py-2 text-[13px] text-[var(--c-text)] outline-none focus:border-[var(--c-accent)] transition-colors"
        />
      ) : (
        <p className="text-[14px] font-medium text-[var(--c-text)] py-1">{value || <span className="text-[var(--c-text-mute)] italic text-[12px]">Not set</span>}</p>
      )}
    </div>
  );
}

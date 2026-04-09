import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { login } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Code2, Users, Sparkles, Eye, EyeOff } from 'lucide-react';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.message);
      }
    } catch {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[var(--c-bg)] text-[var(--c-text)] font-sans">
      
      {/* Left Pane - Branding & Features */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 relative overflow-hidden bg-[#0A0A12]">
        {/* Subtle top amber glow */}
        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[800px] bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_60%)] pointer-events-none"></div>

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-[32px] h-[32px] rounded-lg bg-gradient-to-br from-[#f97316] to-[#ea580c] flex items-center justify-center shadow-lg shadow-orange-500/20">
            <Sparkles className="text-white fill-white" size={16} />
          </div>
          <span className="text-[17px] font-medium text-[var(--c-text-dim)]">
            Interview <strong className="text-white font-black tracking-tight">Quasar</strong>
          </span>
        </div>

        {/* Middle Content */}
        <div className="max-w-[480px] relative z-10 mt-[-10vh]">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[100px] border border-orange-500/20 bg-orange-500/10 text-orange-400 text-[12px] font-bold mb-8 tracking-wide">
            <Sparkles size={13} fill="currentColor" />
            v2.0 AI Engine Live
          </div>

          <h1 className="text-[52px] font-black leading-[1.1] tracking-[-0.03em] mb-6">
            <span className="text-white">Master the interview.</span><br />
            <span className="text-[#6C6C77]">Land the offer.</span>
          </h1>

          <p className="text-[17px] leading-[1.6] text-gray-400 mb-12 font-medium">
            Stop practicing in the mirror. Get brutally honest, real-time feedback from our AI hiring managers tailored to your target company and role.
          </p>

          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-4 text-gray-200">
               <div className="flex w-10 h-10 rounded-[12px] bg-white/5 border border-white/10 items-center justify-center shrink-0">
                  <Code2 size={18} className="text-gray-300" />
               </div>
               <span className="text-[15px] font-bold tracking-wide">Technical & System Design rounds</span>
            </div>
            <div className="flex items-center gap-4 text-gray-200">
               <div className="flex w-10 h-10 rounded-[12px] bg-white/5 border border-white/10 items-center justify-center shrink-0">
                  <Users size={18} className="text-gray-300" />
               </div>
               <span className="text-[15px] font-bold tracking-wide">Behavioral & Leadership scenarios</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 text-[13px] text-gray-600 font-medium tracking-wide">
          © 2026 Quasar Technologies Inc.
        </div>
      </div>

      {/* Right Pane - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-[#11111A]">
        {/* Top Right Register Link */}
        <div className="absolute top-10 right-10 z-10 hidden sm:block">
          <span className="text-[13px] text-gray-400 font-medium">New to Quasar? </span>
          <Link to="/register" className="text-[13px] text-[#f97316] font-bold hover:underline transition-all">Create an account</Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 md:px-24 py-12 lg:py-0">
          
          {/* Mobile Register Link (visible only on small screens) */}
          <div className="sm:hidden mb-8 text-center text-[13px] text-gray-400 font-medium">
            New to Quasar? <Link to="/register" className="text-[#f97316] font-bold hover:underline transition-all">Create an account</Link>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[400px] flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-10">
              <h2 className="text-[32px] font-extrabold text-white m-0 tracking-tight mb-2">Welcome Back</h2>
              <p className="text-[15px] text-gray-400 m-0 font-medium">Sign in to continue your interview practice</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
              <div className="flex flex-col gap-2">
                <label htmlFor="login-email" className="text-[13px] font-bold text-gray-200">Email</label>
                <div className="relative">
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-500 transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[50px] px-4"
                    placeholder="you@example.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="login-password" className="text-[13px] font-bold text-gray-200">Password</label>
                  <Link to="/forgot-password" className="text-[12px] font-semibold text-gray-500 hover:text-gray-300 transition-all">Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-600 tracking-wider transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[50px] px-4 pr-12"
                    placeholder="••••••••"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-bold rounded-[12px] p-3 mt-1" role="alert">
                  <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                className="flex items-center justify-center gap-2 w-full bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] text-white font-bold text-[15px] rounded-[12px] transition-all cursor-pointer h-[50px] shadow-[0_4px_14px_rgba(249,115,22,0.3)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.4)] mt-3" 
                disabled={loading}
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Signing in…</> : 'Sign In →'}
              </button>
            </form>

            <div className="flex items-center gap-4 my-8 before:content-[''] before:flex-1 before:h-[1px] before:bg-white/5 after:content-[''] after:flex-1 after:h-[1px] after:bg-white/5 text-[11px] font-bold text-gray-500 uppercase tracking-widest px-2">
              <span>or continue with</span>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full">
              <a href="/auth/google" className="flex items-center justify-center gap-3 rounded-[12px] text-[14px] font-bold tracking-wide border border-white/5 bg-[#181824] text-gray-200 hover:bg-white/5 hover:text-white active:scale-[0.98] transition-all cursor-pointer no-underline h-[48px]">
                <svg width="18" height="18" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </a>
              <a href="/auth/github" className="flex items-center justify-center gap-3 rounded-[12px] text-[14px] font-bold tracking-wide border border-white/5 bg-[#181824] text-gray-200 hover:bg-white/5 hover:text-white active:scale-[0.98] transition-all cursor-pointer no-underline h-[48px]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>

          </motion.div>
        </div>
      </div>

    </div>
  );
}
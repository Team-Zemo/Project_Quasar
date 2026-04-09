import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2, Code2, Users, Sparkles, Eye, EyeOff } from 'lucide-react';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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

      {/* Right Pane - Form */}
      <div className="w-full lg:w-1/2 flex flex-col relative bg-[#11111A]">
        {/* Top Right Login Link */}
        <div className="absolute top-10 right-10 z-10 hidden sm:block">
          <span className="text-[13px] text-gray-400 font-medium">Already have an account? </span>
          <Link to="/login" className="text-[13px] text-[#f97316] font-bold hover:underline transition-all">Sign in</Link>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col items-center justify-center px-6 sm:px-12 md:px-24 py-12 lg:py-0">
          
          {/* Mobile Login Link */}
          <div className="sm:hidden mb-8 text-center text-[13px] text-gray-400 font-medium">
            Already have an account? <Link to="/login" className="text-[#f97316] font-bold hover:underline transition-all">Sign in</Link>
          </div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="w-full max-w-[400px] flex flex-col"
          >
            <div className="flex flex-col items-center text-center mb-8">
              <h2 className="text-[32px] font-extrabold text-white m-0 tracking-tight mb-2">Create an account</h2>
              <p className="text-[15px] text-gray-400 m-0 font-medium">Get started with your interview journey</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full">
              
              <div className="flex flex-col gap-2">
                <label htmlFor="register-name" className="text-[13px] font-bold text-gray-200">Full Name</label>
                <div className="relative">
                  <input
                    id="register-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-500 transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[48px] px-4"
                    placeholder="John Doe"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="register-email" className="text-[13px] font-bold text-gray-200">Email</label>
                <div className="relative">
                  <input
                    id="register-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-500 transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[48px] px-4"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 w-full">
                <div className="flex flex-col gap-2 w-full">
                  <label htmlFor="register-password" className="text-[13px] font-bold text-gray-200">Password</label>
                  <div className="relative">
                    <input
                      id="register-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-600 tracking-wider transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[48px] px-4 pr-10"
                      placeholder="••••••••"
                      required
                      minLength={8}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 w-full">
                  <label htmlFor="register-confirm" className="text-[13px] font-bold text-gray-200">Confirm</label>
                  <div className="relative">
                    <input
                      id="register-confirm"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-[#181824] border border-white/10 rounded-[12px] text-[15px] text-white placeholder-gray-600 tracking-wider transition-all focus:border-[#f97316] focus:ring-[3px] focus:ring-orange-500/20 outline-none h-[48px] px-4 pr-10"
                      placeholder="••••••••"
                      required
                    />
                    <button 
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
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
                className="flex items-center justify-center gap-2 w-full bg-[#f97316] hover:bg-[#ea580c] active:scale-[0.98] text-white font-bold text-[15px] rounded-[12px] transition-all cursor-pointer h-[50px] shadow-[0_4px_14px_rgba(249,115,22,0.3)] hover:shadow-[0_6px_20px_rgba(249,115,22,0.4)] mt-4" 
                disabled={loading}
              >
                {loading ? <><Loader2 size={18} className="animate-spin" /> Creating account…</> : 'Create Account →'}
              </button>
            </form>

          </motion.div>
        </div>
      </div>

    </div>
  );
}

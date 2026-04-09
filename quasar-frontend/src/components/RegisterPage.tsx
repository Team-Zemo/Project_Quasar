import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../lib/auth';
import { motion } from 'framer-motion';
import { AlertCircle, Loader2 } from 'lucide-react';

import { Button } from "./ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

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
    <div className="flex items-center justify-center bg-transparent min-h-screen" style={{ padding: '16px' }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="w-full max-w-[480px]"
      >
        <Card className="bg-[var(--c-surface)] border-[var(--c-border)] shadow-[var(--shadow-glass)] rounded-[24px]">
          <CardHeader className="text-center">
            <CardTitle className="text-[24px] font-extrabold text-[var(--c-text)] tracking-tight">Create your account</CardTitle>
            <CardDescription className="text-[14px] text-[var(--c-text-dim)]">
              Enter your email below to create your account
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 sm:px-8 pb-8">
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              
              <div className="space-y-2 w-full">
                <Label htmlFor="register-name" className="text-[13px] font-semibold text-[var(--c-text)]">Full Name</Label>
                <Input 
                  id="register-name" 
                  type="text" 
                  placeholder="John Doe" 
                  required 
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-[var(--c-bg)] border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus-visible:ring-4 focus-visible:ring-[var(--c-accent-dim)] focus-visible:border-[var(--c-accent)] outline-none transition-all shadow-none"
                  style={{ height: '48px', padding: '0 14px' }}
                />
              </div>

              <div className="space-y-2 w-full">
                <Label htmlFor="register-email" className="text-[13px] font-semibold text-[var(--c-text)]">Email</Label>
                <Input 
                  id="register-email" 
                  type="email" 
                  placeholder="m@example.com" 
                  required 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[var(--c-bg)] border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus-visible:ring-4 focus-visible:ring-[var(--c-accent-dim)] focus-visible:border-[var(--c-accent)] outline-none transition-all shadow-none"
                  style={{ height: '48px', padding: '0 14px' }}
                />
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex flex-col sm:flex-row gap-4 w-full">
                  <div className="space-y-2 w-full">
                    <Label htmlFor="register-password" className="text-[13px] font-semibold text-[var(--c-text)]">Password</Label>
                    <Input 
                      id="register-password" 
                      type="password" 
                      required 
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-[var(--c-bg)] border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus-visible:ring-4 focus-visible:ring-[var(--c-accent-dim)] focus-visible:border-[var(--c-accent)] outline-none transition-all shadow-none"
                      style={{ height: '48px', padding: '0 14px' }}
                    />
                  </div>
                  <div className="space-y-2 w-full">
                    <Label htmlFor="register-confirm" className="text-[13px] font-semibold text-[var(--c-text)]">Confirm Password</Label>
                    <Input 
                      id="register-confirm" 
                      type="password" 
                      required 
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-[var(--c-bg)] border-[var(--c-border)] rounded-[14px] text-[15px] text-[var(--c-text)] placeholder-[var(--c-text-mute)] focus-visible:ring-4 focus-visible:ring-[var(--c-accent-dim)] focus-visible:border-[var(--c-accent)] outline-none transition-all shadow-none"
                      style={{ height: '48px', padding: '0 14px' }}
                    />
                  </div>
                </div>
                <p className="text-[13px] text-[var(--c-text-mute)] font-medium">Must be at least 8 characters long.</p>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[13px] font-semibold rounded-[12px] p-3 mt-1" role="alert">
                  <AlertCircle size={16} strokeWidth={2.5} className="shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-3 mt-2">
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-[var(--c-text)] hover:bg-[var(--c-text-dim)] text-[var(--c-bg)] font-bold text-[15px] rounded-[14px] h-[50px] transition-all"
                >
                  {loading ? <><Loader2 size={18} className="animate-spin mr-2" /> Creating account…</> : 'Create Account'}
                </Button>
              </div>

              <p className="text-center mt-3 mb-0 text-[14px] text-[var(--c-text-dim)] font-medium">
                Already have an account? <Link to="/login" className="text-[var(--c-text)] underline underline-offset-4 hover:text-[var(--c-text)] transition-all">Sign in</Link>
              </p>

            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

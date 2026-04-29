'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { setToken } from '@/lib/auth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const WAVEFORM = [30, 55, 80, 45, 95, 60, 40, 75, 50, 85, 35, 65];

const PROOF_CARDS = [
  { icon: 'mic', stat: '15 min recording', label: 'Turns into a week of content' },
  { icon: 'psychology', stat: 'Digital Brain', label: 'Learns your voice & expertise' },
  { icon: 'description', stat: 'LinkedIn · Newsletter · X', label: 'All platforms, one session' },
];

const passwordRules = [
  { label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
  { label: 'One number', test: (p: string) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const allRulesPassed = passwordRules.every((rule) => rule.test(password));

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!allRulesPassed) return;
    setLoading(true);
    setError('');
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const registerRes = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName, is_active: true, is_superuser: false, is_verified: false }),
      });
      if (!registerRes.ok) {
        const data = await registerRes.json();
        throw new Error(data.detail?.reason || data.detail || 'Registration failed');
      }
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      const loginRes = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!loginRes.ok) {
        const data = await loginRes.json();
        throw new Error(data.detail || 'Login failed after registration');
      }
      const data = await loginRes.json();
      setToken(data.access_token);
      router.push('/tour');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    borderColor: 'rgba(255,255,255,0.1)',
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-primary)] selection:bg-[color:rgba(233,83,53,0.3)]">
      <div className="mesh-background" />

      {/* Fixed header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
          <span className="text-[17px] font-bold tracking-tight">Ladder Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      <main className="flex min-h-screen flex-col md:flex-row">
        {/* Left panel */}
        <section className="relative hidden overflow-hidden md:flex md:w-[45%] flex-col justify-between p-10 lg:p-16">
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2"
            style={{ background: 'radial-gradient(circle at center, rgba(233,83,53,0.14) 0%, transparent 70%)' }}
          />

          <div className="relative mt-16 z-10">
            <h1 className="mb-8 max-w-md text-[34px] font-bold leading-[1.15] tracking-tight lg:text-[48px]">
              Your voice. Your brand.<br />
              <span className="text-[var(--accent)]">On autopilot.</span>
            </h1>

            <div className="grid max-w-[290px] gap-2.5">
              {PROOF_CARDS.map((card) => (
                <div
                  key={card.icon}
                  className="flex items-center gap-3 rounded-xl p-3.5"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    borderTop: '1px solid rgba(255,255,255,0.12)',
                    borderLeft: '1px solid rgba(255,255,255,0.04)',
                    backdropFilter: 'blur(12px)',
                  }}
                >
                  <span className="material-symbols-outlined text-[18px] text-[var(--accent)]">{card.icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold">{card.stat}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex h-20 items-end gap-1.5">
            {WAVEFORM.map((h, i) => (
              <div
                key={i}
                className="w-2 rounded-full bg-[var(--accent)]"
                style={{ height: `${h}%`, boxShadow: '0 0 10px rgba(233,83,53,0.45)' }}
              />
            ))}
          </div>
        </section>

        {/* Right panel — form */}
        <section className="flex flex-1 items-center justify-center p-5 pt-20 pb-16 lg:p-12 lg:pt-20 lg:pb-16">
          <div
            className="w-full max-w-[420px] rounded-2xl p-7 lg:p-10 z-10"
            style={{
              background: 'var(--form-glass-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--form-glass-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            {/* Mobile branding */}
            <div className="mb-6 flex flex-col items-center text-center md:hidden">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                <span className="text-[20px] font-bold tracking-tight">Ladder Flow</span>
              </div>
              <p className="text-[13px] font-bold">Your voice. Your brand.</p>
            </div>

            <div className="mb-6">
              <h2 className="text-[22px] font-bold lg:text-[26px]">Create your account</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Free to start. No credit card required.</p>
            </div>

            <form className="space-y-5" onSubmit={handleSignup}>
              {/* Google SSO — coming soon */}
              <div
                className="relative flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-[13px] font-medium opacity-50"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Continue with Google
                <span className="absolute right-3 rounded-full bg-[var(--surface-raised)] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                  Upcoming
                </span>
              </div>

              {/* Divider */}
              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-3 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]"
                    style={{ background: 'var(--form-glass-bg)' }}
                  >
                    Or use email
                  </span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-[color:rgba(239,68,68,0.3)] bg-[color:rgba(239,68,68,0.1)] p-2.5 text-[11px] text-[var(--danger)]">
                  {error}
                </div>
              )}

              <div className="space-y-3.5">
                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full rounded-lg border bg-[var(--background)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="executive@founder.com"
                    className="w-full rounded-lg border bg-[var(--background)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border bg-[var(--background)] px-3.5 py-2.5 pr-10 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      style={inputStyle}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {password.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-1.5">
                      {passwordRules.map((rule) => {
                        const passed = rule.test(password);
                        return (
                          <li key={rule.label} className="flex items-center gap-1.5">
                            <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${passed ? 'bg-[color:rgba(16,185,129,0.18)] text-[var(--success)]' : 'bg-[var(--surface-raised)] text-[var(--text-secondary)]'}`}>
                              {passed ? <Check size={9} strokeWidth={3} /> : <X size={9} strokeWidth={3} />}
                            </span>
                            <span className={`text-[10px] ${passed ? 'text-[var(--success)]' : 'text-[var(--text-secondary)]'}`}>{rule.label}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || !allRulesPassed}
                className="accent-gradient h-[48px] w-full rounded-xl text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? 'Creating account...' : 'Create Account'}
              </button>

              <p className="text-center text-[12px] text-[var(--text-secondary)]">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-[var(--accent)] hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </div>
        </section>
      </main>

      {/* Fixed footer */}
      <footer className="fixed bottom-0 z-40 flex w-full flex-wrap items-center justify-center gap-4 px-6 py-3 sm:gap-6">
        <span className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">
          © 2025 Ladder Flow. Built for Executives.
        </span>
        <div className="flex gap-4">
          {['Privacy Policy', 'Terms of Service', 'Support'].map((item) => (
            <a key={item} href="#" className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-70 transition-all hover:opacity-100 hover:text-[var(--text-primary)]">
              {item}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

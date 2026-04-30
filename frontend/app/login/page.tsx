'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import { setToken } from '@/lib/auth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';

const WAVEFORM = [40, 65, 45, 90, 70, 55, 85, 40, 60, 75, 50, 30];

const PROOF_CARDS = [
  { icon: 'mic', stat: '2,400+ founders', label: 'Scaling their voice' },
  { icon: 'description', stat: '18,000+ posts', label: 'High-intent output' },
  { icon: 'psychology', stat: '4.8M signals', label: 'Learned expertise' },
];

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', password);
      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Invalid login credentials');
      }
      const data = await res.json();
      setToken(data.access_token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-primary)] selection:bg-[color:rgba(233,83,53,0.3)]">
      <div className="mesh-background" />

      {/* Fixed header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span
            className="material-symbols-outlined text-[22px] text-[var(--accent)]"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            mic
          </span>
          <span className="text-[17px] font-bold tracking-tight">Ladder Flow</span>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main split layout */}
      <main className="flex min-h-screen flex-col md:flex-row">

        {/* Left panel — branding */}
        <section className="relative hidden overflow-hidden md:flex md:w-[45%] flex-col justify-between p-10 lg:p-16">
          {/* Ambient glow */}
          <div
            className="pointer-events-none absolute bottom-0 left-1/2 h-[400px] w-[600px] -translate-x-1/2"
            style={{ background: 'radial-gradient(circle at center, rgba(233,83,53,0.14) 0%, transparent 70%)' }}
            suppressHydrationWarning
          />

          {/* Content */}
          <div className="relative mt-16 z-10">
            <h1 className="mb-8 max-w-md text-[34px] font-bold leading-[1.15] tracking-tight lg:text-[48px]">
              Speak your expertise.<br />
              <span className="text-[var(--accent)]">We write the content.</span>
            </h1>

            <div className="grid max-w-[280px] gap-2.5">
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
                  suppressHydrationWarning
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

          {/* Waveform decoration */}
          <div className="relative z-10 flex h-20 items-end gap-1.5">
            {WAVEFORM.map((h, i) => (
              <div
                key={i}
                className="w-2 rounded-full bg-[var(--accent)]"
                style={{ height: `${h}%`, boxShadow: '0 0 10px rgba(233,83,53,0.45)' }}
                suppressHydrationWarning
              />
            ))}
          </div>
        </section>

        {/* Right panel — form */}
        <section className="relative flex flex-1 items-center justify-center p-5 pt-20 pb-16 lg:p-12 lg:pt-20 lg:pb-16">
          <div
            className="w-full max-w-[420px] rounded-2xl p-7 lg:p-10 z-10"
            style={{
              background: 'var(--form-glass-bg, rgba(26,26,26,0.88))',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--form-glass-border, rgba(255,255,255,0.08))',
              boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
            }}
            suppressHydrationWarning
          >
            {/* Mobile branding */}
            <div className="mb-6 flex flex-col items-center text-center md:hidden">
              <div className="mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[24px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
                <span className="text-[20px] font-bold tracking-tight">Ladder Flow</span>
              </div>
              <p className="text-[13px] font-bold">Speak your expertise.</p>
            </div>

            <div className="mb-6">
              <h2 className="text-[22px] font-bold lg:text-[26px]">Welcome back</h2>
              <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Continue building your personal brand</p>
            </div>

            <form onSubmit={handleLogin}>
            <div className="space-y-5">
              {/* Google SSO — coming soon */}
              <div
                className="relative flex w-full cursor-not-allowed items-center justify-center gap-3 rounded-lg border px-4 py-2.5 text-[13px] font-medium opacity-50"
                style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                suppressHydrationWarning
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
                  <div className="w-full border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} suppressHydrationWarning />
                </div>
                <div className="relative flex justify-center">
                  <span
                    className="px-3 text-[10px] uppercase tracking-widest text-[var(--text-secondary)]"
                    style={{ background: 'var(--form-glass-bg, rgba(26,26,26,0.88))' }}
                    suppressHydrationWarning
                  >
                    Or use email
                  </span>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-lg border border-[color:rgba(239,68,68,0.3)] bg-[color:rgba(239,68,68,0.1)] p-2.5 text-[11px] text-[var(--danger)]">
                  {error}
                </div>
              )}

              {/* Inputs */}
              <div className="space-y-3.5">
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
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                    suppressHydrationWarning
                  />
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]">
                      Password
                    </label>
                    <button
                      type="button"
                      className="text-[11px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-lg border bg-[var(--background)] px-3.5 py-2.5 pr-10 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
                      style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                      suppressHydrationWarning
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
                </div>
              </div>

              {/* Sign in button */}
              <button
                type="submit"
                disabled={loading}
                className="accent-gradient h-[48px] w-full rounded-xl font-semibold text-[14px] text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:hover:scale-100"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>

              <p className="text-center text-[12px] text-[var(--text-secondary)]">
                Don&apos;t have an account?{' '}
                <Link href="/signup" className="font-semibold text-[var(--accent)] hover:underline">
                  Sign up free
                </Link>
              </p>
            </div>
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
            <a
              key={item}
              href="#"
              className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] opacity-70 transition-all hover:opacity-100 hover:text-[var(--text-primary)]"
            >
              {item}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}

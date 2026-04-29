'use client';

import { useState, KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/auth';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { X, Check } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProofPoint {
  text: string;
  visibility: 'private' | 'publishable';
}

interface FormData {
  // Section A
  icp: string;
  offer: string;
  pain_solved: string;
  differentiator: string;
  proof_points: ProofPoint[];
  // Section B
  tone: string[];
  taboo_words: string;
  cta_preferences: string[];
  content_examples: string[];
  // Section C
  primary_goal: string;
  key_themes: string[];
  posting_frequency: string;
  platforms: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TONE_OPTIONS = ['Authoritative', 'Conversational', 'Provocative', 'Technical', 'Storytelling', 'Data-driven', 'Humorous'];
const CTA_OPTIONS = ['DM me', 'Book a call', 'Link in comments', 'Comment below', 'Newsletter signup', 'No CTA'];
const PLATFORM_OPTIONS = ['LinkedIn', 'X / Twitter', 'Newsletter'];
const GOAL_OPTIONS = ['Build authority', 'Generate leads', 'Educate market', 'Build community', 'Recruit talent'];
const FREQUENCY_OPTIONS = ['2× / week', '3× / week', '5× / week', 'Daily'];

const STEPS = [
  { label: 'Business & Positioning', short: 'Business' },
  { label: 'Voice & Style', short: 'Voice' },
  { label: 'Content Strategy', short: 'Strategy' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function MultiChipSelect({
  options,
  selected,
  onChange,
  single,
}: {
  options: string[];
  selected: string[];
  onChange: (val: string[]) => void;
  single?: boolean;
}) {
  const toggle = (opt: string) => {
    if (single) {
      onChange([opt]);
      return;
    }
    if (selected.includes(opt)) {
      onChange(selected.filter((s) => s !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150"
            style={
              active
                ? { background: 'var(--accent)', color: '#fff', border: '1px solid var(--accent)' }
                : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.12)' }
            }
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function TagInput({
  tags,
  onChange,
  placeholder,
  max,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [input, setInput] = useState('');

  const add = () => {
    const val = input.trim();
    if (!val || tags.includes(val) || (max && tags.length >= max)) return;
    onChange([...tags, val]);
    setInput('');
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); add(); }
    if (e.key === 'Backspace' && !input && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      className="flex min-h-[42px] flex-wrap items-center gap-1.5 rounded-lg border px-3 py-2 transition-all focus-within:border-[var(--accent)] focus-within:ring-1 focus-within:ring-[var(--accent)]"
      style={{ borderColor: 'rgba(255,255,255,0.1)', background: 'var(--background)' }}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
          style={{ background: 'rgba(233,83,53,0.15)', color: 'var(--accent)', border: '1px solid rgba(233,83,53,0.25)' }}
        >
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>
            <X size={9} strokeWidth={3} />
          </button>
        </span>
      ))}
      {(!max || tags.length < max) && (
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onBlur={add}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="min-w-[100px] flex-1 bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)]"
        />
      )}
    </div>
  );
}

function ProofPointField({
  point,
  index,
  onChange,
  onRemove,
}: {
  point: ProofPoint;
  index: number;
  onChange: (p: ProofPoint) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={point.text}
          onChange={(e) => onChange({ ...point, text: e.target.value })}
          placeholder={`Proof point ${index + 1} — e.g. "Helped 3 clients 10× revenue in 90 days"`}
          className="flex-1 rounded-lg border bg-[var(--background)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        />
        <button
          type="button"
          onClick={onRemove}
          className="shrink-0 rounded-lg p-2 text-[var(--text-secondary)] transition-colors hover:text-[var(--danger)]"
          style={{ border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <X size={14} />
        </button>
      </div>
      <div className="flex gap-2 pl-1">
        {(['private', 'publishable'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange({ ...point, visibility: v })}
            className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-all"
            style={
              point.visibility === v
                ? { background: v === 'private' ? 'rgba(99,102,241,0.2)' : 'rgba(16,185,129,0.2)', color: v === 'private' ? '#818cf8' : '#34d399', border: `1px solid ${v === 'private' ? 'rgba(99,102,241,0.4)' : 'rgba(16,185,129,0.4)'}` }
                : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid rgba(255,255,255,0.1)' }
            }
          >
            <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {v === 'private' ? 'lock' : 'public'}
            </span>
            {v}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  const [form, setForm] = useState<FormData>({
    icp: '',
    offer: '',
    pain_solved: '',
    differentiator: '',
    proof_points: [{ text: '', visibility: 'private' }],
    tone: [],
    taboo_words: '',
    cta_preferences: [],
    content_examples: [''],
    primary_goal: '',
    key_themes: [],
    posting_frequency: '',
    platforms: ['LinkedIn'],
  });

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addProofPoint = () => {
    if (form.proof_points.length >= 3) return;
    set('proof_points', [...form.proof_points, { text: '', visibility: 'private' }]);
  };

  const updateProof = (i: number, p: ProofPoint) => {
    const updated = [...form.proof_points];
    updated[i] = p;
    set('proof_points', updated);
  };

  const removeProof = (i: number) => {
    set('proof_points', form.proof_points.filter((_, idx) => idx !== i));
  };

  const addContentExample = () => {
    if (form.content_examples.length >= 2) return;
    set('content_examples', [...form.content_examples, '']);
  };

  const updateExample = (i: number, val: string) => {
    const updated = [...form.content_examples];
    updated[i] = val;
    set('content_examples', updated);
  };

  const canAdvanceStep1 = form.icp.trim() && form.offer.trim() && form.pain_solved.trim() && form.differentiator.trim();
  const canAdvanceStep2 = form.tone.length > 0;
  const canSubmit = form.primary_goal && form.key_themes.length > 0 && form.posting_frequency && form.platforms.length > 0;

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) { handleNext(); return; }
    setLoading(true);
    setError('');
    try {
      const token = getToken();
      if (!token) throw new Error('Not authenticated');
      const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const tabooWords = form.taboo_words
        .split(',')
        .map((word) => word.trim())
        .filter(Boolean);
      const payload = {
        ...form,
        taboo_words: tabooWords,
      };
      const res = await fetch(`${API_URL}/api/users/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.detail)) {
          const msg = data.detail
            .map((item: { loc?: unknown[]; msg?: string }) => {
              const field = Array.isArray(item.loc) ? String(item.loc[item.loc.length - 1]) : 'field';
              return `${field}: ${item.msg || 'invalid value'}`;
            })
            .join(', ');
          throw new Error(msg || 'Failed to save profile');
        }
        throw new Error(
          typeof data?.detail === 'string' ? data.detail : 'Failed to save profile'
        );
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border bg-[var(--background)] px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all placeholder:text-[var(--text-secondary)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]';
  const inputStyle = { borderColor: 'rgba(255,255,255,0.1)' };
  const labelClass = 'mb-1.5 block text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--text-secondary)]';

  return (
    <div className="relative min-h-screen bg-[var(--background)] text-[var(--text-primary)] selection:bg-[color:rgba(233,83,53,0.3)]">
      <div className="mesh-background" />

      {/* Header */}
      <header className="fixed top-0 z-50 flex w-full items-center justify-between px-6 py-4 sm:px-8">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[22px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>
            mic
          </span>
          <span className="text-[17px] font-bold tracking-tight">Ladder Flow</span>
        </div>
        <ThemeToggle />
      </header>

      <main className="flex min-h-screen items-start justify-center px-5 pt-24 pb-20">
        <div className="w-full max-w-[560px]">

          {/* Page header */}
          <div className="mb-6 text-center">
            <div className="accent-gradient mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl shadow-[0_8px_24px_var(--accent-glow)]">
              <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                smart_toy
              </span>
            </div>
            <h1 className="text-[20px] font-bold tracking-tight">Set up your profile</h1>
            <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
              This seeds your Digital Brain. Takes under 10 minutes.
            </p>
          </div>

          {/* Step indicator */}
          <div className="mb-5 flex items-center">
            {STEPS.map((s, i) => {
              const num = i + 1;
              const active = step === num;
              const done = step > num;
              return (
                <div key={s.label} className="flex flex-1 items-center">
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all ${
                        active ? 'accent-gradient text-white shadow-[0_0_12px_rgba(233,83,53,0.4)]' :
                        done ? 'bg-[var(--success)] text-white' :
                        'bg-[var(--surface-raised)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {done ? <Check size={11} strokeWidth={3} /> : num}
                    </div>
                    <span className={`text-[11px] font-semibold hidden sm:block ${active ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                      {s.short}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className="mx-2 flex-1 h-px transition-all"
                      style={{ background: done ? 'var(--success)' : 'var(--border-default)' }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Card */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'var(--form-glass-bg)',
              backdropFilter: 'blur(20px)',
              border: '1px solid var(--form-glass-border)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
            }}
          >
            {error && (
              <div className="border-b border-[color:rgba(239,68,68,0.2)] bg-[color:rgba(239,68,68,0.08)] px-6 py-3 text-[11px] text-[var(--danger)]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>

              {/* ── Section A ── */}
              {step === 1 && (
                <div className="p-6 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                    Section A — Business & Positioning
                  </p>

                  <div>
                    <label className={labelClass}>Ideal Client (ICP)</label>
                    <input
                      type="text"
                      value={form.icp}
                      onChange={(e) => set('icp', e.target.value)}
                      placeholder="Describe your ideal client in one sentence"
                      className={inputClass} style={inputStyle} required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Your Offer</label>
                    <input
                      type="text"
                      value={form.offer}
                      onChange={(e) => set('offer', e.target.value)}
                      placeholder="What do you sell and at what price range?"
                      className={inputClass} style={inputStyle} required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Main Pain You Solve</label>
                    <input
                      type="text"
                      value={form.pain_solved}
                      onChange={(e) => set('pain_solved', e.target.value)}
                      placeholder="What specific problem does this solve for your clients?"
                      className={inputClass} style={inputStyle} required
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Your Differentiator</label>
                    <input
                      type="text"
                      value={form.differentiator}
                      onChange={(e) => set('differentiator', e.target.value)}
                      placeholder="What can you do that 80% of competitors genuinely cannot?"
                      className={inputClass} style={inputStyle} required
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={labelClass} style={{ marginBottom: 0 }}>Proof Points</label>
                      {form.proof_points.length < 3 && (
                        <button
                          type="button"
                          onClick={addProofPoint}
                          className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
                        >
                          + Add another
                        </button>
                      )}
                    </div>
                    <p className="mb-3 text-[11px] text-[var(--text-secondary)]">
                      A specific result, metric, or story that proves your value. Set each as private or publishable.
                    </p>
                    <div className="space-y-3">
                      {form.proof_points.map((p, i) => (
                        <ProofPointField
                          key={i}
                          index={i}
                          point={p}
                          onChange={(updated) => updateProof(i, updated)}
                          onRemove={() => removeProof(i)}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canAdvanceStep1}
                    onClick={handleNext}
                    className="accent-gradient h-[48px] w-full rounded-xl text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                  >
                    Continue
                  </button>
                </div>
              )}

              {/* ── Section B ── */}
              {step === 2 && (
                <div className="p-6 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                    Section B — Voice & Style
                  </p>

                  <div>
                    <label className={labelClass}>Tone Preferences <span className="normal-case text-[var(--accent)]">*</span></label>
                    <p className="mb-2 text-[11px] text-[var(--text-secondary)]">Select all that apply to your natural voice.</p>
                    <MultiChipSelect
                      options={TONE_OPTIONS}
                      selected={form.tone}
                      onChange={(v) => set('tone', v)}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Taboo Words / Phrases</label>
                    <input
                      type="text"
                      value={form.taboo_words}
                      onChange={(e) => set('taboo_words', e.target.value)}
                      placeholder="Words or phrases you never want in your content"
                      className={inputClass} style={inputStyle}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>CTA Preferences</label>
                    <p className="mb-2 text-[11px] text-[var(--text-secondary)]">How do you like to close your posts?</p>
                    <MultiChipSelect
                      options={CTA_OPTIONS}
                      selected={form.cta_preferences}
                      onChange={(v) => set('cta_preferences', v)}
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className={labelClass} style={{ marginBottom: 0 }}>Content Examples (optional)</label>
                      {form.content_examples.length < 2 && (
                        <button
                          type="button"
                          onClick={addContentExample}
                          className="text-[10px] font-semibold text-[var(--accent)] hover:underline"
                        >
                          + Add second
                        </button>
                      )}
                    </div>
                    <p className="mb-2 text-[11px] text-[var(--text-secondary)]">
                      Share 1–2 posts you&apos;ve written that you were proud of.
                    </p>
                    <div className="space-y-2">
                      {form.content_examples.map((url, i) => (
                        <input
                          key={i}
                          type="url"
                          value={url}
                          onChange={(e) => updateExample(i, e.target.value)}
                          placeholder={`https://linkedin.com/posts/...`}
                          className={inputClass} style={inputStyle}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="h-[48px] shrink-0 rounded-xl border px-5 text-[13px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
                      style={{ borderColor: 'var(--form-glass-border)' }}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={!canAdvanceStep2}
                      onClick={handleNext}
                      className="accent-gradient h-[48px] flex-1 rounded-xl text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {/* ── Section C ── */}
              {step === 3 && (
                <div className="p-6 space-y-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--accent)]">
                    Section C — Content Strategy
                  </p>

                  <div>
                    <label className={labelClass}>Primary Goal <span className="normal-case text-[var(--accent)]">*</span></label>
                    <MultiChipSelect
                      options={GOAL_OPTIONS}
                      selected={form.primary_goal ? [form.primary_goal] : []}
                      onChange={(v) => set('primary_goal', v[0] ?? '')}
                      single
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Key Themes <span className="normal-case text-[var(--accent)]">*</span></label>
                    <p className="mb-2 text-[11px] text-[var(--text-secondary)]">
                      3–5 topics you want to be known for. Type and press Enter.
                    </p>
                    <TagInput
                      tags={form.key_themes}
                      onChange={(v) => set('key_themes', v)}
                      placeholder="e.g. Pricing strategy, GTM, Hiring…"
                      max={5}
                    />
                    <p className="mt-1 text-[10px] text-[var(--text-secondary)]">{form.key_themes.length}/5</p>
                  </div>

                  <div>
                    <label className={labelClass}>Posting Frequency <span className="normal-case text-[var(--accent)]">*</span></label>
                    <MultiChipSelect
                      options={FREQUENCY_OPTIONS}
                      selected={form.posting_frequency ? [form.posting_frequency] : []}
                      onChange={(v) => set('posting_frequency', v[0] ?? '')}
                      single
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Platforms <span className="normal-case text-[var(--accent)]">*</span></label>
                    <MultiChipSelect
                      options={PLATFORM_OPTIONS}
                      selected={form.platforms}
                      onChange={(v) => set('platforms', v)}
                    />
                  </div>

                  <div className="flex gap-2.5">
                    <button
                      type="button"
                      onClick={() => setStep(2)}
                      className="h-[48px] shrink-0 rounded-xl border px-5 text-[13px] font-semibold text-[var(--text-secondary)] transition-all hover:text-[var(--text-primary)]"
                      style={{ borderColor: 'var(--form-glass-border)' }}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={loading || !canSubmit}
                      className="accent-gradient h-[48px] flex-1 rounded-xl text-[14px] font-semibold text-white shadow-[0_4px_16px_rgba(233,83,53,0.3)] transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                    >
                      {loading ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Saving...
                        </span>
                      ) : 'Complete Setup'}
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <p className="mt-4 text-center text-[11px] text-[var(--text-secondary)]">
            You can update all of this anytime in Settings.
          </p>
        </div>
      </main>

      {/* Footer */}
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

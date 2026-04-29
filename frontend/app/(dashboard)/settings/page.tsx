'use client';

import { useEffect, useState } from 'react';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { useUser } from '@/lib/context/UserContext';
import { authHeaders, removeToken } from '@/lib/auth';

type SettingsSection = 'profile' | 'positioning' | 'voice' | 'strategy' | 'privacy' | 'account';

const NAV_ITEMS: { id: SettingsSection; label: string; icon: string }[] = [
  { id: 'profile',      label: 'Profile',                  icon: 'person' },
  { id: 'positioning',  label: 'Business & Positioning',   icon: 'business_center' },
  { id: 'voice',        label: 'Voice & Style',            icon: 'record_voice_over' },
  { id: 'strategy',     label: 'Content Strategy',         icon: 'strategy' },
  { id: 'privacy',      label: 'Privacy',                  icon: 'lock' },
  { id: 'account',      label: 'Account',                  icon: 'manage_accounts' },
];

const TONE_OPTIONS = ['Authoritative', 'Conversational', 'Provocative', 'Technical', 'Storytelling', 'Data-driven', 'Humorous'];
const GOAL_OPTIONS = ['Grow LinkedIn audience', 'Drive inbound leads', 'Build thought leadership', 'Attract media opportunities', 'Build a newsletter', 'Grow personal brand'];
const FREQ_OPTIONS = ['Daily', '3x / week', '2x / week', 'Weekly', 'Bi-weekly'];
const PLATFORM_OPTIONS = ['LinkedIn', 'X (Twitter)', 'Newsletter', 'Instagram', 'YouTube'];

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">{label}</label>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, placeholder, type = 'text' }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className="w-full rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none transition-all focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
      style={{ background: 'var(--background)', border: '1px solid var(--border-default)' }} />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return (
    <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
      className="w-full rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none transition-all focus:ring-1 focus:ring-[var(--accent)] placeholder:text-[var(--text-secondary)]"
      style={{ background: 'var(--background)', border: '1px solid var(--border-default)', resize: 'none' }} />
  );
}

function ChipSelect({ options, selected, multi, onChange }: { options: string[]; selected: string[]; multi?: boolean; onChange: (v: string[]) => void }) {
  const toggle = (opt: string) => {
    if (multi) {
      onChange(selected.includes(opt) ? selected.filter(s => s !== opt) : [...selected, opt]);
    } else {
      onChange(selected.includes(opt) ? [] : [opt]);
    }
  };
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => {
        const active = selected.includes(opt);
        return (
          <button key={opt} type="button" onClick={() => toggle(opt)}
            className="rounded-full px-3 py-1.5 text-[12px] font-semibold transition-all"
            style={active
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function SaveBar({ saving, saved, onSave }: { saving: boolean; saved: boolean; onSave: () => void }) {
  return (
    <div className="flex items-center justify-end gap-3 border-t pt-5 mt-5" style={{ borderColor: 'var(--border-default)' }}>
      {saved && <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[#10b981]"><span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>Saved</span>}
      <button type="button" onClick={onSave} disabled={saving}
        className="accent-gradient flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_4px_12px_rgba(233,83,53,0.25)] transition-all hover:scale-[1.02] disabled:opacity-50">
        {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>save</span>}
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[16px] p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
      <div className="mb-5">
        <h2 className="text-[15px] font-extrabold text-primary">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useUser();
  const [activeSection, setActiveSection] = useState<SettingsSection>('profile');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Profile
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [twitterUrl, setTwitterUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // Business & Positioning
  const [icp, setIcp] = useState('');
  const [offer, setOffer] = useState('');
  const [painSolved, setPainSolved] = useState('');
  const [differentiator, setDifferentiator] = useState('');
  const [niche, setNiche] = useState('');
  const [industry, setIndustry] = useState('');

  // Voice & Style
  const [toneChips, setToneChips] = useState<string[]>([]);
  const [tabooWords, setTabooWords] = useState('');
  const [ctaPreferences, setCtaPreferences] = useState('');

  // Content Strategy
  const [primaryGoal, setPrimaryGoal] = useState<string[]>([]);
  const [postingFrequency, setPostingFrequency] = useState<string[]>([]);
  const [platforms, setPlatforms] = useState<string[]>(['LinkedIn']);
  const [keyThemes, setKeyThemes] = useState('');

  // Privacy
  const [defaultVisibility, setDefaultVisibility] = useState<'private' | 'publishable'>('private');
  const [shareAnalytics, setShareAnalytics] = useState(false);

  useEffect(() => {
    fetch('/api/users/profile', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setFullName(data.full_name || '');
        setBio(data.bio || '');
        setLinkedinUrl(data.linkedin_url || '');
        setTwitterUrl(data.twitter_url || '');
        setWebsiteUrl(data.website_url || '');
        setIcp(data.icp || '');
        setOffer(data.offer || '');
        setPainSolved(data.pain_solved || '');
        setDifferentiator(data.differentiator || '');
        setNiche(data.niche || '');
        setIndustry(data.industry || '');
        setToneChips(data.tone ? (Array.isArray(data.tone) ? data.tone : [data.tone]) : []);
        setTabooWords((data.taboo_words || []).join(', '));
        setCtaPreferences((data.cta_preferences || []).join(', '));
        setPrimaryGoal(data.primary_goal ? [data.primary_goal] : []);
        setPostingFrequency(data.posting_frequency ? [data.posting_frequency] : []);
        setPlatforms(data.platforms || ['LinkedIn']);
        setKeyThemes((data.key_themes || []).join(', '));
        setDefaultVisibility(data.default_visibility || 'private');
        setShareAnalytics(data.share_analytics || false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    const payload = {
      full_name: fullName,
      bio,
      linkedin_url: linkedinUrl,
      twitter_url: twitterUrl,
      website_url: websiteUrl,
      icp, offer, pain_solved: painSolved, differentiator, niche, industry,
      tone: toneChips,
      taboo_words: tabooWords.split(',').map(s => s.trim()).filter(Boolean),
      cta_preferences: ctaPreferences.split(',').map(s => s.trim()).filter(Boolean),
      primary_goal: primaryGoal[0] || '',
      posting_frequency: postingFrequency[0] || '',
      platforms,
      key_themes: keyThemes.split(',').map(s => s.trim()).filter(Boolean),
      default_visibility: defaultVisibility,
      share_analytics: shareAnalytics,
    };
    try {
      await fetch('/api/users/onboarding', {
        method: 'POST',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {}
    finally { setSaving(false); }
  };

  const renderSection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-16">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
        </div>
      );
    }

    switch (activeSection) {
      case 'profile':
        return (
          <SectionCard title="Profile" subtitle="Your public creator identity.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name"><TextInput value={fullName} onChange={setFullName} placeholder="Jane Smith" /></Field>
                <Field label="Email"><div className="rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--text-secondary)]" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>{user?.email || '—'}</div></Field>
              </div>
              <Field label="Bio / Tagline"><TextArea value={bio} onChange={setBio} placeholder="Founder, growth strategist, and relentless optimist..." rows={2} /></Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="LinkedIn URL"><TextInput value={linkedinUrl} onChange={setLinkedinUrl} placeholder="linkedin.com/in/..." /></Field>
                <Field label="Twitter / X URL"><TextInput value={twitterUrl} onChange={setTwitterUrl} placeholder="twitter.com/..." /></Field>
                <Field label="Website"><TextInput value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://..." /></Field>
              </div>
            </div>
            <SaveBar saving={saving} saved={saved} onSave={handleSave} />
          </SectionCard>
        );

      case 'positioning':
        return (
          <SectionCard title="Business & Positioning" subtitle="Help the AI understand your business so content stays on-brand.">
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Niche / Expertise"><TextInput value={niche} onChange={setNiche} placeholder="B2B SaaS Growth" /></Field>
                <Field label="Industry"><TextInput value={industry} onChange={setIndustry} placeholder="Technology / Software" /></Field>
              </div>
              <Field label="Ideal Customer Profile (ICP)"><TextArea value={icp} onChange={setIcp} placeholder="Senior marketers at mid-market B2B SaaS companies (50-500 employees) who struggle with pipeline..." /></Field>
              <Field label="Core Offer"><TextInput value={offer} onChange={setOffer} placeholder="We help B2B founders build inbound engines through content-led growth." /></Field>
              <Field label="Pain Solved"><TextArea value={painSolved} onChange={setPainSolved} placeholder="Founders spend hours creating content that gets zero engagement or leads..." rows={2} /></Field>
              <Field label="Differentiator"><TextArea value={differentiator} onChange={setDifferentiator} placeholder="Unlike generic content tools, we extract your authentic voice from real conversations..." rows={2} /></Field>
            </div>
            <SaveBar saving={saving} saved={saved} onSave={handleSave} />
          </SectionCard>
        );

      case 'voice':
        return (
          <SectionCard title="Voice & Style" subtitle="Define the tone and guardrails for all your AI-generated content.">
            <div className="space-y-5">
              <Field label="Tone (select all that apply)">
                <div className="mt-2">
                  <ChipSelect options={TONE_OPTIONS} selected={toneChips} multi onChange={setToneChips} />
                </div>
              </Field>
              <Field label="Taboo Words / Phrases">
                <TextInput value={tabooWords} onChange={setTabooWords} placeholder="synergy, leverage, paradigm shift, disruptive..." />
                <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">Comma-separated. These words will be avoided in all generated content.</p>
              </Field>
              <Field label="Preferred CTAs">
                <TextInput value={ctaPreferences} onChange={setCtaPreferences} placeholder="DM me, Comment below, Link in bio..." />
                <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">Comma-separated. AI will default to these calls-to-action.</p>
              </Field>
            </div>
            <SaveBar saving={saving} saved={saved} onSave={handleSave} />
          </SectionCard>
        );

      case 'strategy':
        return (
          <SectionCard title="Content Strategy" subtitle="Where and how often you want to publish.">
            <div className="space-y-5">
              <Field label="Primary Goal">
                <div className="mt-2"><ChipSelect options={GOAL_OPTIONS} selected={primaryGoal} onChange={setPrimaryGoal} /></div>
              </Field>
              <Field label="Posting Frequency">
                <div className="mt-2"><ChipSelect options={FREQ_OPTIONS} selected={postingFrequency} onChange={setPostingFrequency} /></div>
              </Field>
              <Field label="Platforms">
                <div className="mt-2"><ChipSelect options={PLATFORM_OPTIONS} selected={platforms} multi onChange={setPlatforms} /></div>
              </Field>
              <Field label="Key Themes">
                <TextInput value={keyThemes} onChange={setKeyThemes} placeholder="Go-to-market, founder stories, content strategy..." />
                <p className="mt-1.5 text-[10px] text-[var(--text-secondary)]">Comma-separated topics your content will revolve around.</p>
              </Field>
            </div>
            <SaveBar saving={saving} saved={saved} onSave={handleSave} />
          </SectionCard>
        );

      case 'privacy':
        return (
          <SectionCard title="Privacy" subtitle="Control how your data and content are used.">
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
                <div>
                  <p className="text-[13px] font-semibold text-primary">Default Memory Visibility</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">New extracted memories will default to this visibility setting.</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: 'var(--background)', border: '1px solid var(--border-default)' }}>
                  {(['private', 'publishable'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setDefaultVisibility(v)}
                      className="rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all"
                      style={defaultVisibility === v
                        ? { background: 'var(--accent)', color: '#fff' }
                        : { color: 'var(--text-secondary)' }}>
                      {v === 'private' ? 'Private' : 'Publishable'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
                <div>
                  <p className="text-[13px] font-semibold text-primary">Share Anonymous Analytics</p>
                  <p className="text-[11px] text-[var(--text-secondary)]">Help improve the AI with anonymized session data. No personal content is shared.</p>
                </div>
                <button type="button" onClick={() => setShareAnalytics(p => !p)}
                  className="relative h-6 w-11 rounded-full transition-all"
                  style={{ background: shareAnalytics ? 'var(--accent)' : 'var(--border-default)' }}>
                  <span className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all"
                    style={{ left: shareAnalytics ? '22px' : '2px' }} />
                </button>
              </div>
            </div>
            <SaveBar saving={saving} saved={saved} onSave={handleSave} />
          </SectionCard>
        );

      case 'account':
        return (
          <div className="space-y-3">
            <SectionCard title="Account" subtitle="Manage your account and session.">
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-primary">Email Address</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">{user?.email || '—'}</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(16,185,129,0.12)', color: '#10b981' }}>Verified</span>
                </div>

                <div className="flex items-center justify-between rounded-xl px-4 py-3.5" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
                  <div>
                    <p className="text-[13px] font-semibold text-primary">Plan</p>
                    <p className="text-[11px] text-[var(--text-secondary)]">Ladder Flow Beta</p>
                  </div>
                  <span className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider" style={{ background: 'rgba(233,83,53,0.12)', color: 'var(--accent)', border: '1px solid rgba(233,83,53,0.25)' }}>Beta</span>
                </div>
              </div>
            </SectionCard>

            <div className="rounded-[16px] p-6" style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <h2 className="mb-1 text-[15px] font-extrabold text-primary">Danger Zone</h2>
              <p className="mb-5 text-[11px] text-[var(--text-secondary)]">These actions are permanent and cannot be undone.</p>
              <div className="flex flex-wrap gap-3">
                <button type="button"
                  onClick={() => { removeToken(); window.location.href = '/login'; }}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--surface-raised)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}>
                  <span className="material-symbols-outlined text-[16px]">logout</span>
                  Log Out
                </button>
                <button type="button"
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold transition-all hover:scale-[1.02]"
                  style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="screen-frame px-3 py-4 md:px-6 md:py-5">
      <DashboardTopBar />

        <div className="mb-4">
          <h1 className="text-[15px] font-extrabold tracking-tight text-primary sm:text-[17px]">Settings</h1>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Manage your profile, voice, and content preferences.</p>
        </div>

        <div className="flex flex-col gap-4 md:flex-row">
          {/* Sidebar nav */}
          <aside className="flex w-full shrink-0 flex-row gap-1 overflow-x-auto rounded-[14px] p-2 md:w-[220px] md:flex-col"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
            {NAV_ITEMS.map(item => (
              <button key={item.id} type="button" onClick={() => setActiveSection(item.id)}
                className="flex shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[12px] font-bold transition-all md:w-full"
                style={activeSection === item.id
                  ? { background: 'rgba(233,83,53,0.1)', color: 'var(--accent)', border: '1px solid rgba(233,83,53,0.2)' }
                  : { color: 'var(--text-secondary)', border: '1px solid transparent' }}>
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>{item.icon}</span>
                <span className="hidden md:block">{item.label}</span>
              </button>
            ))}
          </aside>

          {/* Content panel */}
          <div className="flex-1 min-w-0">
            {renderSection()}
          </div>
        </div>

    </div>
  );
}

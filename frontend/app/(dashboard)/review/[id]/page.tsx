'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { AssetCard } from '@/components/content/AssetCard';
import { TranscriptViewer } from '@/components/content/TranscriptViewer';
import { authHeaders } from '@/lib/auth';
import type {
  ContentOutput,
  ContentOutputPlatform,
  ContentOutputStatus,
  ContentPackResponse,
  ContentSignal,
} from '@/lib/types/content';

interface TranscriptSegment {
  speaker: string;
  content: string;
  startTime: number;
  endTime: number;
}

type ReviewTab = ContentOutputPlatform;

const TABS: Array<{ id: ReviewTab; label: string; icon: string; color: string }> = [
  { id: 'linkedin', label: 'LinkedIn', icon: 'work', color: '#0077b5' },
  { id: 'x', label: 'X Threads', icon: 'alternate_email', color: '#e5e7eb' },
  { id: 'newsletter', label: 'Newsletters', icon: 'mail', color: '#f59e0b' },
];

const SIGNAL_COLORS: Record<string, string> = {
  strong_opinion: 'var(--accent)',
  framework: '#6366f1',
  proof_point: '#10b981',
  contrarian_take: '#f59e0b',
  story: '#ec4899',
  tactical_advice: '#14b8a6',
  mistake_lesson: '#ef4444',
  founder_insight: '#8b5cf6',
  theme_cluster: '#64748b',
};

function parseTranscript(raw: string | null | undefined): TranscriptSegment[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      let currentTime = 0;
      return parsed
        .filter((msg: { content?: string }) => msg.content?.trim())
        .map((msg: { role?: string; content?: string }) => {
          const segment = {
            speaker: msg.role === 'assistant' ? 'AI Host' : 'You',
            content: msg.content || '',
            startTime: currentTime,
            endTime: currentTime + 30,
          };
          currentTime += 30;
          return segment;
        });
    }
  } catch {
    return raw
      .split('\n')
      .filter(Boolean)
      .map((line, index) => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        const speakerRaw = match?.[1]?.trim() || '';
        const content = match?.[2]?.trim() || line;
        const speaker = speakerRaw.toLowerCase().includes('ai') ? 'AI Host' : 'You';
        return {
          speaker,
          content,
          startTime: index * 30,
          endTime: (index + 1) * 30,
        };
      });
  }
  return [];
}

function platformLabel(platform: ContentOutputPlatform) {
  if (platform === 'linkedin') return 'LinkedIn Post';
  if (platform === 'x') return 'X Thread';
  return 'Newsletter';
}

function normalizeSignalLabel(type: string) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function collectSignals(outputs: ContentOutput[]): ContentSignal[] {
  const seen = new Set<string>();
  const signals: ContentSignal[] = [];

  for (const output of outputs) {
    const snapshot = output.signal_snapshot;
    if (!snapshot) continue;

    const nested = Array.isArray(snapshot.signals) ? snapshot.signals : [snapshot];
    for (const signal of nested) {
      if (!signal?.title) continue;
      const key = `${signal.type}:${signal.title}`;
      if (seen.has(key)) continue;
      seen.add(key);
      signals.push(signal);
    }
  }

  return signals.slice(0, 12);
}

function toUiStatus(output: ContentOutput) {
  return output.status === 'error' ? 'error' : 'ready';
}

export default function ReviewPage() {
  const params = useParams();
  const router = useRouter();
  const interviewId = params?.id ? String(params.id) : null;

  const [pack, setPack] = useState<ContentPackResponse | null>(null);
  const [outputs, setOutputs] = useState<ContentOutput[]>([]);
  const [activeTab, setActiveTab] = useState<ReviewTab>('linkedin');
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [activeSegment, setActiveSegment] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!interviewId) return;
    if (interviewId === 'new') {
      router.replace('/dashboard');
      return;
    }

    const loadPack = async () => {
      try {
        setIsLoading(true);
        setError('');
        const res = await fetch(`/api/content-pack/${interviewId}`, { headers: authHeaders() });
        if (!res.ok) throw new Error(`Failed to load content pack: ${res.status}`);
        const data = (await res.json()) as ContentPackResponse;
        setPack(data);
        setOutputs(data.outputs || []);
        setSegments(parseTranscript(data.interview?.raw_transcript));
      } catch (loadError) {
        console.error(loadError);
        setError(loadError instanceof Error ? loadError.message : 'Failed to load content pack.');
      } finally {
        setIsLoading(false);
      }
    };

    loadPack();
  }, [interviewId, router]);

  const topic = pack?.interview?.topic || 'Untitled Session';
  const summary = pack?.summary;
  const signals = useMemo(() => collectSignals(outputs), [outputs]);
  const publishedCount = outputs.filter((output) => output.status === 'published').length;

  const outputsByPlatform = useMemo(() => {
    return {
      linkedin: outputs.filter((output) => output.platform === 'linkedin'),
      x: outputs.filter((output) => output.platform === 'x'),
      newsletter: outputs.filter((output) => output.platform === 'newsletter'),
    };
  }, [outputs]);

  const updateOutput = (updated: ContentOutput) => {
    setOutputs((current) => current.map((output) => (output.id === updated.id ? updated : output)));
  };

  const handleEdit = async (output: ContentOutput, content: string) => {
    const res = await fetch(`/api/content-outputs/${output.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ edited_content: content, status: 'draft' }),
    });
    if (!res.ok) throw new Error(`Failed to save output: ${res.status}`);
    updateOutput((await res.json()) as ContentOutput);
  };

  const handleStatusChange = async (output: ContentOutput, status: ContentOutputStatus) => {
    const res = await fetch(`/api/content-outputs/${output.id}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(`Failed to update status: ${res.status}`);
    updateOutput((await res.json()) as ContentOutput);
  };

  const handleRegenerate = async (output: ContentOutput) => {
    const res = await fetch(`/api/content-outputs/${output.id}/regenerate`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ instruction: null }),
    });
    if (!res.ok) throw new Error(`Failed to regenerate output: ${res.status}`);
    updateOutput((await res.json()) as ContentOutput);
  };

  const handleArchive = async (output: ContentOutput) => {
    const res = await fetch(`/api/content-outputs/${output.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error(`Failed to archive output: ${res.status}`);
    setOutputs((current) => current.filter((item) => item.id !== output.id));
  };

  const handleSegmentClick = (time: number) => {
    const index = segments.findIndex((segment) => time >= segment.startTime && time < segment.endTime);
    setActiveSegment(index >= 0 ? index : undefined);
  };

  const handleExportPDF = () => {
    const date = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const escape = (str: string) =>
      str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const sectionHTML = (output: ContentOutput, index: number) => `
    <div class="section">
      <div class="section-header">
        <span class="platform-badge">${escape(platformLabel(output.platform))}</span>
        <span class="section-number">${String(index + 1).padStart(2, '0')}</span>
      </div>
      <h2>${escape(output.title || platformLabel(output.platform))}</h2>
      <div class="content-box">${escape(output.content)}</div>
    </div>`;

    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escape(topic)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1e293b; background: white; padding: 48px; max-width: 820px; margin: 0 auto; }
    .cover { text-align: center; padding: 56px 0 44px; border-bottom: 3px solid #E95335; margin-bottom: 48px; }
    .brand { font-size: 12px; font-weight: 800; letter-spacing: 0.18em; color: #E95335; text-transform: uppercase; margin-bottom: 18px; }
    h1 { font-size: 30px; line-height: 1.25; margin-bottom: 10px; }
    h2 { font-size: 18px; margin: 0 0 12px; }
    .section { margin-bottom: 44px; page-break-inside: avoid; }
    .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid #e2e8f0; }
    .platform-badge { display: inline-block; padding: 5px 14px; border-radius: 999px; font-size: 12px; font-weight: 700; color: #E95335; background: #fff1ed; text-transform: uppercase; }
    .section-number { font-size: 12px; color: #94a3b8; font-weight: 600; }
    .content-box { background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #E95335; border-radius: 8px; padding: 22px 24px; white-space: pre-wrap; line-height: 1.75; font-size: 14px; }
    .footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="cover">
    <div class="brand">Ladder Flow</div>
    <h1>${escape(topic)}</h1>
    <p>${date}</p>
  </div>
  ${outputs.map(sectionHTML).join('')}
  <div class="footer">Generated by Ladder Flow</div>
  <script>window.onload = () => { window.print(); };<\/script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) win.onafterprint = () => URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--accent)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <span className="material-symbols-outlined text-[40px] text-[var(--danger)]">error</span>
        <p className="text-[13px] text-[var(--text-secondary)]">{error}</p>
        <Link href="/dashboard" className="text-[12px] font-semibold text-[var(--accent)] hover:underline">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="screen-frame px-3 py-4 md:px-6 md:py-5">
      <DashboardTopBar
        title="Review"
        rightSlot={
          <button
            type="button"
            onClick={handleExportPDF}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[11px] font-bold transition-all hover:scale-[1.02]"
            style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
          >
            <span className="material-symbols-outlined text-[15px]">ios_share</span>
            Export All
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-kicker mb-1">Content Review</p>
          <h1 className="max-w-[920px] text-[17px] font-extrabold leading-tight tracking-tight text-primary sm:text-[22px]">
            {topic}
          </h1>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">
            {outputs.length} saved assets. {publishedCount} published.
          </p>
        </div>
        <Link href="/discover" className="accent-gradient inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-[12px] font-bold text-white shadow-[0_4px_12px_rgba(233,83,53,0.3)] transition-all hover:scale-[1.02]">
          <span className="material-symbols-outlined text-[14px]">add</span>
          New Session
        </Link>
      </div>

      <div className="grid min-h-[calc(100vh-170px)] grid-cols-1 gap-3 xl:grid-cols-[minmax(360px,0.4fr)_minmax(0,0.6fr)]">
        <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-[18px]" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="border-b px-4 py-3" style={{ borderColor: 'var(--border-default)' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[12px] font-bold text-primary">Transcript</h2>
                <p className="text-[10px] text-[var(--text-secondary)]">{segments.length} captured turns</p>
              </div>
              {summary && (
                <div className="text-right">
                  <p className="text-[12px] font-extrabold text-primary">{summary.usable_signal_count}</p>
                  <p className="text-[10px] text-[var(--text-secondary)]">signals</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-b px-3 py-2" style={{ borderColor: 'var(--border-default)' }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[var(--text-secondary)]">Signal Units</p>
              <span className="text-[9px] text-[var(--text-secondary)]">{signals.length} used</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {signals.length > 0 ? signals.map((signal) => {
                const color = SIGNAL_COLORS[signal.type] || 'var(--accent)';
                return (
                  <button
                    key={`${signal.type}:${signal.title}`}
                    type="button"
                    className="min-w-0 rounded-lg px-2 py-1.5 text-left transition-all hover:-translate-y-px"
                    style={{ border: `1px solid ${color}35`, background: `${color}12` }}
                  >
                    <span className="block truncate text-[10px] font-bold" style={{ color }}>{normalizeSignalLabel(signal.type)}</span>
                    <span className="block truncate text-[10px] text-primary">{signal.title}</span>
                  </button>
                );
              }) : (
                <p className="text-[11px] text-[var(--text-secondary)]">No signal snapshots found.</p>
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1">
            {segments.length > 0 ? (
              <TranscriptViewer segments={segments} activeSegment={activeSegment} onSegmentClick={handleSegmentClick} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <span className="material-symbols-outlined mb-2 text-[34px] text-[var(--text-secondary)]">forum</span>
                <p className="text-[12px] font-semibold text-primary">No transcript found</p>
                <p className="mt-1 text-[11px] text-[var(--text-secondary)]">The content pack is saved, but transcript text is missing.</p>
              </div>
            )}
          </div>

          <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border-default)' }}>
            <Link href="/dashboard" className="text-[10px] font-semibold text-[var(--accent)] hover:underline">Back to Dashboard</Link>
          </div>
        </aside>

        <main className="flex min-h-[520px] min-w-0 flex-col overflow-hidden rounded-[18px]" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2" style={{ borderColor: 'var(--border-default)' }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.id;
              const count = outputsByPlatform[tab.id].length;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all"
                  style={active ? { background: `${tab.color}18`, color: tab.color, border: `1px solid ${tab.color}35` } : { color: 'var(--text-secondary)', border: '1px solid transparent' }}
                >
                  <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>{tab.icon}</span>
                  {tab.label}
                  <span className="rounded-full px-1.5 py-0.5 text-[9px]" style={{ background: 'var(--surface-raised)' }}>{count}</span>
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
            {outputsByPlatform[activeTab].length > 0 ? (
              <div className="space-y-3">
                {outputsByPlatform[activeTab].map((output) => (
                  <AssetCard
                    key={output.id}
                    platform={output.platform}
                    title={output.title}
                    status={toUiStatus(output)}
                    outputStatus={output.status}
                    content={output.content}
                    onEdit={(content) => handleEdit(output, content)}
                    onStatusChange={(status) => handleStatusChange(output, status)}
                    onRegenerate={() => handleRegenerate(output)}
                    onArchive={() => handleArchive(output)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                <span className="material-symbols-outlined mb-2 text-[34px] text-[var(--text-secondary)]">draft</span>
                <p className="text-[12px] font-semibold text-primary">No {TABS.find((tab) => tab.id === activeTab)?.label} outputs</p>
                <p className="mt-1 max-w-sm text-[11px] text-[var(--text-secondary)]">
                  This pack did not generate saved assets for the selected platform.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

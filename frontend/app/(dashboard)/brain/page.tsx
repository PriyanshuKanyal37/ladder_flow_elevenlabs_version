'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { DashboardTopBar } from '@/components/layout/DashboardTopBar';
import { authHeaders } from '@/lib/auth';
import type { ForceGraphMethods } from 'react-force-graph-2d';

const TRUST_CYCLE: Record<TrustTier, TrustTier> = { high: 'medium', medium: 'low', low: 'high' };
const TRUST_TO_TIER: Record<TrustTier, string> = { high: 'A', medium: 'B', low: 'C' };

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ── Types ────────────────────────────────────────────────────────────────────

type MemoryType = 'all' | 'opinion' | 'framework' | 'story' | 'proof_point';
type TrustTier = 'high' | 'medium' | 'low';
type Visibility = 'private' | 'publishable';

interface MemoryItem {
  id: string;
  type: Omit<MemoryType, 'all'>;
  content: string;
  topic: string;
  trust_tier: TrustTier;
  visibility: Visibility;
  created_at: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations?: string[];
}

interface GraphNode {
  id: string;
  type: 'memory' | 'topic' | 'interview' | 'user' | 'audience' | 'content_style' | 'platform';
  node_kind?: 'memory' | 'topic' | 'interview' | 'user' | 'audience' | 'content_style' | 'platform';
  label: string;
  display_name?: string;
  subtitle?: string;
  memory_type?: string;
  trust_tier?: string;
  content?: string;
  category?: string;
  depth?: string;
  // injected by force-graph
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  relation: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: string; color: string }> = {
  opinion:     { label: 'Opinion',     icon: 'chat_bubble',  color: '#E95335' },
  framework:   { label: 'Framework',   icon: 'account_tree', color: '#6366f1' },
  story:       { label: 'Story',       icon: 'auto_stories', color: '#ec4899' },
  proof_point: { label: 'Proof Point', icon: 'verified',     color: '#10b981' },
  proof:       { label: 'Proof',       icon: 'verified',     color: '#10b981' },
  belief:      { label: 'Belief',      icon: 'favorite',     color: '#f59e0b' },
  style:       { label: 'Style',       icon: 'style',        color: '#06b6d4' },
};

const TRUST_META: Record<TrustTier, { label: string; color: string }> = {
  high:   { label: 'High Trust',  color: '#10b981' },
  medium: { label: 'Med Trust',   color: '#f59e0b' },
  low:    { label: 'Low Trust',   color: '#ef4444' },
};

const NODE_COLOR: Record<string, (n: GraphNode) => string> = {
  memory:    n => (TYPE_META[n.memory_type || 'opinion'] || TYPE_META.opinion).color,
  topic:     () => '#8b5cf6',
  interview: () => '#f97316',
  user:      () => '#38bdf8',
  audience:  () => '#14b8a6',
  content_style: () => '#f59e0b',
  platform:  () => '#22c55e',
};

const LINK_COLOR: Record<string, string> = {
  ABOUT_TOPIC:   'rgba(139,92,246,0.55)',
  PRODUCED:      'rgba(249,115,22,0.55)',
  HAS_MEMORY:    'rgba(56,189,248,0.55)',
  CONDUCTED:     'rgba(251,191,36,0.6)',
  SUPPORTS:      'rgba(16,185,129,0.7)',
  CONTRADICTS:   'rgba(239,68,68,0.7)',
  ILLUSTRATES:   'rgba(99,102,241,0.7)',
  EVOLVED_FROM:  'rgba(59,130,246,0.7)',
  SPECIALIZES_IN: 'rgba(139,92,246,0.7)',
  OPERATES_IN:   'rgba(99,102,241,0.7)',
  SPEAKS_TO:     'rgba(20,184,166,0.7)',
  WRITES_IN:     'rgba(245,158,11,0.7)',
  FOCUSES_ON:    'rgba(168,85,247,0.7)',
  PUBLISHES_ON:  'rgba(34,197,94,0.7)',
  RELATED_TO:    'rgba(148,163,184,0.5)',
  EXPERT_IN:     'rgba(16,185,129,0.75)',
  KNOWS_ABOUT:   'rgba(245,158,11,0.75)',
  CURIOUS_ABOUT: 'rgba(59,130,246,0.75)',
};

const CHAT_STARTERS = [
  'What frameworks have I talked about most?',
  'Find my strongest proof points',
  'What are my recurring opinions on sales?',
  'Show me everything about content strategy',
];

// ── Sub-components ────────────────────────────────────────────────────────────

function EditMemoryModal({
  item,
  onSave,
  onClose,
}: {
  item: MemoryItem;
  onSave: (text: string) => Promise<void>;
  onClose: () => void;
}) {
  const meta = TYPE_META[item.type as string] || TYPE_META.opinion;
  const [text, setText] = useState(item.content);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const trimmed = text.trim();
    if (!trimmed || isSaving) return;
    setIsSaving(true);
    await onSave(trimmed);
    setIsSaving(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSave(); }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-xl flex flex-col gap-4 rounded-[18px] p-6 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
              {meta.label}
            </span>
            {item.topic && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
                {item.topic}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-all hover:opacity-70"
            style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
            <span className="material-symbols-outlined text-[14px] text-[var(--text-secondary)]">close</span>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={8}
          placeholder="Edit memory content…"
          className="w-full rounded-xl px-4 py-3 text-[13px] leading-relaxed text-[var(--text-primary)] outline-none resize-none focus:ring-1 focus:ring-[var(--accent)]"
          style={{ background: 'var(--background)', border: '1px solid var(--border-default)', minHeight: '180px' }}
        />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[var(--text-secondary)]">Ctrl+Enter to save · Esc to close</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} disabled={isSaving}
              className="rounded-lg px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={isSaving || !text.trim() || text.trim() === item.content}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-semibold transition-all disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#fff' }}>
              {isSaving
                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                : <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check</span>}
              Save changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({
  item,
  onConfirm,
  onClose,
}: {
  item: MemoryItem;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const meta = TYPE_META[item.type as string] || TYPE_META.opinion;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm flex flex-col gap-4 rounded-[18px] p-6 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid rgba(239,68,68,0.3)' }}
      >
        {/* Icon + title */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <span className="material-symbols-outlined text-[22px]" style={{ color: '#ef4444', fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
          </div>
          <div>
            <p className="text-[14px] font-bold text-primary">Delete this memory?</p>
            <p className="mt-1 text-[11px] text-[var(--text-secondary)]">This cannot be undone. The memory will be removed from your Digital Brain and will no longer influence future interviews.</p>
          </div>
        </div>

        {/* Memory preview */}
        <div className="rounded-[10px] px-3 py-2.5" style={{ background: 'var(--background)', border: '1px solid var(--border-default)' }}>
          <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold mb-1.5"
            style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
            {meta.label}
          </span>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] line-clamp-3">{item.content}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-[12px] font-semibold transition-all"
            style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
            Cancel
          </button>
          <button type="button" onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[12px] font-bold transition-all hover:opacity-90"
            style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
            <span className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>delete_forever</span>
            Yes, delete
          </button>
        </div>
      </div>
    </div>
  );
}

function MemoryCard({
  item,
  onUpdate,
  onDelete,
}: {
  item: MemoryItem;
  onUpdate: (id: string, patch: Partial<MemoryItem>) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const meta = TYPE_META[item.type as string] || TYPE_META.opinion;
  const trust = TRUST_META[item.trust_tier];
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  return (
    <>
      {isEditOpen && (
        <EditMemoryModal
          item={item}
          onSave={text => onUpdate(item.id, { content: text })}
          onClose={() => setIsEditOpen(false)}
        />
      )}
      {isConfirmingDelete && (
        <DeleteConfirmModal
          item={item}
          onConfirm={() => { setIsConfirmingDelete(false); onDelete(item.id); }}
          onClose={() => setIsConfirmingDelete(false)}
        />
      )}

      <div className="rounded-[14px] p-4 flex flex-col gap-3 transition-all hover:translate-y-[-1px]"
        style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>

        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold"
              style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
              <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
              {meta.label}
            </span>
            {/* Trust tier — click to cycle A→B→C */}
            <button
              type="button"
              title="Click to change trust tier"
              onClick={() => onUpdate(item.id, { trust_tier: TRUST_CYCLE[item.trust_tier] })}
              className="rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider transition-all hover:opacity-70 cursor-pointer"
              style={{ background: `${trust.color}12`, color: trust.color }}>
              {trust.label}
            </button>
          </div>

          {/* Action buttons — icon only */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Edit — opens modal */}
            <button type="button" onClick={() => setIsEditOpen(true)} title="Edit memory"
              className="flex h-6 w-6 items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)' }}>
              <span className="material-symbols-outlined text-[12px] text-[var(--text-secondary)]">edit</span>
            </button>
            {/* Delete — opens confirm modal */}
            <button type="button" onClick={() => setIsConfirmingDelete(true)} title="Delete memory"
              className="flex h-6 w-6 items-center justify-center rounded-lg transition-all hover:opacity-70"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="material-symbols-outlined text-[12px]" style={{ color: '#ef4444' }}>delete</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <p className="text-[13px] leading-relaxed text-[var(--text-primary)]">{item.content}</p>

        {/* Footer row */}
        <div className="flex items-center justify-between">
          <span className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
            style={{ background: 'var(--surface-raised)', color: 'var(--text-secondary)' }}>
            {item.topic}
          </span>
          {item.created_at && (
            <span className="text-[9px] text-[var(--text-secondary)]">
              {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>
    </>
  );
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'rgba(233,83,53,0.15)', border: '1px solid rgba(233,83,53,0.2)' }}>
          <span className="material-symbols-outlined text-[13px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
        </div>
      )}
      <div className="max-w-[80%]">
        <div className="rounded-[14px] px-4 py-3 text-[13px] leading-relaxed"
          style={isUser
            ? { background: 'var(--accent)', color: '#fff', borderBottomRightRadius: '4px' }
            : { background: 'var(--surface)', border: '1px solid var(--border-default)', color: 'var(--text-primary)', borderBottomLeftRadius: '4px' }}>
          {msg.content}
        </div>
        {msg.citations && msg.citations.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {msg.citations.map((c, i) => (
              <span key={i} className="rounded-full px-2 py-0.5 text-[9px] font-semibold"
                style={{ background: 'rgba(99,102,241,0.12)', color: '#6366f1', border: '1px solid rgba(99,102,241,0.2)' }}>
                {c}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Graph Legend ──────────────────────────────────────────────────────────────

function GraphLegend({ isDarkMode }: { isDarkMode: boolean }) {
  const panelStyle = isDarkMode
    ? {
        background: 'rgba(0,0,0,0.55)',
        border: '1px solid rgba(255,255,255,0.08)',
        backdropFilter: 'blur(8px)',
        maxHeight: 'calc(100% - 2rem)',
        overflowY: 'auto' as const,
      }
    : {
        background: 'rgba(255,255,255,0.92)',
        border: '1px solid rgba(15,23,42,0.14)',
        backdropFilter: 'blur(8px)',
        maxHeight: 'calc(100% - 2rem)',
        overflowY: 'auto' as const,
      };
  const titleColor = isDarkMode ? 'rgba(148,163,184,0.95)' : 'rgba(51,65,85,0.9)';
  const textColor = isDarkMode ? 'rgba(148,163,184,0.9)' : 'rgba(30,41,59,0.85)';
  return (
    <div className="absolute bottom-4 left-4 rounded-[12px] p-3 flex flex-col gap-2 z-10"
      style={panelStyle}>
      <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: titleColor }}>Nodes</p>
      {[
        { color: '#38bdf8', label: 'You' },
        { color: '#E95335', label: 'Opinion' },
        { color: '#6366f1', label: 'Framework' },
        { color: '#ec4899', label: 'Story' },
        { color: '#10b981', label: 'Proof' },
        { color: '#f59e0b', label: 'Belief' },
        { color: '#06b6d4', label: 'Style' },
        { color: '#8b5cf6', label: 'Topic' },
        { color: '#f97316', label: 'Interview' },
        { color: '#14b8a6', label: 'Audience' },
        { color: '#f59e0b', label: 'Content Style' },
        { color: '#22c55e', label: 'Platform' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
          <span className="text-[10px]" style={{ color: textColor }}>{label}</span>
        </div>
      ))}
      <p className="text-[9px] font-bold uppercase tracking-widest mt-1 mb-0.5" style={{ color: titleColor }}>Relations</p>
      {[
        { color: 'rgba(16,185,129,0.9)',  label: 'Supports' },
        { color: 'rgba(239,68,68,0.9)',   label: 'Contradicts' },
        { color: 'rgba(99,102,241,0.9)',  label: 'Illustrates' },
        { color: 'rgba(59,130,246,0.9)',  label: 'Evolved From' },
        { color: 'rgba(249,115,22,0.7)',  label: 'Produced by' },
        { color: 'rgba(139,92,246,0.7)',  label: 'About Topic' },
        { color: 'rgba(56,189,248,0.7)',  label: 'Has Memory' },
        { color: 'rgba(20,184,166,0.7)',  label: 'Speaks To' },
        { color: 'rgba(245,158,11,0.7)',  label: 'Writes In' },
        { color: 'rgba(34,197,94,0.7)',   label: 'Publishes On' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 shrink-0 rounded" style={{ background: color }} />
          <span className="text-[10px]" style={{ color: textColor }}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Node Detail Panel ─────────────────────────────────────────────────────────

function NodeDetail({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const kind = node.node_kind || node.type;
  const isMemory = kind === 'memory';
  const isTopic = kind === 'topic';
  const isInterview = kind === 'interview';
  const isUser = kind === 'user';
  const isAudience = kind === 'audience';
  const isStyle = kind === 'content_style';
  const isPlatform = kind === 'platform';
  const meta = isMemory ? (TYPE_META[node.memory_type || 'opinion'] || TYPE_META.opinion) : null;
  const displayName = node.display_name || node.label || 'Untitled';

  return (
    <div className="absolute top-4 right-4 w-64 rounded-[14px] p-4 flex flex-col gap-3 z-10 animate-fade-in"
      style={{ background: 'rgba(10,10,12,0.85)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isMemory && meta && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: `${meta.color}20`, color: meta.color, border: `1px solid ${meta.color}35` }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
              {meta.label}
            </span>
          )}
          {isTopic && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(139,92,246,0.2)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>tag</span>
              Topic
            </span>
          )}
          {isInterview && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>mic</span>
              Interview
            </span>
          )}
          {isUser && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(56,189,248,0.2)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
              User
            </span>
          )}
          {isAudience && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(20,184,166,0.2)', color: '#14b8a6', border: '1px solid rgba(20,184,166,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>groups</span>
              Audience
            </span>
          )}
          {isStyle && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>palette</span>
              Content Style
            </span>
          )}
          {isPlatform && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold"
              style={{ background: 'rgba(34,197,94,0.2)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
              <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>public</span>
              Platform
            </span>
          )}
        </div>
        <button type="button" onClick={onClose}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70"
          style={{ background: 'rgba(255,255,255,0.08)' }}>
          <span className="material-symbols-outlined text-[12px] text-[var(--text-secondary)]">close</span>
        </button>
      </div>

      <p className="text-[12px] leading-relaxed text-white font-medium">{displayName}</p>
      {node.subtitle && (
        <p className="text-[10px] text-[var(--text-secondary)]">{node.subtitle}</p>
      )}

      {isMemory && node.trust_tier && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Trust</span>
          <span className="text-[9px] font-bold rounded-full px-2 py-0.5"
            style={{
              background: node.trust_tier === 'A' ? 'rgba(16,185,129,0.15)' : node.trust_tier === 'B' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              color: node.trust_tier === 'A' ? '#10b981' : node.trust_tier === 'B' ? '#f59e0b' : '#ef4444',
            }}>
            Tier {node.trust_tier}
          </span>
        </div>
      )}

      {isTopic && node.depth && (
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">Depth</span>
          <span className="text-[9px] font-bold text-[#8b5cf6] capitalize">{node.depth}</span>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DigitalBrainPage() {
  const [activeView, setActiveView] = useState<'library' | 'chat' | 'graph'>('graph');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Memory Library state
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [filterType, setFilterType] = useState<MemoryType>('all');
  const [filterTrust, setFilterTrust] = useState<TrustTier | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoadingMemories, setIsLoadingMemories] = useState(false);

  // Brain Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Ask me anything about your stored knowledge. I can find your strongest frameworks, proof points, opinions, and stories across all your sessions.' },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Graph state
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);
  const [hasLoadedGraph, setHasLoadedGraph] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [graphDimensions, setGraphDimensions] = useState({ width: 600, height: 500 });
  const [graphZoom, setGraphZoom] = useState(1);
  const graphZoomRef = useRef(1);
  const graphZoomRafRef = useRef<number | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const controlPanelStyle = isDarkMode
    ? { background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)' }
    : { background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(15,23,42,0.16)', backdropFilter: 'blur(8px)' };
  const controlIconColor = isDarkMode ? 'rgba(148,163,184,0.95)' : 'rgba(51,65,85,0.92)';
  const controlCountColor = isDarkMode ? '#ffffff' : 'rgba(15,23,42,0.96)';
  const controlLabelColor = isDarkMode ? 'rgba(148,163,184,0.92)' : 'rgba(51,65,85,0.85)';

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    return () => {
      if (graphZoomRafRef.current !== null) {
        cancelAnimationFrame(graphZoomRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const root = document.documentElement;

    const syncTheme = () => {
      setIsDarkMode(root.classList.contains('dark'));
    };

    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Fetch memories
  useEffect(() => {
    setIsLoadingMemories(true);
    fetch('/api/brain/memories', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        setMemories(Array.isArray(data) ? (data as MemoryItem[]) : []);
      })
      .catch(() => {})
      .finally(() => setIsLoadingMemories(false));
  }, []);

  // Fetch graph when tab activates
  useEffect(() => {
    if (activeView !== 'graph' || hasLoadedGraph) return;
    setIsLoadingGraph(true);
    fetch('/api/brain/graph', { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.nodes) setGraphData(data);
      })
      .catch(() => {})
      .finally(() => {
        setHasLoadedGraph(true);
        setIsLoadingGraph(false);
      });
  }, [activeView, hasLoadedGraph]);

  // Track container size for the canvas.
  // Must run when graph view mounts; otherwise width/height stay at defaults.
  useEffect(() => {
    if (activeView !== 'graph' || !graphContainerRef.current) return;

    const node = graphContainerRef.current;
    const rect = node.getBoundingClientRect();
    setGraphDimensions({ width: rect.width, height: rect.height });

    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setGraphDimensions({ width, height });
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [activeView]);

  // Zoom to fit after graph loads
  useEffect(() => {
    if (activeView === 'graph' && graphData.nodes.length > 0 && fgRef.current) {
      setTimeout(() => fgRef.current?.zoomToFit(500, 40), 300);
    }
  }, [activeView, graphData.nodes.length]);

  const filteredMemories = memories.filter(m => {
    if (filterType !== 'all' && m.type !== filterType) return false;
    if (filterTrust !== 'all' && m.trust_tier !== filterTrust) return false;
    if (searchQuery && !m.content.toLowerCase().includes(searchQuery.toLowerCase()) && !m.topic.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const memoryCounts = {
    opinion:     memories.filter(m => m.type === 'opinion').length,
    framework:   memories.filter(m => m.type === 'framework').length,
    story:       memories.filter(m => m.type === 'story').length,
    proof_point: memories.filter(m => m.type === 'proof_point').length,
  };

  const handleUpdate = async (id: string, patch: Partial<MemoryItem>) => {
    const original = memories.find(m => m.id === id);
    if (!original) return;

    // Optimistic update
    setMemories(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));

    // Map frontend shape → backend API shape
    const apiPatch: Record<string, string> = {};
    if (patch.content !== undefined) apiPatch.content_text = patch.content;
    if (patch.trust_tier !== undefined) apiPatch.trust_tier = TRUST_TO_TIER[patch.trust_tier as TrustTier];
    if (patch.visibility !== undefined) apiPatch.privacy_mode = patch.visibility;

    try {
      const res = await fetch(`/api/brain/memories/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPatch),
      });
      if (!res.ok) throw new Error('patch_failed');
    } catch {
      // Rollback to original on failure
      setMemories(prev => prev.map(m => m.id === id ? original : m));
    }
  };

  const handleDelete = (id: string) => {
    if (!id || id === 'undefined') {
      console.error('handleDelete called with invalid id:', id);
      return;
    }
    const snapshot = [...memories];
    setMemories(prev => prev.filter(m => m.id !== id));

    fetch(`/api/brain/memories/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).then(res => {
      if (!res.ok) setMemories(snapshot);
    }).catch(() => setMemories(snapshot));
  };

  const handleSendChat = async () => {
    const q = chatInput.trim();
    if (!q || isChatLoading) return;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: q }]);
    setIsChatLoading(true);
    try {
      const res = await fetch('/api/brain/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: data.answer || 'I could not find relevant memories for that query.',
        citations: data.citations || [],
      }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Something went wrong. Please try again.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Graph callbacks
  const nodeColor = useCallback((node: object) => {
    const n = node as GraphNode;
    const kind = n.node_kind || n.type;
    return (NODE_COLOR[kind] || (() => '#888'))(n);
  }, []);

  const nodeVal = useCallback((node: object) => {
    const n = node as GraphNode;
    const kind = n.node_kind || n.type;
    if (kind === 'user') return 10;
    if (kind === 'interview') return 8;
    if (kind === 'topic') return 5;
    if (kind === 'audience' || kind === 'content_style' || kind === 'platform') return 5;
    return 6;
  }, []);

  const linkColor = useCallback((link: object) => {
    const l = link as GraphLink;
    return LINK_COLOR[l.relation] || (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(15,23,42,0.28)');
  }, [isDarkMode]);

  const nodeCanvasObject = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GraphNode;
    const kind = n.node_kind || n.type;
    const x = n.x ?? 0;
    const y = n.y ?? 0;
    const color = (NODE_COLOR[kind] || (() => '#888'))(n);
    const r = kind === 'user' ? 11 : kind === 'interview' ? 10 : kind === 'topic' ? 6 : 7;

    // Glow
    ctx.save();
    ctx.shadowBlur = 12;
    ctx.shadowColor = color;
    ctx.fillStyle = color + '33';
    ctx.beginPath();
    ctx.arc(x, y, r + 3, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Node circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label (only when zoomed in enough)
    if (globalScale > 1.5 || kind === 'interview' || kind === 'topic' || kind === 'user') {
      const baseLabel = n.display_name || n.label;
      const label = baseLabel.length > 22 ? baseLabel.slice(0, 22) + '...' : baseLabel;
      const fontSize = kind === 'user' ? 6 : kind === 'interview' ? 5 : 4;
      const fontPx = fontSize / globalScale * 2;
      ctx.font = `${fontPx}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const labelY = y + r + 5 / globalScale;
      const textWidth = ctx.measureText(label).width;
      const padX = 4 / globalScale;
      const padY = 2 / globalScale;
      ctx.fillStyle = isDarkMode ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(
        x - textWidth / 2 - padX,
        labelY - fontPx / 2 - padY,
        textWidth + padX * 2,
        fontPx + padY * 2
      );
      ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.92)' : 'rgba(15,23,42,0.92)';
      ctx.fillText(label, x, labelY);
    }
  }, [isDarkMode]);

  const handleNodeClick = useCallback((node: object) => {
    setSelectedNode(prev => {
      const n = node as GraphNode;
      return prev?.id === n.id ? null : n;
    });
  }, []);

  const handleGraphZoom = useCallback((event: { k?: number }) => {
    const nextZoom = event?.k;
    if (!Number.isFinite(nextZoom)) return;

    graphZoomRef.current = nextZoom as number;
    if (graphZoomRafRef.current !== null) return;

    graphZoomRafRef.current = requestAnimationFrame(() => {
      graphZoomRafRef.current = null;
      setGraphZoom(graphZoomRef.current);
    });
  }, []);

  return (
    <div className="screen-frame px-3 py-4 md:px-6 md:py-5">
      <DashboardTopBar />

      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[15px] font-extrabold tracking-tight text-primary sm:text-[17px]">Digital Brain</h1>
          <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">Your accumulated knowledge, opinions, and frameworks.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl p-1" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }}>
          {(['library', 'chat', 'graph'] as const).map(v => (
            <button key={v} type="button" onClick={() => setActiveView(v)}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[12px] font-bold transition-all"
              style={activeView === v
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text-secondary)' }}>
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {v === 'library' ? 'library_books' : v === 'chat' ? 'chat' : 'hub'}
              </span>
              {v === 'library' ? 'Memory Library' : v === 'chat' ? 'Brain Chat' : 'Knowledge Graph'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(memoryCounts).map(([type, count]) => {
          const meta = TYPE_META[type];
          return (
            <button key={type} type="button" onClick={() => { setFilterType(type as MemoryType); setActiveView('library'); }}
              className="flex items-center gap-2.5 rounded-[12px] px-3 py-3 text-left transition-all hover:scale-[1.01]"
              style={{ background: 'var(--surface)', border: `1px solid ${filterType === type ? meta.color + '40' : 'var(--border-default)'}` }}>
              <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: meta.color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
              <div>
                <p className="text-[18px] font-extrabold text-primary leading-none">{count}</p>
                <p className="text-[10px] text-[var(--text-secondary)]">{meta.label}s</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={{ height: 'calc(100vh - 265px)' }}>

        {/* ── Memory Library ── */}
        {activeView === 'library' && (
          <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--text-secondary)]">search</span>
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search memories..."
                  className="w-full rounded-xl py-2 pl-8 pr-3 text-[12px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border-default)' }} />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'opinion', 'framework', 'story', 'proof_point'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setFilterType(t)}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={filterType === t
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    {t === 'all' ? 'All' : t === 'proof_point' ? 'Proof' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'high', 'medium', 'low'] as const).map(t => (
                  <button key={t} type="button" onClick={() => setFilterTrust(t)}
                    className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all"
                    style={filterTrust === t
                      ? { background: 'var(--accent)', color: '#fff' }
                      : { background: 'var(--surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)' }}>
                    {t === 'all' ? 'All Trust' : t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {isLoadingMemories ? (
                <div className="flex items-center justify-center py-12">
                  <span className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                </div>
              ) : filteredMemories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <span className="material-symbols-outlined text-[40px] text-[var(--text-secondary)] mb-3">search_off</span>
                  <p className="text-[13px] font-semibold text-primary">No memories match your filters</p>
                  <button type="button" onClick={() => { setFilterType('all'); setFilterTrust('all'); setSearchQuery(''); }}
                    className="mt-3 text-[12px] font-semibold text-[var(--accent)] hover:underline">Clear filters</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredMemories.map(item => (
                    <MemoryCard key={item.id} item={item} onUpdate={handleUpdate} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Brain Chat ── */}
        {activeView === 'chat' && (
          <div className="flex h-full flex-col rounded-[14px]" style={{ background: 'var(--surface)', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => <ChatBubble key={i} msg={msg} />)}
              {isChatLoading && (
                <div className="flex justify-start">
                  <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                    style={{ background: 'rgba(233,83,53,0.15)', border: '1px solid rgba(233,83,53,0.2)' }}>
                    <span className="material-symbols-outlined text-[13px] text-[var(--accent)]" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                  </div>
                  <div className="rounded-[14px] px-4 py-3" style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', borderBottomLeftRadius: '4px' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.15s]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)] animate-bounce [animation-delay:0.3s]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            {chatMessages.length <= 1 && (
              <div className="border-t px-4 py-3 flex flex-wrap gap-2" style={{ borderColor: 'var(--border-default)' }}>
                {CHAT_STARTERS.map(s => (
                  <button key={s} type="button" onClick={() => setChatInput(s)}
                    className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all hover:scale-[1.02]"
                    style={{ background: 'var(--surface-raised)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}>
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div className="border-t p-3 flex items-center gap-2" style={{ borderColor: 'var(--border-default)' }}>
              <input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Ask about your knowledge..."
                className="flex-1 rounded-xl px-4 py-2.5 text-[13px] text-[var(--text-primary)] outline-none focus:ring-1 focus:ring-[var(--accent)]"
                style={{ background: 'var(--background)', border: '1px solid var(--border-default)' }}
              />
              <button type="button" onClick={handleSendChat} disabled={!chatInput.trim() || isChatLoading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all hover:scale-[1.05] disabled:opacity-40"
                style={{ background: 'var(--accent)' }}>
                <span className="material-symbols-outlined text-[18px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>send</span>
              </button>
            </div>
          </div>
        )}

        {/* ── Knowledge Graph ── */}
        {activeView === 'graph' && (
          <div ref={graphContainerRef} className="relative h-full w-full rounded-[14px] overflow-hidden"
            style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(233,83,53,0.04) 0%, rgba(0,0,0,0) 70%), var(--background)', border: '1px solid var(--border-default)' }}>

            {isLoadingGraph && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
                <span className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
                <p className="text-[12px] text-[var(--text-secondary)]">Loading knowledge graph…</p>
              </div>
            )}

            {!isLoadingGraph && graphData.nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-20">
                <span className="material-symbols-outlined text-[48px] text-[var(--text-secondary)]" style={{ fontVariationSettings: "'FILL' 1" }}>hub</span>
                <p className="text-[14px] font-semibold text-primary">No knowledge graph yet</p>
                <p className="text-[12px] text-[var(--text-secondary)]">Complete onboarding or interviews to build your Digital Brain graph.</p>
              </div>
            )}

            {!isLoadingGraph && graphData.nodes.length > 0 && (
              <>
                <ForceGraph2D
                  ref={fgRef}
                  graphData={graphData}
                  width={graphDimensions.width}
                  height={graphDimensions.height}
                  backgroundColor="transparent"
                  nodeColor={nodeColor}
                  nodeVal={nodeVal}
                  nodeCanvasObject={nodeCanvasObject}
                  nodeCanvasObjectMode={() => 'replace'}
                  linkColor={linkColor}
                  linkWidth={1.2}
                  linkDirectionalArrowLength={4}
                  linkDirectionalArrowRelPos={1}
                  linkDirectionalParticles={1}
                  linkDirectionalParticleWidth={1.5}
                  linkDirectionalParticleColor={linkColor}
                  onNodeClick={handleNodeClick}
                  onBackgroundClick={() => setSelectedNode(null)}
                  onZoom={handleGraphZoom}
                  cooldownTicks={120}
                  d3AlphaDecay={0.015}
                  d3VelocityDecay={0.3}
                />

                <GraphLegend isDarkMode={isDarkMode} />

                {selectedNode && (
                  <NodeDetail node={selectedNode} onClose={() => setSelectedNode(null)} />
                )}

                {/* Controls */}
                <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                  <button type="button"
                    onClick={() => fgRef.current?.zoom(Math.min(graphZoom * 1.2, 8), 220)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:scale-105"
                    style={controlPanelStyle}
                    title="Zoom in">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: controlIconColor }}>add</span>
                  </button>
                  <button type="button"
                    onClick={() => fgRef.current?.zoom(Math.max(graphZoom / 1.2, 0.3), 220)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-all hover:scale-105"
                    style={controlPanelStyle}
                    title="Zoom out">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: controlIconColor }}>remove</span>
                  </button>
                  <div className="rounded-lg px-2 py-1.5 text-center"
                    style={controlPanelStyle}>
                    <p className="text-[10px] font-bold" style={{ color: controlCountColor }}>{graphData.nodes.length}</p>
                    <p className="text-[8px]" style={{ color: controlLabelColor }}>nodes</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </div>
    </div>
  );
}

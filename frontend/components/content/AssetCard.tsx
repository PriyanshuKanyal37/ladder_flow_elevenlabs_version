'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Skeleton } from '@/components/ui/Skeleton';
import type { ContentOutputStatus, ContentPlatform, ContentStatus } from '@/lib/types/content';

interface AssetCardProps {
  platform: ContentPlatform;
  status: ContentStatus;
  content: string;
  title?: string | null;
  outputStatus?: ContentOutputStatus;
  onRegenerate?: () => void | Promise<void>;
  onCopy?: () => void;
  onEdit?: (newContent: string) => void | Promise<void>;
  onStatusChange?: (status: ContentOutputStatus) => void | Promise<void>;
  onArchive?: () => void | Promise<void>;
}

const platformConfig: Record<ContentPlatform, { name: string; icon: React.ReactNode; color: string }> = {
  linkedin: {
    name: 'LinkedIn Post',
    icon: <span className="font-bold text-base">in</span>,
    color: 'bg-[#0077b5]',
  },
  x: {
    name: 'X Thread',
    icon: <span className="font-bold text-base">X</span>,
    color: 'bg-black',
  },
  twitter: {
    name: 'Twitter Thread',
    icon: <span className="font-bold text-base">X</span>,
    color: 'bg-black',
  },
  newsletter: {
    name: 'Newsletter',
    icon: <span className="material-symbols-outlined text-[18px]">mail</span>,
    color: 'bg-orange-500',
  },
  carousel: {
    name: 'Carousel',
    icon: <span className="material-symbols-outlined text-[18px]">view_carousel</span>,
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
  },
  video: {
    name: 'Video Reel',
    icon: <span className="material-symbols-outlined text-[18px]">movie</span>,
    color: 'bg-red-500',
  },
};

function renderInlineMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-bold text-primary">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function splitParagraphs(content: string) {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function splitThread(content: string) {
  const numbered = content
    .replace(/\r/g, '')
    .split(/\n(?=\s*\d+\s*[\/.)-])/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (numbered.length > 1) return numbered;
  return splitParagraphs(content);
}

function NewsletterBody({ content }: { content: string }) {
  const lines = content.replace(/\r/g, '').split('\n');

  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-primary">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={index} className="h-1" />;

        const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if (heading) {
          const level = heading[1].length;
          return (
            <h3
              key={index}
              className={cn(
                'pt-2 font-extrabold tracking-tight text-primary',
                level <= 2 ? 'text-[17px]' : 'text-[14px] uppercase tracking-[0.04em]'
              )}
            >
              {renderInlineMarkdown(heading[2])}
            </h3>
          );
        }

        const bullet = trimmed.match(/^[-*]\s+(.+)$/);
        if (bullet) {
          return (
            <div key={index} className="flex gap-2 rounded-lg bg-[var(--surface-raised)] px-3 py-2">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
              <p>{renderInlineMarkdown(bullet[1])}</p>
            </div>
          );
        }

        return <p key={index}>{renderInlineMarkdown(trimmed)}</p>;
      })}
    </div>
  );
}

function PlatformContentPreview({
  platform,
  content,
}: {
  platform: ContentPlatform;
  content: string;
}) {
  if (platform === 'linkedin') {
    return (
      <div className="rounded-2xl border border-subtle bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0077b5] text-[13px] font-black text-white">in</div>
          <div>
            <p className="text-[12px] font-bold text-primary">Ladder Flow Draft</p>
            <p className="text-[10px] text-[var(--text-secondary)]">LinkedIn post preview</p>
          </div>
        </div>
        <div className="space-y-3 text-[13px] leading-relaxed text-primary">
          {splitParagraphs(content).map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">{renderInlineMarkdown(paragraph)}</p>
          ))}
        </div>
      </div>
    );
  }

  if (platform === 'x' || platform === 'twitter') {
    const tweets = splitThread(content);
    return (
      <div className="space-y-2.5">
        {tweets.map((tweet, index) => (
          <div key={index} className="relative rounded-2xl border border-subtle bg-[var(--surface)] p-4">
            {index < tweets.length - 1 && (
              <span className="absolute left-[31px] top-[52px] h-[calc(100%-34px)] w-px bg-[var(--border-default)]" />
            )}
            <div className="flex gap-3">
              <div className="z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-black text-[12px] font-black text-white">X</div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5">
                  <p className="text-[12px] font-bold text-primary">Thread draft</p>
                  <span className="text-[10px] text-[var(--text-secondary)]">{index + 1}/{tweets.length}</span>
                </div>
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-primary">{renderInlineMarkdown(tweet)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (platform === 'newsletter') {
    return (
      <article className="rounded-2xl border border-subtle bg-[var(--surface)] p-5">
        <div className="mb-4 border-b border-subtle pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">Newsletter Draft</p>
          <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Article preview</p>
        </div>
        <NewsletterBody content={content} />
      </article>
    );
  }

  return <p className="mono-text whitespace-pre-wrap text-[13px] leading-relaxed text-primary">{content}</p>;
}

export function AssetCard({
  platform,
  status,
  content,
  title,
  outputStatus,
  onRegenerate,
  onCopy,
  onEdit,
  onStatusChange,
  onArchive,
}: AssetCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [copied, setCopied] = useState(false);
  const [internalPublished, setInternalPublished] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const config = platformConfig[platform];
  const published = outputStatus ? outputStatus === 'published' : internalPublished;

  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onCopy?.();
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await onEdit?.(editedContent);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRegenerate = async () => {
    try {
      setIsSaving(true);
      await onRegenerate?.();
    } finally {
      setIsSaving(false);
    }
  };

  const handlePublishedToggle = async () => {
    if (!onStatusChange) {
      setInternalPublished((value) => !value);
      return;
    }

    try {
      setIsSaving(true);
      await onStatusChange(published ? 'draft' : 'published');
    } finally {
      setIsSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!onArchive) return;
    try {
      setIsSaving(true);
      await onArchive();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${platform}-post.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <article className={cn('glass-panel overflow-hidden', published && 'border-[color:rgba(16,185,129,0.36)]')}>
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded text-white', config.color)}>
            {config.icon}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-primary">{title || config.name}</p>
            {title && <p className="text-[10px] text-[var(--text-secondary)]">{config.name}</p>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {published && (
            <span className="rounded-full bg-[color:rgba(16,185,129,0.16)] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--success)]">
              Published
            </span>
          )}

          {!published && <StatusBadge variant={status === 'ready' ? 'ready' : status === 'error' ? 'error' : 'generating'} />}

          {status === 'ready' && (
            <>
              <button
                onClick={handleRegenerate}
                disabled={isSaving}
                className="rounded-lg p-2 text-secondary transition-colors hover:bg-[var(--surface-raised)] hover:text-primary disabled:opacity-40"
                title="Regenerate"
              >
                <span className="material-symbols-outlined text-[18px]">autorenew</span>
              </button>
              <button
                onClick={handleCopy}
                className="rounded-lg p-2 text-secondary transition-colors hover:bg-[var(--surface-raised)] hover:text-primary"
                title={copied ? 'Copied!' : 'Copy'}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {copied ? 'check' : 'content_copy'}
                </span>
              </button>
              <button
                onClick={handleDownload}
                className="rounded-lg p-2 text-secondary transition-colors hover:bg-[var(--surface-raised)] hover:text-primary"
                title="Download"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
              <button
                onClick={() => setIsEditing(!isEditing)}
                disabled={isSaving}
                className={cn(
                  'rounded-lg p-2 transition-colors disabled:opacity-40',
                  isEditing ? 'text-[var(--accent)]' : 'text-secondary hover:bg-[var(--surface-raised)] hover:text-primary'
                )}
                title="Edit"
              >
                <span className="material-symbols-outlined text-[18px]">edit</span>
              </button>
              {onArchive && (
                <button
                  onClick={handleArchive}
                  disabled={isSaving}
                  className="rounded-lg p-2 text-secondary transition-colors hover:bg-[var(--surface-raised)] hover:text-[var(--danger)] disabled:opacity-40"
                  title="Archive"
                >
                  <span className="material-symbols-outlined text-[18px]">archive</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="p-4">
        {status === 'generating' ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : isEditing ? (
          <div>
            <textarea
              value={editedContent}
              onChange={(e) => setEditedContent(e.target.value)}
              className="mono-text min-h-[210px] w-full resize-none rounded-xl border border-subtle bg-[var(--background)] p-3 text-sm text-primary outline-none focus:border-[var(--accent)]"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setEditedContent(content);
                  setIsEditing(false);
                }}
                className="rounded-full px-3 py-1.5 text-xs font-medium text-secondary hover:text-primary"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="accent-gradient rounded-full px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : (
          <PlatformContentPreview platform={platform} content={content} />
        )}
      </div>

      {status === 'ready' && !isEditing && (
        <div className="flex justify-end border-t border-subtle px-4 py-3">
          <button
            onClick={handlePublishedToggle}
            disabled={isSaving}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] transition-colors disabled:opacity-50',
              published
                ? 'bg-[color:rgba(16,185,129,0.16)] text-[var(--success)]'
                : 'bg-[var(--surface-raised)] text-secondary hover:text-primary'
            )}
          >
            <span className="material-symbols-outlined text-[14px]">
              {published ? 'check_circle' : 'radio_button_unchecked'}
            </span>
            {published ? 'Published' : 'Mark Published'}
          </button>
        </div>
      )}
    </article>
  );
}

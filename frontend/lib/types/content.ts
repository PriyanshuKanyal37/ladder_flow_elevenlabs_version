/**
 * Request payload for LinkedIn post generation
 */
export interface LinkedInGenerationRequest {
  topic: string;
  userName?: string;
  transcript: string;
}

/**
 * Response from LinkedIn generation endpoint
 */
export interface LinkedInGenerationResponse {
  linkedin: string;
}

export interface TwitterGenerationRequest {
  topic: string;
  userName?: string;
  transcript: string;
}

export interface TwitterGenerationResponse {
  twitter: string;
}

export interface NewsletterGenerationRequest {
  topic: string;
  userName?: string;
  transcript: string;
}

export interface NewsletterGenerationResponse {
  newsletter: string;
}

/**
 * Content asset types
 */
export type ContentPlatform = 'linkedin' | 'x' | 'twitter' | 'newsletter' | 'carousel' | 'video';

/**
 * Content asset status
 */
export type ContentStatus = 'ready' | 'generating' | 'error' | 'idle';

/**
 * Generated content asset
 */
export interface ContentAsset {
  platform: ContentPlatform;
  status: ContentStatus;
  content: string;
  error?: string;
}

export type ContentOutputPlatform = 'linkedin' | 'x' | 'newsletter';

export type ContentOutputType = 'linkedin_post' | 'x_thread' | 'newsletter_issue';

export type ContentOutputStatus = 'generated' | 'draft' | 'published' | 'archived' | 'error';

export interface ContentSignal {
  type: string;
  title: string;
  summary?: string;
  source_quote?: string;
  strength?: number;
  signals?: ContentSignal[];
}

export interface ContentPackCounts {
  linkedin: number;
  x: number;
  newsletter: number;
}

export interface ContentPackSummary {
  state: 'analyzed' | 'generated' | 'insufficient_content' | 'error';
  usable_signal_count: number;
  strong_signal_count: number;
  theme_cluster_count?: number;
  conversation_quality: 'low' | 'medium' | 'high';
  recommended_counts: ContentPackCounts;
  allowed_max_counts: ContentPackCounts;
  requested_counts?: ContentPackCounts;
  final_counts?: ContentPackCounts;
  warnings: string[];
  analyzed_at?: string;
  generated_at?: string;
}

export interface ContentOutput {
  id: string;
  interview_id: string;
  platform: ContentOutputPlatform;
  content_type: ContentOutputType;
  title: string | null;
  raw_content: string;
  edited_content: string | null;
  content: string;
  status: ContentOutputStatus;
  sort_order: number;
  signal_snapshot: ContentSignal | null;
  generation_metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContentPackInterview {
  id: string;
  topic: string | null;
  status: string;
  duration_seconds: number | null;
  raw_transcript: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ContentPackResponse {
  interview_id: string;
  summary: ContentPackSummary;
  outputs: ContentOutput[];
  interview?: ContentPackInterview;
  signals?: ContentSignal[];
  theme_clusters?: Array<{
    title: string;
    signal_titles: string[];
  }>;
}

export interface ContentPackAnalyzeRequest {
  interview_id: string;
  force?: boolean;
}

export interface ContentPackGenerateRequest {
  interview_id: string;
  force?: boolean;
  requested_counts?: ContentPackCounts;
}

export interface ContentOutputUpdateRequest {
  edited_content?: string | null;
  status?: ContentOutputStatus;
}

export interface ContentOutputRegenerateRequest {
  instruction?: string | null;
}


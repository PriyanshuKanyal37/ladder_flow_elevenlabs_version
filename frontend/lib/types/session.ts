/**
 * Session status
 */
export type SessionStatus = 'draft' | 'in_progress' | 'completed';

/**
 * Session category for visual styling
 */
export type SessionCategory = 'productivity' | 'technology' | 'business' | 'marketing' | 'general';

/**
 * A content creation session
 */
export interface Session {
  id: string;
  title: string;
  status: SessionStatus;
  category: SessionCategory;
  tags: string[];
  duration: number; // in seconds
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Session with generated content
 */
export interface SessionWithContent extends Session {
  transcript?: string;
  linkedin?: string;
  twitter?: string;
  newsletter?: string;
}


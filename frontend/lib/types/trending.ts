/**
 * Request payload for discovering trending topics
 */
export interface TrendingTopicsRequest {
  keyword: string;
}

/**
 * Topic shape stored in session and used by interview pages
 */
export interface TrendingTopic {
  rank: number;
  topic_title: string;
  global_context: string;
  why_this_matters: string;
  key_questions: string[];
  source_tweet_id?: string;
}

/**
 * Deep research result from Perplexity
 */
export interface ResearchResult {
  title: string;
  deep_context: string;
  key_insights: string[];
  discussion_points: string[];
  sources: string[];
}

/**
 * Full API response structure
 */
export interface ResearchResponse {
  output: ResearchResult;
}


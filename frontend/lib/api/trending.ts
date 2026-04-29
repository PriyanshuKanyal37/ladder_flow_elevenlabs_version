import { authHeaders } from '@/lib/auth';
import type { ResearchResult, ResearchResponse } from '@/lib/types/trending';

/**
 * Discover trending topics based on keywords
 * Calls the server-side API route which proxies to the external API
 * @param keywords - Search keywords (can be comma-separated)
 * @returns Deep research result
 * @throws Error if API call fails
 */
export async function discoverTrendingTopics(
  keywords: string
): Promise<ResearchResult> {
  // Input validation
  if (!keywords || keywords.trim().length === 0) {
    throw new Error('Keywords cannot be empty');
  }

  try {
    const response = await fetch('/api/trending', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ keywords: keywords.trim() }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API responded with status: ${response.status}`);
    }

    const data: ResearchResponse = await response.json();

    // Validate response structure
    if (!data.output || !data.output.title || !data.output.deep_context) {
      throw new Error('Invalid API response structure');
    }

    return data.output;
  } catch (error) {
    if (error instanceof Error) {
      console.error('Trending topics API error:', error.message);

      if (error.message.includes('fetch')) {
        throw new Error('Network error. Please check your connection and try again.');
      }

      throw error;
    }

    throw new Error('Failed to discover trending topics');
  }
}


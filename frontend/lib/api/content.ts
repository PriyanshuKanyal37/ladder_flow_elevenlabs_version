import { authHeaders } from '@/lib/auth';
import type {
  LinkedInGenerationRequest,
  LinkedInGenerationResponse,
  TwitterGenerationRequest,
  TwitterGenerationResponse,
  NewsletterGenerationRequest,
  NewsletterGenerationResponse
} from '@/lib/types/content';

/**
 * Generate LinkedIn post from transcript
 * Calls the server-side API route which proxies to the external API
 * @param request - LinkedIn generation request
 * @returns Generated LinkedIn post content
 */
export async function generateLinkedInPost(
  request: LinkedInGenerationRequest
): Promise<string> {
  const response = await fetch('/api/content/linkedin', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `LinkedIn generation failed: ${response.status}`);
  }

  const data: LinkedInGenerationResponse = await response.json();
  return data.linkedin;
}

export async function generateTwitterThread(
  request: TwitterGenerationRequest
): Promise<string> {
  const response = await fetch('/api/content/twitter', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Twitter generation failed: ${response.status}`);
  }

  const data: TwitterGenerationResponse = await response.json();
  return data.twitter;
}

export async function generateNewsletter(
  request: NewsletterGenerationRequest
): Promise<string> {
  const response = await fetch('/api/content/newsletter', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Newsletter generation failed: ${response.status}`);
  }

  const data: NewsletterGenerationResponse = await response.json();
  return data.newsletter;
}


import type {
  AgentConfigRequest,
  AgentConfigResponse,
  AgentDispatchRequest,
  AgentDispatchResponse,
} from '@/lib/types/agent';
import { authHeaders } from '@/lib/auth';

/**
 * Check if the backend is healthy.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch('/api/agent/health');
    if (!response.ok) return false;
    const data = await response.json();
    return data.status === 'ready' || data.status === 'ok';
  } catch {
    return false;
  }
}

/**
 * Generate a LiveKit session token from the backend.
 * Returns { token, livekitUrl, roomName, topicTitle, userName, greeting }.
 */
export async function generateAgentConfig(
  request: AgentConfigRequest
): Promise<AgentConfigResponse> {
  const response = await fetch('/api/agent/config', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Agent config failed: ${response.status}`);
  }

  return response.json();
}

export async function dispatchAgent(
  request: AgentDispatchRequest
): Promise<AgentDispatchResponse> {
  const response = await fetch('/api/agent/dispatch', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Agent dispatch failed: ${response.status}`);
  }

  return response.json();
}


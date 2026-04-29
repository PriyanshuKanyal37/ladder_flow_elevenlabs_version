import { useMutation } from '@tanstack/react-query';
import { generateAgentConfig } from '@/lib/api/agent';
import type { AgentConfigRequest } from '@/lib/types/agent';

export function useAgentConfig() {
  return useMutation({
    mutationFn: (request: AgentConfigRequest) => generateAgentConfig(request),
    onError: (error) => {
      console.error('Failed to generate agent config:', error);
    },
  });
}


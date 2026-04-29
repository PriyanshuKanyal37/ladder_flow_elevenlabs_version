'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { HookOptions } from '@elevenlabs/react';
import type { ElevenLabsSession } from '@/lib/types/agent';
import type { TranscriptMessage } from '@/lib/types/transcript';

export interface VoiceAgentState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  error: string | null;
}

export interface UseElevenLabsAgentOptions {
  onError?: (error: string) => void;
  onMessage?: (message: TranscriptMessage) => void;
}

export interface UseElevenLabsAgentReturn {
  state: VoiceAgentState;
  messages: TranscriptMessage[];
  connect: (session: ElevenLabsSession) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

export function useElevenLabsAgent(
  options: UseElevenLabsAgentOptions = {}
): UseElevenLabsAgentReturn {
  const { onError, onMessage } = options;
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const connectionAttemptRef = useRef(false);
  const statusRef = useRef('disconnected');

  // Refs hold the latest callbacks without exposing them as deps — prevents
  // useConversation from receiving new function references each render.
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  // Stable handlers — empty deps, identity never changes across renders.
  const handleMessage = useCallback((payload: Parameters<NonNullable<HookOptions['onMessage']>>[0]) => {
    const role: 'user' | 'assistant' = payload.role === 'agent' ? 'assistant' : 'user';
    const id = payload.event_id ? `${payload.role}-${payload.event_id}` : `${payload.role}-${payload.message}`;
    if (seenIdsRef.current.has(id)) return;
    seenIdsRef.current.add(id);
    const msg: TranscriptMessage = {
      id,
      role,
      content: payload.message || '',
      final: true,
    };
    setMessages((prev) => [...prev, msg]);
    onMessageRef.current?.(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    onErrorRef.current?.(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const conversation = useConversation({
    onMessage: handleMessage,
    onError: handleError,
  });

  // Always-current ref so connect/disconnect/toggleMute don't depend on
  // conversation identity — keeps their useCallback deps empty and stable.
  const conversationRef = useRef(conversation);
  conversationRef.current = conversation;

  useEffect(() => {
    statusRef.current = conversation.status;
  }, [conversation.status]);

  const connect = useCallback(async (session: ElevenLabsSession) => {
    if (connectionAttemptRef.current || statusRef.current === 'connected' || statusRef.current === 'connecting') {
      return;
    }
    connectionAttemptRef.current = true;
    seenIdsRef.current.clear();
    setError(null);
    const startOptions: HookOptions = {
      ...(session.signedUrl ? { signedUrl: session.signedUrl } : { agentId: session.agentId }),
      overrides: session.overrides as HookOptions['overrides'],
      userId: session.interviewId,
    };
    conversationRef.current.startSession(startOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    connectionAttemptRef.current = false;
    conversationRef.current.endSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (conversation.status === 'disconnected' || conversation.status === 'error') {
      connectionAttemptRef.current = false;
    }
  }, [conversation.status]);

  const toggleMute = useCallback(() => {
    conversationRef.current.setMuted(!conversationRef.current.isMuted);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const state: VoiceAgentState = useMemo(
    () => {
      const isConnected = conversation.status === 'connected';
      return {
        isConnected,
        isListening: isConnected && conversation.mode === 'listening',
        isSpeaking: isConnected && conversation.mode === 'speaking',
        isThinking: false,
        error,
      };
    },
    [conversation.mode, conversation.status, error]
  );

  return {
    state,
    messages,
    connect,
    disconnect,
    toggleMute,
    isMuted: conversation.isMuted,
  };
}

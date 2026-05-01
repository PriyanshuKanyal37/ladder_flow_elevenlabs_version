'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConversation } from '@elevenlabs/react';
import type { HookOptions } from '@elevenlabs/react';
import type { ElevenLabsSession } from '@/lib/types/agent';
import type { TranscriptMessage } from '@/lib/types/transcript';

const LIVE_TRANSCRIPT_UPDATE_MS = 80;

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
  liveUserTranscript: string;
  connect: (session: ElevenLabsSession) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

interface TentativeUserTranscriptDebugEvent {
  type: 'tentative_user_transcript';
  tentative_user_transcription_event?: {
    user_transcript?: string;
    event_id?: number;
  };
}

interface TentativeAgentResponseDebugEvent {
  type: 'tentative_agent_response';
  response?: string;
}

function isDebugRecord(payload: unknown): payload is Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

export function useElevenLabsAgent(
  options: UseElevenLabsAgentOptions = {}
): UseElevenLabsAgentReturn {
  const { onError, onMessage } = options;
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [liveUserTranscript, setLiveUserTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const connectionAttemptRef = useRef(false);
  const statusRef = useRef('disconnected');
  const pendingLiveUserTranscriptRef = useRef('');
  const liveTranscriptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLiveTranscriptFlushRef = useRef(0);
  const userTentativeStartedAtRef = useRef<number | null>(null);
  const userFinalAtRef = useRef<number | null>(null);
  const speakingLoggedForUserFinalAtRef = useRef<number | null>(null);
  const debugEventTypesRef = useRef<Set<string>>(new Set());

  // Refs hold the latest callbacks without exposing them as deps — prevents
  // useConversation from receiving new function references each render.
  const onMessageRef = useRef(onMessage);
  const onErrorRef = useRef(onError);
  onMessageRef.current = onMessage;
  onErrorRef.current = onError;

  const flushLiveUserTranscript = useCallback(() => {
    liveTranscriptTimerRef.current = null;
    lastLiveTranscriptFlushRef.current = performance.now();
    const next = pendingLiveUserTranscriptRef.current;
    setLiveUserTranscript((current) => (current === next ? current : next));
  }, []);

  const queueLiveUserTranscript = useCallback((transcript: string) => {
    pendingLiveUserTranscriptRef.current = transcript;
    if (liveTranscriptTimerRef.current) return;

    const elapsed = performance.now() - lastLiveTranscriptFlushRef.current;
    const delay = Math.max(0, LIVE_TRANSCRIPT_UPDATE_MS - elapsed);
    liveTranscriptTimerRef.current = setTimeout(() => {
      if (typeof window !== 'undefined' && 'requestAnimationFrame' in window) {
        window.requestAnimationFrame(flushLiveUserTranscript);
        return;
      }
      flushLiveUserTranscript();
    }, delay);
  }, [flushLiveUserTranscript]);

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
    if (role === 'user') {
      const now = performance.now();
      if (userTentativeStartedAtRef.current !== null && process.env.NODE_ENV === 'development') {
        console.info(
          `[Voice latency] user tentative-to-final ${Math.round(now - userTentativeStartedAtRef.current)}ms`
        );
      }
      userFinalAtRef.current = now;
      speakingLoggedForUserFinalAtRef.current = null;
      userTentativeStartedAtRef.current = null;
      queueLiveUserTranscript('');
    } else if (userFinalAtRef.current !== null && process.env.NODE_ENV === 'development') {
      console.info(
        `[Voice latency] user-final-to-agent-final ${Math.round(performance.now() - userFinalAtRef.current)}ms`
      );
    }
    setMessages((prev) => [...prev, msg]);
    onMessageRef.current?.(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueLiveUserTranscript]);

  const handleDebug = useCallback((payload: unknown) => {
    if (!isDebugRecord(payload)) return;

    const eventType = typeof payload.type === 'string' ? payload.type : 'unknown';
    if (process.env.NODE_ENV === 'development' && !debugEventTypesRef.current.has(eventType)) {
      debugEventTypesRef.current.add(eventType);
      console.info('[ElevenLabs debug event]', eventType, payload);
    }

    if (payload.type === 'tentative_user_transcript') {
      const event = payload as unknown as TentativeUserTranscriptDebugEvent;
      const transcript = event.tentative_user_transcription_event?.user_transcript?.trim() || '';
      if (transcript && !pendingLiveUserTranscriptRef.current) {
        userTentativeStartedAtRef.current = performance.now();
      }
      queueLiveUserTranscript(transcript);
      if (process.env.NODE_ENV === 'development' && transcript) {
        console.info('[ElevenLabs live user transcript]', transcript);
      }
      return;
    }

    if (payload.type === 'tentative_agent_response') {
      const event = payload as unknown as TentativeAgentResponseDebugEvent;
      if (event.response && process.env.NODE_ENV === 'development') {
        console.debug('[ElevenLabs tentative agent]', event.response);
      }
    }
  }, [queueLiveUserTranscript]);

  const handleError = useCallback((msg: string) => {
    setError(msg);
    onErrorRef.current?.(msg);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleModeChange = useCallback((payload: { mode: 'speaking' | 'listening' }) => {
    if (
      payload.mode === 'speaking' &&
      userFinalAtRef.current !== null &&
      speakingLoggedForUserFinalAtRef.current !== userFinalAtRef.current &&
      process.env.NODE_ENV === 'development'
    ) {
      speakingLoggedForUserFinalAtRef.current = userFinalAtRef.current;
      console.info(
        `[Voice latency] user-final-to-agent-speaking ${Math.round(performance.now() - userFinalAtRef.current)}ms`
      );
    }
  }, []);

  const conversation = useConversation({
    onMessage: handleMessage,
    onDebug: handleDebug,
    onModeChange: handleModeChange,
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
    debugEventTypesRef.current.clear();
    userTentativeStartedAtRef.current = null;
    userFinalAtRef.current = null;
    speakingLoggedForUserFinalAtRef.current = null;
    setError(null);
    queueLiveUserTranscript('');
    const authOptions: Partial<HookOptions> = session.conversationToken
      ? { conversationToken: session.conversationToken, connectionType: 'webrtc' }
      : session.signedUrl
        ? { signedUrl: session.signedUrl }
        : { agentId: session.agentId, connectionType: 'webrtc' };

    const startOptions: HookOptions = {
      ...authOptions,
      overrides: session.overrides as HookOptions['overrides'],
      userId: session.interviewId,
    };
    conversationRef.current.startSession(startOptions);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const disconnect = useCallback(() => {
    connectionAttemptRef.current = false;
    queueLiveUserTranscript('');
    conversationRef.current.endSession();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueLiveUserTranscript]);

  useEffect(() => {
    if (conversation.status === 'disconnected' || conversation.status === 'error') {
      connectionAttemptRef.current = false;
      queueLiveUserTranscript('');
    }
  }, [conversation.status, queueLiveUserTranscript]);

  useEffect(() => {
    return () => {
      if (liveTranscriptTimerRef.current) {
        clearTimeout(liveTranscriptTimerRef.current);
      }
    };
  }, []);

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
    liveUserTranscript,
    connect,
    disconnect,
    toggleMute,
    isMuted: conversation.isMuted,
  };
}

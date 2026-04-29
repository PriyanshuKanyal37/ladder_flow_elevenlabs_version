'use client';

import { useCallback, useRef, useState } from 'react';
import { Room, RoomEvent, RoomOptions } from 'livekit-client';

import { dispatchAgent } from '@/lib/api/agent';
import type { LiveKitSession } from '@/lib/types/agent';
import type { TranscriptMessage } from '@/lib/types/transcript';

export interface VoiceAgentState {
  isConnected: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  isThinking: boolean;
  error: string | null;
}

export interface UseLiveKitAgentOptions {
  onError?: (error: string) => void;
  onMessage?: (message: TranscriptMessage) => void;
}

export interface UseLiveKitAgentReturn {
  state: VoiceAgentState;
  messages: TranscriptMessage[];
  connect: (session: LiveKitSession) => Promise<void>;
  disconnect: () => void;
  toggleMute: () => void;
  isMuted: boolean;
}

interface AgentTranscriptMessage {
  type: 'transcript';
  id?: string;
  role: 'user' | 'assistant';
  text: string;
  final: boolean;
}

interface AgentStateMessage {
  type: 'agent_state';
  state: 'thinking' | 'speaking' | 'listening' | 'idle';
}

type AgentDataMessage = AgentTranscriptMessage | AgentStateMessage;

const ROOM_OPTIONS: RoomOptions = {
  adaptiveStream: true,
  dynacast: true,
  audioCaptureDefaults: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  },
};

interface RoomSingleton {
  room: Room | null;
  activeToken: string | null;
  isConnecting: boolean;
}

const singleton: RoomSingleton = {
  room: null,
  activeToken: null,
  isConnecting: false,
};

export function _getRoomForAudioUnlock(): Room | null {
  return singleton.room;
}

export function useLiveKitAgent(options: UseLiveKitAgentOptions = {}): UseLiveKitAgentReturn {
  const { onError, onMessage } = options;

  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [state, setState] = useState<VoiceAgentState>({
    isConnected: singleton.room?.state === 'connected',
    isListening: false,
    isSpeaking: false,
    isThinking: false,
    error: null,
  });

  const seenFinalIdsRef = useRef<Set<string>>(new Set());

  const updateState = useCallback((patch: Partial<VoiceAgentState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  const pushFinalTranscript = useCallback(
    (id: string, role: 'user' | 'assistant', text: string) => {
      if (!text.trim() || seenFinalIdsRef.current.has(id)) {
        return;
      }

      seenFinalIdsRef.current.add(id);
      const finalMsg: TranscriptMessage = { id, role, content: text, final: true };
      onMessage?.(finalMsg);

      setMessages((prev) => {
        const withoutInterimSameRole = prev.filter(
          (m) => !(m.final === false && m.role === role)
        );
        return [...withoutInterimSameRole, finalMsg];
      });
    },
    [onMessage]
  );

  const handleData = useCallback(
    (payload: Uint8Array) => {
      try {
        const msg: AgentDataMessage = JSON.parse(new TextDecoder().decode(payload));

        if (msg.type === 'agent_state') {
          switch (msg.state) {
            case 'thinking':
              updateState({ isThinking: true, isSpeaking: false, isListening: false });
              break;
            case 'speaking':
              updateState({ isSpeaking: true, isThinking: false, isListening: false });
              break;
            case 'listening':
              updateState({ isListening: true, isSpeaking: false, isThinking: false });
              break;
            case 'idle':
              updateState({ isListening: false, isSpeaking: false, isThinking: false });
              break;
          }
          return;
        }

        const id = msg.id || `${msg.role}-${msg.text}`;
        if (msg.final) {
          pushFinalTranscript(id, msg.role, msg.text);
        }
      } catch {
        // Ignore non-JSON binary frames.
      }
    },
    [pushFinalTranscript, updateState]
  );

  const handleTranscription = useCallback(
    (
      segments: import('livekit-client').TranscriptionSegment[],
      participant?: import('livekit-client').Participant
    ) => {
      const room = singleton.room;
      const isAgent = participant && participant !== room?.localParticipant;
      const role: 'user' | 'assistant' = isAgent ? 'assistant' : 'user';

      for (const seg of segments) {
        if (!seg.text.trim()) continue;

        // Use transcription stream for interim UI only.
        if (seg.final) continue;

        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === seg.id) {
            return [...prev.slice(0, -1), { ...last, content: seg.text, final: false }];
          }
          return [...prev, { id: seg.id, role, content: seg.text, final: false }];
        });
      }
    },
    []
  );

  const connect = useCallback(
    async (session: LiveKitSession) => {
      if (!session.interviewId) {
        throw new Error('Missing interviewId in LiveKit session');
      }

      if (singleton.activeToken === session.token) {
        if (singleton.room?.state === 'connected') {
          updateState({ isConnected: true, error: null });
          return;
        }
        if (singleton.isConnecting) {
          return;
        }
      }

      if (singleton.room) {
        singleton.room.removeAllListeners();
        await singleton.room.disconnect();
        singleton.room = null;
      }

      singleton.activeToken = session.token;
      singleton.isConnecting = true;
      seenFinalIdsRef.current.clear();
      updateState({ error: null });

      const room = new Room(ROOM_OPTIONS);
      singleton.room = room;

      room
        .on(RoomEvent.Connected, () => {
          singleton.isConnecting = false;
          updateState({ isConnected: true, error: null });
        })
        .on(RoomEvent.Disconnected, () => {
          singleton.isConnecting = false;
          singleton.activeToken = null;
          updateState({
            isConnected: false,
            isListening: false,
            isSpeaking: false,
            isThinking: false,
          });
        })
        .on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === 'audio') {
            const el = track.attach();
            el.dataset.livekitTrack = 'remote-audio';
            document.body.appendChild(el);
          }
        })
        .on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === 'audio') {
            track.detach().forEach((el) => el.remove());
          }
        })
        .on(RoomEvent.DataReceived, (payload: Uint8Array) => handleData(payload))
        .on(RoomEvent.TranscriptionReceived, (segments, participant) => {
          handleTranscription(segments, participant ?? undefined);
        })
        .on(RoomEvent.MediaDevicesError, (err: Error) => {
          singleton.isConnecting = false;
          updateState({ error: err.message, isConnected: false });
          onError?.(err.message);
        });

      try {
        await room.connect(session.livekitUrl, session.token, { autoSubscribe: true });

        try {
          await room.startAudio();
        } catch (err) {
          console.warn('[LiveKit] startAudio failed:', err);
        }

        await room.localParticipant.setMicrophoneEnabled(true);

        // Dispatch only after room join to remove race conditions.
        await dispatchAgent({ interview_id: session.interviewId });
      } catch (err) {
        singleton.isConnecting = false;
        singleton.activeToken = null;

        const message = err instanceof Error ? err.message : 'Connection failed';
        updateState({ error: message, isConnected: false });
        onError?.(message);

        if (singleton.room) {
          singleton.room.removeAllListeners();
          await singleton.room.disconnect();
          singleton.room = null;
        }

        throw err;
      }
    },
    [handleData, handleTranscription, onError, updateState]
  );

  const disconnect = useCallback(() => {
    singleton.isConnecting = false;
    singleton.activeToken = null;

    if (singleton.room) {
      singleton.room.removeAllListeners();
      singleton.room.disconnect();
      singleton.room = null;
    }

    document
      .querySelectorAll('audio[data-livekit-track="remote-audio"]')
      .forEach((el) => el.remove());

    seenFinalIdsRef.current.clear();
    setMessages([]);
    updateState({
      isConnected: false,
      isListening: false,
      isSpeaking: false,
      isThinking: false,
      error: null,
    });
  }, [updateState]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      singleton.room?.localParticipant?.setMicrophoneEnabled(!next);
      return next;
    });
  }, []);

  return { state, messages, connect, disconnect, toggleMute, isMuted };
}


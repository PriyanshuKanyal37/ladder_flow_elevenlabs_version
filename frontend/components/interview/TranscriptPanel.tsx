'use client';

import { useRef, useEffect } from 'react';
import { TranscriptMessage } from './TranscriptMessage';
import type { TranscriptMessage as TranscriptMessageType } from '@/lib/types/transcript';

interface TranscriptPanelProps {
  messages: TranscriptMessageType[];
  isRecording?: boolean;
  currentText?: string;
}

export function TranscriptPanel({ messages, isRecording, currentText }: TranscriptPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, currentText]);

  return (
    <div
      ref={scrollRef}
      className="transcript-mask custom-scrollbar flex-1 space-y-4 overflow-y-auto p-4"
    >
      {messages.map((message, index) => {
        const isFaded = index < messages.length - 2;
        const isCurrentQuestion = message.role === 'assistant' && index === messages.length - 1;

        return (
          <TranscriptMessage
            key={index}
            message={message}
            isCurrentQuestion={isCurrentQuestion}
            isFaded={isFaded}
          />
        );
      })}

      {/* Current recording text */}
      {isRecording && currentText && (
        <TranscriptMessage
          message={{ role: 'user', content: currentText }}
          isRecording={true}
        />
      )}
    </div>
  );
}


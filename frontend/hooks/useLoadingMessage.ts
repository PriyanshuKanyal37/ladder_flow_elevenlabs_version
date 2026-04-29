import { useState, useEffect } from 'react';

const defaultMessages = [
  'Analyzing conversations...',
  'Discovering emerging trends...',
  'Evaluating topic relevance...',
  'Ranking results...',
];

export function useLoadingMessage(messages: string[] = defaultMessages) {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [messages.length]);

  return messages[messageIndex];
}


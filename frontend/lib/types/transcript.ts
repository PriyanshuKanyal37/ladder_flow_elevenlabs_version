export interface TranscriptMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  final?: boolean;
}


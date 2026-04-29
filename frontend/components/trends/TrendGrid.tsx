'use client';

import { TrendCard } from './TrendCard';
import type { TrendingTopic } from '@/lib/types/trending';

interface TrendGridProps {
  topics: TrendingTopic[];
  selectedRanks: number[];
  onToggle: (rank: number) => void;
}

export function TrendGrid({ topics, selectedRanks, onToggle }: TrendGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {topics.map((topic) => (
        <TrendCard
          key={topic.rank}
          topic={topic}
          isSelected={selectedRanks.includes(topic.rank)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}


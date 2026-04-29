'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TrendingTopic } from '@/lib/types/trending';

interface TrendCardProps {
  topic: TrendingTopic;
  isSelected: boolean;
  onToggle: (rank: number) => void;
  onExpand?: (rank: number) => void;
}

export function TrendCard({ topic, isSelected, onToggle, onExpand }: TrendCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleExpand = () => {
    setIsExpanded(!isExpanded);
    onExpand?.(topic.rank);
  };

  return (
    <div
      className={cn(
        'relative flex flex-col rounded-xl p-6 transition-all duration-200 cursor-pointer',
        isSelected
          ? 'border-2 border-[#E95335] bg-white shadow-glow'
          : 'border border-slate-200 bg-white hover:border-[#E95335]/50 hover:-translate-y-1 hover:shadow-md'
      )}
      onClick={() => onToggle(topic.rank)}
    >
      {/* Rank Badge - Top Left */}
      <div className="absolute left-4 top-4">
        <span
          className={cn(
            'px-2 py-1 rounded-md text-xs font-bold',
            isSelected
              ? 'bg-[#E95335] text-white'
              : 'bg-slate-100 text-slate-600'
          )}
        >
          Rank #{topic.rank}
        </span>
      </div>

      {/* Selection Checkbox - Top Right */}
      <div className="absolute right-4 top-4">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle(topic.rank);
          }}
          className={cn(
            'size-6 rounded-full flex items-center justify-center transition-all',
            isSelected
              ? 'bg-[#E95335] text-white shadow-sm'
              : 'border-2 border-slate-300 hover:border-[#E95335]'
          )}
        >
          {isSelected && (
            <span className="material-symbols-outlined text-[18px] font-bold">check</span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="mt-10">
        <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">
          {topic.topic_title}
        </h3>
        <p className={cn(
          'text-sm text-slate-600 mb-4',
          !isExpanded && 'line-clamp-3'
        )}>
          {topic.why_this_matters}
        </p>

        {/* Expand Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleExpand();
          }}
          className="text-sm text-[#E95335] font-medium hover:underline flex items-center gap-1"
        >
          {isExpanded ? 'Hide' : 'View'} {topic.key_questions.length} Key Questions
          <span className="material-symbols-outlined text-[16px]">
            {isExpanded ? 'expand_less' : 'expand_more'}
          </span>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t border-slate-100">
            {/* Global Context */}
            <div className="mb-4">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Context
              </h4>
              <p className="text-sm text-slate-600">
                {topic.global_context}
              </p>
            </div>

            {/* Key Questions */}
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Key Questions
              </h4>
              <ul className="space-y-2">
                {topic.key_questions.map((question, index) => (
                  <li
                    key={index}
                    className="flex items-start gap-2 text-sm text-slate-600"
                  >
                    <span className="text-[#E95335] font-bold text-xs mt-0.5">
                      {index + 1}.
                    </span>
                    {question}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


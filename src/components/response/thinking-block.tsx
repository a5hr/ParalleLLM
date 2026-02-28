'use client';

import { memo, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { StreamingCursor } from './streaming-cursor';
import { cn } from '@/lib/utils';
import { useT } from '@/store/locale-store';

interface ThinkingBlockProps {
  reasoning: string;
  isStreaming: boolean;
}

export const ThinkingBlock = memo(function ThinkingBlock({
  reasoning,
  isStreaming,
}: ThinkingBlockProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(isStreaming);
  const [prevIsStreaming, setPrevIsStreaming] = useState(isStreaming);

  // Adjust state from props without useEffect (React recommended pattern)
  if (isStreaming !== prevIsStreaming) {
    setPrevIsStreaming(isStreaming);
    setIsOpen(isStreaming);
  }

  const label = isStreaming
    ? t('response.thinking')
    : t('response.thinkingChars', { count: reasoning.length });

  return (
    <div className="mb-3">
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        <span>{label}</span>
      </button>
      {isOpen && (
        <div
          className={cn(
            'mt-1.5 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground',
            'max-h-[300px] overflow-y-auto whitespace-pre-wrap break-words'
          )}
        >
          {reasoning}
          {isStreaming && <StreamingCursor />}
        </div>
      )}
    </div>
  );
});

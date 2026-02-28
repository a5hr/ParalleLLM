'use client';

import { useChatStore } from '@/store/chat-store';
import { ResponseCard } from './response-card';

export function ResponseGrid() {
  const responses = useChatStore((s) => s.responses);
  const responseList = Object.values(responses);

  if (responseList.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {responseList.map((response) => (
        <ResponseCard key={response.modelId} response={response} />
      ))}
    </div>
  );
}

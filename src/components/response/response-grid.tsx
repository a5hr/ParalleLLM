'use client';

import { useChatStore } from '@/store/chat-store';
import { useModelStore } from '@/store/model-store';
import { useApiKeyStore } from '@/store/api-key-store';
import { ResponseCard } from './response-card';
import { WelcomeGuide } from './welcome-guide';

export function ResponseGrid() {
  const responses = useChatStore((s) => s.responses);
  const selectedModelIds = useModelStore((s) => s.selectedModelIds);
  const keys = useApiKeyStore((s) => s.keys);
  const responseList = Object.values(responses);
  const hasKeys = Object.values(keys).some(Boolean);

  if (responseList.length === 0) {
    return <WelcomeGuide hasKeys={hasKeys} hasSelectedModels={selectedModelIds.length > 0} />;
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
      {responseList.map((response) => (
        <ResponseCard key={response.modelId} response={response} />
      ))}
    </div>
  );
}

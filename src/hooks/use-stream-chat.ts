'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useModelStore } from '@/store/model-store';
import { useApiKeyStore } from '@/store/api-key-store';
import type { SSEChunkData, SSEErrorData } from '@/types/stream';
import { parseSSEStream } from '@/lib/streaming/sse-client';
import { trackChatStart, trackChatComplete, trackChatError } from '@/lib/analytics';

export function useStreamChat() {
  const {
    startStream,
    appendContent,
    appendReasoning,
    completeResponse,
    setError,
    updateResponse,
    cancelStream,
    isStreaming,
  } = useChatStore();
  const models = useModelStore((s) => s.models);
  const apiKeys = useApiKeyStore((s) => s.keys);

  const startChat = useCallback(
    async (prompt: string, systemPrompt: string, modelIds: string[]) => {
      startStream(modelIds);

      const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
      if (systemPrompt.trim()) {
        messages.push({ role: 'system', content: systemPrompt });
      }
      messages.push({ role: 'user', content: prompt });

      const modelConfigs = modelIds.map((id) => {
        const config = models.find((m) => m.id === id);
        const maxTokens = Math.min(
          config?.parameters.maxTokens ?? 4096,
          config?.maxOutput ?? 4096
        );
        return {
          id,
          temperature: config?.parameters.temperature ?? 0.7,
          maxTokens,
          ...(config?.baseUrl ? { provider: config.provider, baseUrl: config.baseUrl } : {}),
        };
      });

      const providers = modelIds.map((id) => {
        const m = models.find((model) => model.id === id);
        return m?.provider ?? 'unknown';
      });
      trackChatStart(modelIds, providers);

      const abortController = useChatStore.getState().abortController;

      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            models: modelIds,
            modelConfigs,
            apiKeys: Object.keys(apiKeys).length > 0 ? apiKeys : undefined,
          }),
          signal: abortController?.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          let parsedError = null;
          try {
            parsedError = JSON.parse(errText);
          } catch {
            // Ignored
          }

          for (const id of modelIds) {
            setError(id, parsedError?.error ? `Error: ${parsedError.error}` : `HTTP ${response.status}: ${errText}`);
          }
          return;
        }

        for await (const { event: eventType, data } of parseSSEStream(response)) {
          if (eventType === 'chunk') {
            const chunk = data as SSEChunkData;
            if (chunk.type === 'text') {
              updateResponse(chunk.model, { provider: chunk.provider });
              appendContent(chunk.model, chunk.content);
            } else if (chunk.type === 'reasoning') {
              updateResponse(chunk.model, { provider: chunk.provider });
              appendReasoning(chunk.model, chunk.content);
            } else if (chunk.type === 'done') {
              const tokens = chunk.metadata?.tokensUsed;
              const latency = chunk.metadata?.latencyMs;
              completeResponse(
                chunk.model,
                tokens
                  ? { promptTokens: 0, completionTokens: tokens, totalTokens: tokens }
                  : undefined,
                latency
              );
              trackChatComplete(chunk.model, chunk.provider ?? 'unknown', latency, tokens);
            }
          } else if (eventType === 'error') {
            const errData = data as SSEErrorData;
            setError(errData.model, errData.content);
            trackChatError(errData.model, errData.provider ?? 'unknown');
          } else if (eventType === 'done') {
            // All streams done, nothing to do - individual completes handle state
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return; // User cancelled
        }
        for (const id of modelIds) {
          const resp = useChatStore.getState().responses[id];
          if (resp?.status === 'streaming') {
            setError(id, err instanceof Error ? err.message : 'Unknown error');
          }
        }
      }
    },
    [startStream, appendContent, appendReasoning, completeResponse, setError, updateResponse, models, apiKeys]
  );

  return { startChat, cancelStream, isStreaming };
}

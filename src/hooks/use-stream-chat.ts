'use client';

import { useCallback } from 'react';
import { useChatStore } from '@/store/chat-store';
import { useModelStore } from '@/store/model-store';
import { useApiKeyStore } from '@/store/api-key-store';
import type { SSEChunkData, SSEErrorData } from '@/types/stream';

export function useStreamChat() {
  const {
    startStream,
    appendContent,
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
        return {
          id,
          temperature: config?.parameters.temperature ?? 0.7,
          maxTokens: config?.parameters.maxTokens ?? 4096,
          ...(config?.baseUrl ? { provider: config.provider, baseUrl: config.baseUrl } : {}),
        };
      });

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
          for (const id of modelIds) {
            setError(id, `HTTP ${response.status}: ${errText}`);
          }
          return;
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() || '';

          for (const part of parts) {
            if (!part.trim()) continue;

            const lines = part.split('\n');
            let eventType = '';
            let dataStr = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                dataStr = line.slice(6);
              }
            }

            if (!dataStr) continue;

            try {
              const data = JSON.parse(dataStr);

              if (eventType === 'chunk') {
                const chunk = data as SSEChunkData;
                if (chunk.type === 'text') {
                  updateResponse(chunk.model, { provider: chunk.provider });
                  appendContent(chunk.model, chunk.content);
                } else if (chunk.type === 'done') {
                  completeResponse(
                    chunk.model,
                    chunk.metadata?.tokensUsed
                      ? { promptTokens: 0, completionTokens: chunk.metadata.tokensUsed, totalTokens: chunk.metadata.tokensUsed }
                      : undefined,
                    chunk.metadata?.latencyMs
                  );
                }
              } else if (eventType === 'error') {
                const errData = data as SSEErrorData;
                setError(errData.model, errData.content);
              } else if (eventType === 'done') {
                // All streams done, nothing to do - individual completes handle state
              }
            } catch {
              // Skip malformed JSON
            }
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
    [startStream, appendContent, completeResponse, setError, updateResponse, models, apiKeys]
  );

  return { startChat, cancelStream, isStreaming };
}

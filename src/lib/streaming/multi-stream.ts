import type { ChatRequest, StreamChunk } from '@/types/provider';
import { getProviderForModel } from '@/lib/providers';
import { resolveApiKey, markRateLimited, isServerKey } from '@/lib/api-keys';

interface ParallelRequest {
  model: string;
  request: ChatRequest;
  userApiKeys?: Record<string, string>;
  providerHint?: string;
  baseUrl?: string;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_KEY_RETRIES = 3;

export async function* executeParallel(
  requests: ParallelRequest[]
): AsyncIterable<StreamChunk> {
  const abortControllers = requests.map(() => new AbortController());

  const chunkQueue: StreamChunk[] = [];
  let resolveWait: (() => void) | null = null;
  let activeStreams = requests.length;

  const consumeStream = async (
    req: ParallelRequest,
    index: number
  ) => {
    const controller = abortControllers[index];
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    try {
      const provider = getProviderForModel(req.model, {
        provider: req.providerHint,
        baseUrl: req.baseUrl,
      });

      // Strip provider prefix from model ID for the actual API call
      const slashIdx = req.model.indexOf('/');
      const modelId = req.baseUrl && slashIdx !== -1
        ? req.model.slice(slashIdx + 1)
        : req.model.startsWith('ollama/')
          ? req.model.replace('ollama/', '')
          : req.model.startsWith('custom/')
            ? req.model.replace('custom/', '')
            : req.model;

      // Retry loop for rate-limit rotation (server keys only)
      for (let attempt = 0; attempt <= MAX_KEY_RETRIES; attempt++) {
        let apiKey: string;
        try {
          apiKey = resolveApiKey(provider.name, req.userApiKeys);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'API key error';
          chunkQueue.push({
            type: 'error',
            content: message,
            model: req.model,
            provider: provider.name,
          });
          resolveWait?.();
          return;
        }

        try {
          for await (const chunk of provider.chatStream(
            { ...req.request, model: modelId },
            apiKey,
            controller.signal
          )) {
            chunkQueue.push({ ...chunk, model: req.model });
            resolveWait?.();
          }
          return; // Success — exit retry loop
        } catch (error) {
          const is429 =
            error instanceof Error &&
            (error.message.includes('429') || error.message.toLowerCase().includes('rate limit'));
          const serverKey = isServerKey(provider.name, apiKey, req.userApiKeys);

          if (is429 && serverKey && attempt < MAX_KEY_RETRIES) {
            // Mark this key as rate-limited and retry with the next one
            markRateLimited(provider.name);
            continue;
          }

          // Not retryable — propagate the error
          const message = error instanceof Error ? error.message : 'Unknown error';
          chunkQueue.push({
            type: 'error',
            content: message,
            model: req.model,
            provider: provider.name,
          });
          resolveWait?.();
          return;
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      chunkQueue.push({
        type: 'error',
        content: message,
        model: req.model,
        provider: 'unknown',
      });
      resolveWait?.();
    } finally {
      clearTimeout(timeoutId);
      activeStreams--;
      resolveWait?.();
    }
  };

  // Start consuming all streams in parallel
  requests.forEach((req, index) => consumeStream(req, index));

  // Yield chunks from the queue as they arrive
  while (activeStreams > 0 || chunkQueue.length > 0) {
    if (chunkQueue.length > 0) {
      yield chunkQueue.shift()!;
    } else {
      await new Promise<void>(resolve => {
        resolveWait = resolve;
      });
    }
  }
}

import type { ChatRequest, StreamChunk } from '@/types/provider';
import { getProviderForModel } from '@/lib/providers';
import { resolveApiKey, markRateLimited, isServerKey } from '@/lib/api-keys';
import { generateCacheKey, getCached, setCached } from '@/lib/response-cache';
import { isRateLimitError } from '@/lib/errors';

interface ParallelRequest {
  model: string;
  request: ChatRequest;
  userApiKeys?: Record<string, string>;
  providerHint?: string;
  baseUrl?: string;
}

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_RETRIES = 4;
const BACKOFF_BASE_MS = 5_000; // 5s, 10s, 20s — covers OpenRouter's 8 RPM window
const STAGGER_MS = 1_500; // delay between requests to the same provider

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function* executeParallel(
  requests: ParallelRequest[]
): AsyncIterable<StreamChunk> {
  const abortControllers = requests.map(() => new AbortController());

  const chunkQueue: StreamChunk[] = [];
  let resolveWait: (() => void) | null = null;
  let activeStreams = requests.length;

  const consumeStream = async (
    req: ParallelRequest,
    index: number,
    staggerDelayMs: number
  ) => {
    const controller = abortControllers[index];
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    // Stagger requests to the same provider to avoid burst 429s
    if (staggerDelayMs > 0) {
      await sleep(staggerDelayMs);
    }

    try {
      // --- Cache check ---
      const cacheKey = generateCacheKey(
        req.request.messages,
        req.model,
        req.request.temperature
      );
      const cached = getCached(cacheKey);
      if (cached) {
        if (cached.reasoning) {
          chunkQueue.push({
            type: 'reasoning',
            content: cached.reasoning,
            model: req.model,
            provider: cached.provider,
            metadata: { cached: true },
          });
        }
        chunkQueue.push({
          type: 'text',
          content: cached.content,
          model: req.model,
          provider: cached.provider,
          metadata: { cached: true },
        });
        chunkQueue.push({
          type: 'done',
          content: '',
          model: req.model,
          provider: cached.provider,
          metadata: { cached: true },
        });
        resolveWait?.();
        return;
      }

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

      // Retry loop with exponential backoff for 429 errors
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
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
          const usingServerKey = isServerKey(provider.name, apiKey, req.userApiKeys);
          let accumulatedContent = '';
          let accumulatedReasoning = '';

          for await (const chunk of provider.chatStream(
            { ...req.request, model: modelId },
            apiKey,
            controller.signal
          )) {
            if (chunk.type === 'text') {
              accumulatedContent += chunk.content;
            } else if (chunk.type === 'reasoning') {
              accumulatedReasoning += chunk.content;
            }
            chunkQueue.push({ ...chunk, model: req.model });
            resolveWait?.();
          }

          // Cache completed responses from server keys only
          if (usingServerKey && accumulatedContent) {
            setCached(cacheKey, {
              content: accumulatedContent,
              ...(accumulatedReasoning ? { reasoning: accumulatedReasoning } : {}),
              provider: provider.name,
              cachedAt: Date.now(),
            });
          }

          return; // Success — exit retry loop
        } catch (error) {
          if (isRateLimitError(error) && attempt < MAX_RETRIES) {
            // Rotate server key if available
            const usingServerKey = isServerKey(provider.name, apiKey, req.userApiKeys);
            if (usingServerKey) {
              markRateLimited(provider.name);
            }
            // Exponential backoff before retry
            await sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
            continue;
          }

          // Not retryable — propagate the error with a user-friendly message for 429
          const raw = error instanceof Error ? error.message : 'Unknown error';
          const message = isRateLimitError(error)
            ? `Rate limited — free model quota exceeded. Please wait ~1 min and retry. (${raw})`
            : raw;
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

  // Compute stagger delays: requests to the same provider get increasing delays
  const providerCount = new Map<string, number>();
  const staggerDelays = requests.map((req) => {
    // Resolve provider name for stagger grouping
    const providerName = req.providerHint
      || (req.model.startsWith('ollama/') ? 'ollama'
        : req.model.startsWith('custom/') ? 'custom'
          : req.model);
    const count = providerCount.get(providerName) ?? 0;
    providerCount.set(providerName, count + 1);
    return count * STAGGER_MS;
  });

  // Start consuming all streams in parallel (with stagger)
  requests.forEach((req, index) => consumeStream(req, index, staggerDelays[index]));

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

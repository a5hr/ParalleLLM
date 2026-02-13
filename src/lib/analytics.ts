/**
 * Google Analytics event helpers.
 * Safe to call even if GA is not loaded — all calls are no-ops when gtag is absent.
 */

type GtagFn = (...args: unknown[]) => void;

function gtag(): GtagFn | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as Record<string, GtagFn>).gtag;
}

/** User started a chat with selected models */
export function trackChatStart(modelIds: string[], providers: string[]) {
  gtag()?.('event', 'chat_start', {
    model_count: modelIds.length,
    models: modelIds.join(','),
    providers: [...new Set(providers)].join(','),
  });

  // Also send per-model events for easier breakdown in GA
  for (const modelId of modelIds) {
    const provider = providers[modelIds.indexOf(modelId)] ?? 'unknown';
    gtag()?.('event', 'model_used', {
      model_id: modelId,
      provider,
    });
  }
}

/** A single model's response completed */
export function trackChatComplete(
  modelId: string,
  provider: string,
  latencyMs?: number,
  totalTokens?: number,
) {
  gtag()?.('event', 'chat_complete', {
    model_id: modelId,
    provider,
    latency_ms: latencyMs,
    total_tokens: totalTokens,
  });
}

/** A single model's response errored */
export function trackChatError(modelId: string, provider: string) {
  gtag()?.('event', 'chat_error', {
    model_id: modelId,
    provider,
  });
}

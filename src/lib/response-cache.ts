import { createHash } from 'crypto';
import type { ChatMessage } from '@/types/provider';

interface CachedResponse {
  content: string;
  provider: string;
  tokensUsed?: number;
  cachedAt: number;
}

const cache = new Map<string, CachedResponse>();
const MAX_ENTRIES = 100;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateCacheKey(
  messages: ChatMessage[],
  model: string,
  temperature?: number
): string {
  const payload = JSON.stringify({ messages, model, temperature });
  return createHash('sha256').update(payload).digest('hex');
}

export function getCached(key: string): CachedResponse | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.cachedAt > TTL_MS) {
    cache.delete(key);
    return undefined;
  }

  // Refresh LRU position: delete and re-insert
  cache.delete(key);
  cache.set(key, entry);
  return entry;
}

export function setCached(key: string, response: CachedResponse): void {
  // Delete first to refresh position if key already exists
  cache.delete(key);
  cache.set(key, response);

  // Evict oldest entries if over limit
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

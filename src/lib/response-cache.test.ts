import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCacheKey } from './response-cache';
import type { ChatMessage } from '@/types/provider';

// The module uses a module-level Map, so we need to reset between tests
beforeEach(() => {
  vi.restoreAllMocks();
});

describe('generateCacheKey', () => {
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Hello' },
  ];

  it('generates the same key for the same inputs', () => {
    const key1 = generateCacheKey(messages, 'gpt-4o', 0.7);
    const key2 = generateCacheKey(messages, 'gpt-4o', 0.7);
    expect(key1).toBe(key2);
  });

  it('generates different keys for different temperatures', () => {
    const key1 = generateCacheKey(messages, 'gpt-4o', 0.7);
    const key2 = generateCacheKey(messages, 'gpt-4o', 0.9);
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different models', () => {
    const key1 = generateCacheKey(messages, 'gpt-4o', 0.7);
    const key2 = generateCacheKey(messages, 'claude-3-opus', 0.7);
    expect(key1).not.toBe(key2);
  });

  it('generates different keys for different messages', () => {
    const key1 = generateCacheKey(messages, 'gpt-4o', 0.7);
    const key2 = generateCacheKey(
      [{ role: 'user', content: 'Goodbye' }],
      'gpt-4o',
      0.7
    );
    expect(key1).not.toBe(key2);
  });
});

describe('setCached / getCached', () => {
  beforeEach(() => {
    // Reset module to clear the internal Map
    vi.resetModules();
  });

  it('returns cached entry after set', async () => {
    const { setCached, getCached } = await import('./response-cache');
    const key = 'test-key';
    const entry = { content: 'hello', provider: 'openai', cachedAt: Date.now() };

    setCached(key, entry);
    const result = getCached(key);

    expect(result).toBeDefined();
    expect(result!.content).toBe('hello');
    expect(result!.provider).toBe('openai');
  });

  it('returns undefined for non-existent key', async () => {
    const { getCached } = await import('./response-cache');
    expect(getCached('nonexistent')).toBeUndefined();
  });

  it('returns undefined after TTL expires', async () => {
    vi.useFakeTimers();
    const { setCached, getCached } = await import('./response-cache');

    const key = 'ttl-test';
    setCached(key, { content: 'data', provider: 'openai', cachedAt: Date.now() });

    // Advance past TTL (5 minutes)
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);

    expect(getCached(key)).toBeUndefined();
    vi.useRealTimers();
  });

  it('evicts oldest entry when exceeding MAX_ENTRIES', async () => {
    const { setCached, getCached } = await import('./response-cache');
    const now = Date.now();

    // Fill cache to 100 entries
    for (let i = 0; i < 100; i++) {
      setCached(`key-${i}`, { content: `v${i}`, provider: 'openai', cachedAt: now });
    }

    // The 101st entry should evict the oldest (key-0)
    setCached('key-100', { content: 'v100', provider: 'openai', cachedAt: now });

    expect(getCached('key-0')).toBeUndefined();
    expect(getCached('key-100')).toBeDefined();
    expect(getCached('key-1')).toBeDefined();
  });

  it('refreshes LRU position on getCached', async () => {
    const { setCached, getCached } = await import('./response-cache');
    const now = Date.now();

    // Fill cache to 100
    for (let i = 0; i < 100; i++) {
      setCached(`key-${i}`, { content: `v${i}`, provider: 'openai', cachedAt: now });
    }

    // Access key-0 to refresh its LRU position
    getCached('key-0');

    // Add a new entry — key-1 should be evicted (now the oldest), not key-0
    setCached('key-100', { content: 'v100', provider: 'openai', cachedAt: now });

    expect(getCached('key-0')).toBeDefined();
    expect(getCached('key-1')).toBeUndefined();
  });
});

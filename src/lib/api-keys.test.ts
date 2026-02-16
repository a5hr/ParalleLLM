import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset modules before each test to clear key pool state
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe('resolveApiKey', () => {
  it('returns user key when provided', async () => {
    const { resolveApiKey } = await import('./api-keys');
    const key = resolveApiKey('openai', { openai: 'user-key-123' });
    expect(key).toBe('user-key-123');
  });

  it('returns server key from environment variable', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'server-key-abc');
    const { resolveApiKey } = await import('./api-keys');

    const key = resolveApiKey('openai');
    expect(key).toBe('server-key-abc');
  });

  it('creates key pool from comma-separated env var', async () => {
    vi.stubEnv('GROQ_API_KEY', 'key1,key2,key3');
    const { resolveApiKey } = await import('./api-keys');

    // First call gets key1
    const key1 = resolveApiKey('groq');
    expect(key1).toBe('key1');

    // Second call gets key2 (round-robin)
    const key2 = resolveApiKey('groq');
    expect(key2).toBe('key2');

    // Third call gets key3
    const key3 = resolveApiKey('groq');
    expect(key3).toBe('key3');

    // Fourth call wraps around to key1
    const key4 = resolveApiKey('groq');
    expect(key4).toBe('key1');
  });

  it('throws for cloud provider without key', async () => {
    const { resolveApiKey } = await import('./api-keys');
    expect(() => resolveApiKey('openai')).toThrow('No API key for "openai"');
  });

  it('returns "not-needed" for local providers', async () => {
    const { resolveApiKey } = await import('./api-keys');
    expect(resolveApiKey('ollama')).toBe('not-needed');
    expect(resolveApiKey('custom')).toBe('not-needed');
    expect(resolveApiKey('lmstudio')).toBe('not-needed');
  });

  it('returns "not-needed" for unknown providers', async () => {
    const { resolveApiKey } = await import('./api-keys');
    expect(resolveApiKey('unknown-provider')).toBe('not-needed');
  });
});

describe('markRateLimited + key rotation', () => {
  it('rotates to next key after marking rate-limited', async () => {
    vi.stubEnv('GROQ_API_KEY', 'keyA,keyB');
    const { resolveApiKey, markRateLimited } = await import('./api-keys');

    // First call uses keyA
    const first = resolveApiKey('groq');
    expect(first).toBe('keyA');

    // Mark the last used key (keyA) as rate-limited
    markRateLimited('groq');

    // Next call should skip keyA and return keyB
    const second = resolveApiKey('groq');
    expect(second).toBe('keyB');
  });

  it('returns earliest-expiring key when all are rate-limited', async () => {
    vi.useFakeTimers();
    vi.stubEnv('GROQ_API_KEY', 'keyA,keyB');
    const { resolveApiKey, markRateLimited } = await import('./api-keys');

    // Use and rate-limit keyA
    resolveApiKey('groq'); // keyA
    markRateLimited('groq', 30_000); // keyA cooldown 30s

    // Use and rate-limit keyB
    vi.advanceTimersByTime(5000);
    resolveApiKey('groq'); // keyB
    markRateLimited('groq', 60_000); // keyB cooldown 60s

    // Both limited — should return keyA (earlier expiry)
    const result = resolveApiKey('groq');
    expect(result).toBe('keyA');

    vi.useRealTimers();
  });
});

describe('isServerKey', () => {
  it('returns true when no user key is provided', async () => {
    const { isServerKey } = await import('./api-keys');
    expect(isServerKey('openai', 'server-key')).toBe(true);
  });

  it('returns true when resolved key differs from user key', async () => {
    const { isServerKey } = await import('./api-keys');
    expect(isServerKey('openai', 'server-key', { openai: 'user-key' })).toBe(true);
  });

  it('returns false when resolved key matches user key', async () => {
    const { isServerKey } = await import('./api-keys');
    expect(isServerKey('openai', 'user-key', { openai: 'user-key' })).toBe(false);
  });
});

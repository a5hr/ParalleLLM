import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

describe('checkRateLimit', () => {
  it('allows up to 20 requests within the window', async () => {
    const { checkRateLimit } = await import('./rate-limiter');

    for (let i = 0; i < 20; i++) {
      const result = checkRateLimit('client-1');
      expect(result.allowed, `request ${i + 1} should be allowed`).toBe(true);
    }
  });

  it('blocks the 21st request', async () => {
    const { checkRateLimit } = await import('./rate-limiter');

    for (let i = 0; i < 20; i++) {
      checkRateLimit('client-1');
    }

    const result = checkRateLimit('client-1');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeDefined();
    expect(result.retryAfterMs!).toBeGreaterThan(0);
    expect(result.retryAfterMs!).toBeLessThanOrEqual(60_000);
  });

  it('resets after window expires', async () => {
    vi.useFakeTimers();
    const { checkRateLimit } = await import('./rate-limiter');

    // Exhaust the limit
    for (let i = 0; i < 20; i++) {
      checkRateLimit('client-1');
    }
    expect(checkRateLimit('client-1').allowed).toBe(false);

    // Advance past the 60-second window
    vi.advanceTimersByTime(60_001);

    // Should be allowed again
    const result = checkRateLimit('client-1');
    expect(result.allowed).toBe(true);

    vi.useRealTimers();
  });

  it('tracks different clientIds independently', async () => {
    const { checkRateLimit } = await import('./rate-limiter');

    // Exhaust client-1
    for (let i = 0; i < 20; i++) {
      checkRateLimit('client-1');
    }
    expect(checkRateLimit('client-1').allowed).toBe(false);

    // client-2 should still be allowed
    expect(checkRateLimit('client-2').allowed).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { isRateLimitError } from './errors';

describe('isRateLimitError', () => {
  it('detects error with status 429', () => {
    const err = new Error('Too Many Requests');
    (err as unknown as { status: number }).status = 429;
    expect(isRateLimitError(err)).toBe(true);
  });

  it('detects error with "429" in message', () => {
    expect(isRateLimitError(new Error('429 Provider returned error'))).toBe(true);
  });

  it('detects error with "rate limit" in message', () => {
    expect(isRateLimitError(new Error('Rate limit exceeded'))).toBe(true);
  });

  it('detects error with "rate_limit" in message', () => {
    expect(isRateLimitError(new Error('error code: rate_limit_exceeded'))).toBe(true);
  });

  it('returns false for non-rate-limit errors', () => {
    expect(isRateLimitError(new Error('Connection timeout'))).toBe(false);
    expect(isRateLimitError(new Error('401 Unauthorized'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isRateLimitError('429')).toBe(false);
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});

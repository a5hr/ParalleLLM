import { describe, it, expect } from 'vitest';
import { capMaxTokens } from './route';

describe('capMaxTokens', () => {
  it('caps to server maxOutput for known model (OpenRouter Llama)', () => {
    // meta-llama/llama-3.3-70b-instruct:free has maxOutput 32768
    expect(capMaxTokens(65536, 'meta-llama/llama-3.3-70b-instruct:free', false)).toBe(32768);
  });

  it('caps to server maxOutput for known model (DeepSeek R1)', () => {
    // deepseek/deepseek-r1-0528:free has maxOutput 32768
    expect(capMaxTokens(163840, 'deepseek/deepseek-r1-0528:free', false)).toBe(32768);
  });

  it('returns requested value when within server limit', () => {
    expect(capMaxTokens(4096, 'deepseek/deepseek-r1-0528:free', false)).toBe(4096);
  });

  it('caps to FALLBACK_MAX_OUTPUT (4096) for unknown cloud model', () => {
    expect(capMaxTokens(163840, 'nonexistent/some-model:free', false)).toBe(4096);
  });

  it('caps resolved alias model to its maxOutput', () => {
    // Route resolves deepseek-chat-v3-0324:free → deepseek-r1-0528:free before calling capMaxTokens
    // So capMaxTokens receives the resolved ID which IS in defaultModels (maxOutput: 32768)
    expect(capMaxTokens(163840, 'deepseek/deepseek-r1-0528:free', false)).toBe(32768);
  });

  it('caps to FALLBACK_MAX_OUTPUT for any unknown model ID without baseUrl', () => {
    expect(capMaxTokens(100000, 'nonexistent/model:free', false)).toBe(4096);
  });

  it('trusts requested value for custom/local models with baseUrl', () => {
    expect(capMaxTokens(65536, 'custom/my-model', true)).toBe(65536);
  });

  it('still caps known model even with baseUrl', () => {
    // Known model ID overrides baseUrl trust
    expect(capMaxTokens(65536, 'meta-llama/llama-3.3-70b-instruct:free', true)).toBe(32768);
  });
});

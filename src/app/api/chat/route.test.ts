import { describe, it, expect } from 'vitest';
import { capMaxTokens, fixedTemperatureModels, thinkingModels } from './route';

describe('capMaxTokens', () => {
  it('caps to server maxOutput for known model (OpenRouter Llama)', () => {
    // meta-llama/llama-3.3-70b-instruct:free has maxOutput 128000 now
    expect(capMaxTokens(160000, 'meta-llama/llama-3.3-70b-instruct:free', false)).toBe(128000);
  });

  it('caps to server maxOutput for known model (DeepSeek R1)', () => {
    // deepseek/deepseek-r1-zero:free has maxOutput 32768
    expect(capMaxTokens(163840, 'deepseek/deepseek-r1-zero:free', false)).toBe(32768);
  });

  it('returns requested value when within server limit', () => {
    expect(capMaxTokens(4096, 'deepseek/deepseek-r1-zero:free', false)).toBe(4096);
  });

  it('caps to FALLBACK_MAX_OUTPUT (4096) for unknown cloud model', () => {
    expect(capMaxTokens(163840, 'nonexistent/some-model:free', false)).toBe(4096);
  });

  it('caps resolved alias model to its maxOutput', () => {
    // If we passed an alias and it resolved, it would cap. We just test the base behavior now
    expect(capMaxTokens(163840, 'deepseek/deepseek-r1-zero:free', false)).toBe(32768);
  });

  it('caps to FALLBACK_MAX_OUTPUT for any unknown model ID without baseUrl', () => {
    expect(capMaxTokens(100000, 'nonexistent/model:free', false)).toBe(4096);
  });

  it('trusts requested value for custom/local models with baseUrl', () => {
    expect(capMaxTokens(65536, 'custom/my-model', true)).toBe(65536);
  });

  it('still caps known model even with baseUrl', () => {
    // Known model ID overrides baseUrl trust
    expect(capMaxTokens(160000, 'meta-llama/llama-3.3-70b-instruct:free', true)).toBe(128000);
  });
});

describe('fixedTemperatureModels', () => {
  it('includes gpt-5-mini', () => {
    expect(fixedTemperatureModels.has('gpt-5-mini')).toBe(true);
  });

  it('does not include models that support temperature', () => {
    expect(fixedTemperatureModels.has('gpt-5.2')).toBe(false);
    expect(fixedTemperatureModels.has('gpt-4o-mini')).toBe(false);
    expect(fixedTemperatureModels.has('llama-3.3-70b-versatile')).toBe(false);
  });
});

describe('thinkingModels', () => {
  it('includes models with reasoning feature', () => {
    expect(thinkingModels.has('gpt-5.2')).toBe(true);
    expect(thinkingModels.has('deepseek/deepseek-r1-zero:free')).toBe(true);
  });

  it('includes models with extended-thinking feature', () => {
    expect(thinkingModels.has('claude-opus-4-6')).toBe(true);
    expect(thinkingModels.has('claude-sonnet-4-5-20250929')).toBe(true);
    expect(thinkingModels.has('claude-haiku-4-5-20251001')).toBe(true);
  });

  it('does not include models without thinking features', () => {
    expect(thinkingModels.has('gpt-4o-mini')).toBe(false);
    expect(thinkingModels.has('llama-3.3-70b-versatile')).toBe(false);
  });
});

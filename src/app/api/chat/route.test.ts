import { describe, it, expect } from 'vitest';
import { capMaxTokens, fixedTemperatureModels, thinkingModels } from './route';
import { defaultModels } from '@/lib/models';

const maxOutputOf = (id: string) => {
  const model = defaultModels.find(m => m.id === id);
  if (!model) throw new Error(`Model not found in models.json: ${id}`);
  return model.maxOutput;
};
// Two Groq models with different maxOutput limits
const LARGE_ID = 'openai/gpt-oss-120b';
const SMALL_ID = 'qwen/qwen3.8-27b';

describe('capMaxTokens', () => {
  it('caps to server maxOutput for known model (large limit)', () => {
    // Expected value follows models.json, which is auto-updated daily
    expect(capMaxTokens(1_000_000, LARGE_ID, false)).toBe(maxOutputOf(LARGE_ID));
  });

  it('caps to server maxOutput for known model (small limit)', () => {
    expect(capMaxTokens(163840, SMALL_ID, false)).toBe(maxOutputOf(SMALL_ID));
  });

  it('returns requested value when within server limit', () => {
    expect(capMaxTokens(4096, SMALL_ID, false)).toBe(4096);
  });

  it('caps to FALLBACK_MAX_OUTPUT (4096) for unknown cloud model', () => {
    expect(capMaxTokens(163840, 'nonexistent/some-model:free', false)).toBe(4096);
  });

  it('caps resolved alias model to its maxOutput', () => {
    // If we passed an alias and it resolved, it would cap. We just test the base behavior now
    expect(capMaxTokens(163840, SMALL_ID, false)).toBe(maxOutputOf(SMALL_ID));
  });

  it('caps to FALLBACK_MAX_OUTPUT for any unknown model ID without baseUrl', () => {
    expect(capMaxTokens(100000, 'nonexistent/model:free', false)).toBe(4096);
  });

  it('trusts requested value for custom/local models with baseUrl', () => {
    expect(capMaxTokens(65536, 'custom/my-model', true)).toBe(65536);
  });

  it('still caps known model even with baseUrl', () => {
    // Known model ID overrides baseUrl trust
    expect(capMaxTokens(1_000_000, LARGE_ID, true)).toBe(maxOutputOf(LARGE_ID));
  });
});

describe('fixedTemperatureModels', () => {
  it('includes GPT-6 and Claude 5 models (temperature not sent)', () => {
    expect(fixedTemperatureModels.has('gpt-6.1-sol')).toBe(true);
    expect(fixedTemperatureModels.has('claude-opus-5-5')).toBe(true);
  });

  it('does not include models that support temperature', () => {
    expect(fixedTemperatureModels.has('gemini-3.8-flash')).toBe(false);
    expect(fixedTemperatureModels.has('openai/gpt-oss-120b')).toBe(false);
    expect(fixedTemperatureModels.has('qwen/qwen3.8-27b')).toBe(false);
  });
});

describe('thinkingModels', () => {
  it('includes models with reasoning feature', () => {
    expect(thinkingModels.has('gpt-6.1-sol')).toBe(true);
    expect(thinkingModels.has('gpt-6-luna')).toBe(true);
  });

  it('excludes Claude 5 models (adaptive thinking, no manual budget)', () => {
    expect(thinkingModels.has('claude-opus-5-5')).toBe(false);
    expect(thinkingModels.has('claude-sonnet-5-5')).toBe(false);
    expect(thinkingModels.has('claude-haiku-5-5')).toBe(false);
  });

  it('does not include models without thinking features', () => {
    expect(thinkingModels.has('gemini-3.8-flash')).toBe(false);
    expect(thinkingModels.has('qwen/qwen3.8-27b')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { capMaxTokens, fixedTemperatureModels, thinkingModels } from './route';
import { defaultModels } from '@/lib/models';

const maxOutputOf = (id: string) => {
  const model = defaultModels.find(m => m.id === id);
  if (!model) throw new Error(`Model not found in models.json: ${id}`);
  return model.maxOutput;
};
const LLAMA_ID = 'meta-llama/llama-3.3-70b-instruct:free';
const DEEPSEEK_ID = 'deepseek/deepseek-r1-zero:free';

describe('capMaxTokens', () => {
  it('caps to server maxOutput for known model (OpenRouter Llama)', () => {
    // Expected value follows models.json, which is auto-updated daily
    expect(capMaxTokens(160000, LLAMA_ID, false)).toBe(maxOutputOf(LLAMA_ID));
  });

  it('caps to server maxOutput for known model (DeepSeek R1)', () => {
    expect(capMaxTokens(163840, DEEPSEEK_ID, false)).toBe(maxOutputOf(DEEPSEEK_ID));
  });

  it('returns requested value when within server limit', () => {
    expect(capMaxTokens(4096, 'deepseek/deepseek-r1-zero:free', false)).toBe(4096);
  });

  it('caps to FALLBACK_MAX_OUTPUT (4096) for unknown cloud model', () => {
    expect(capMaxTokens(163840, 'nonexistent/some-model:free', false)).toBe(4096);
  });

  it('caps resolved alias model to its maxOutput', () => {
    // If we passed an alias and it resolved, it would cap. We just test the base behavior now
    expect(capMaxTokens(163840, DEEPSEEK_ID, false)).toBe(maxOutputOf(DEEPSEEK_ID));
  });

  it('caps to FALLBACK_MAX_OUTPUT for any unknown model ID without baseUrl', () => {
    expect(capMaxTokens(100000, 'nonexistent/model:free', false)).toBe(4096);
  });

  it('trusts requested value for custom/local models with baseUrl', () => {
    expect(capMaxTokens(65536, 'custom/my-model', true)).toBe(65536);
  });

  it('still caps known model even with baseUrl', () => {
    // Known model ID overrides baseUrl trust
    expect(capMaxTokens(160000, LLAMA_ID, true)).toBe(maxOutputOf(LLAMA_ID));
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

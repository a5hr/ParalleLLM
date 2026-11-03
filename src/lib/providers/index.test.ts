import { describe, it, expect } from 'vitest';
import { getProvider, getProviderForModel, providerRegistry, resolveModelId } from './index';

describe('getProvider', () => {
  it('returns provider for known names', () => {
    expect(getProvider('openai').name).toBe('openai');
    expect(getProvider('anthropic').name).toBe('anthropic');
    expect(getProvider('google').name).toBe('google');
    expect(getProvider('groq').name).toBe('groq');
    expect(getProvider('openrouter').name).toBe('openrouter');
    expect(getProvider('ollama').name).toBe('ollama');
  });

  it('throws for unknown provider', () => {
    expect(() => getProvider('nonexistent')).toThrow('Unknown provider');
  });
});

describe('getProviderForModel', () => {
  it('routes known model IDs to correct providers', () => {
    expect(getProviderForModel('gpt-6.1-sol').name).toBe('openai');
    expect(getProviderForModel('claude-opus-5-5').name).toBe('anthropic');
    expect(getProviderForModel('gemini-3.8-flash').name).toBe('google');
    expect(getProviderForModel('openai/gpt-oss-120b').name).toBe('groq');
    expect(getProviderForModel('thinkingmachines/inkling:free').name).toBe('openrouter');
  });

  it('routes ollama/ prefix to ollama provider', () => {
    expect(getProviderForModel('ollama/llama3').name).toBe('ollama');
  });

  it('routes custom/ prefix to custom provider', () => {
    expect(getProviderForModel('custom/my-model').name).toBe('custom');
  });

  it('creates dynamic provider for baseUrl option', () => {
    const provider = getProviderForModel('any-model', {
      baseUrl: 'http://localhost:8080/v1',
    });
    expect(provider).toBeDefined();
    expect(provider.type).toBe('local');
  });

  it('throws for invalid baseUrl (SSRF prevention)', () => {
    expect(() =>
      getProviderForModel('any-model', {
        baseUrl: 'http://8.8.8.8:8080',
      })
    ).toThrow('Blocked baseUrl');
  });

  it('throws for unknown model ID', () => {
    expect(() => getProviderForModel('completely-unknown-model')).toThrow('Unknown model');
  });

  it('throws for discontinued models that were removed from models.json', () => {
    expect(() => getProviderForModel('deepseek/deepseek-r1-zero:free')).toThrow('Unknown model');
  });
});

describe('resolveModelId', () => {
  it('resolves deprecated models to replacements', () => {
    // Currently no aliases are defined that change the ID, but we test the identity function
    expect(resolveModelId('gpt-5.2')).toBe('gpt-5.2');
  });

  it('returns known models unchanged', () => {
    expect(resolveModelId('gpt-6.1-sol')).toBe('gpt-6.1-sol');
  });
});

describe('providerRegistry', () => {
  it('contains all expected providers', () => {
    const expected = ['openai', 'anthropic', 'google', 'groq', 'openrouter', 'ollama', 'custom'];
    for (const name of expected) {
      expect(providerRegistry.has(name), `registry should have ${name}`).toBe(true);
    }
  });
});

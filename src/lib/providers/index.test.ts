import { describe, it, expect } from 'vitest';
import { getProvider, getProviderForModel, providerRegistry } from './index';

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
    expect(getProviderForModel('gpt-5.2').name).toBe('openai');
    expect(getProviderForModel('claude-opus-4-6').name).toBe('anthropic');
    expect(getProviderForModel('gemini-2.5-pro').name).toBe('google');
    expect(getProviderForModel('llama-3.3-70b-versatile').name).toBe('groq');
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
});

describe('providerRegistry', () => {
  it('contains all expected providers', () => {
    const expected = ['openai', 'anthropic', 'google', 'groq', 'openrouter', 'ollama', 'custom'];
    for (const name of expected) {
      expect(providerRegistry.has(name), `registry should have ${name}`).toBe(true);
    }
  });
});

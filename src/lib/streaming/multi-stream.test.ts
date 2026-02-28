import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamChunk, LLMProvider } from '@/types/provider';

// Mock dependencies before importing the module under test
vi.mock('@/lib/providers', () => ({
  getProviderForModel: vi.fn(),
}));

vi.mock('@/lib/api-keys', () => ({
  resolveApiKey: vi.fn(),
  markRateLimited: vi.fn(),
  isServerKey: vi.fn(),
}));

vi.mock('@/lib/response-cache', () => ({
  generateCacheKey: vi.fn(),
  getCached: vi.fn(),
  setCached: vi.fn(),
}));

import { getProviderForModel } from '@/lib/providers';
import { resolveApiKey, markRateLimited, isServerKey } from '@/lib/api-keys';
import { generateCacheKey, getCached, setCached } from '@/lib/response-cache';
import { executeParallel } from './multi-stream';

const mockGetProviderForModel = vi.mocked(getProviderForModel);
const mockResolveApiKey = vi.mocked(resolveApiKey);
const mockIsServerKey = vi.mocked(isServerKey);
const mockMarkRateLimited = vi.mocked(markRateLimited);
const mockGenerateCacheKey = vi.mocked(generateCacheKey);
const mockGetCached = vi.mocked(getCached);
vi.mocked(setCached);

function createMockProvider(name: string, chunks: StreamChunk[]): LLMProvider {
  return {
    name,
    type: 'cloud',
    requiresApiKey: true,
    async *chatStream(): AsyncIterable<StreamChunk> {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
    async listModels() {
      return [];
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGenerateCacheKey.mockReturnValue('cache-key');
  mockGetCached.mockReturnValue(undefined);
  mockResolveApiKey.mockReturnValue('test-key');
  mockIsServerKey.mockReturnValue(true);
});

describe('executeParallel', () => {
  it('streams chunks from two models in parallel', async () => {
    const provider1 = createMockProvider('openai', [
      { type: 'text', content: 'Hello from GPT', model: 'gpt', provider: 'openai' },
      { type: 'done', content: '', model: 'gpt', provider: 'openai' },
    ]);
    const provider2 = createMockProvider('anthropic', [
      { type: 'text', content: 'Hello from Claude', model: 'claude', provider: 'anthropic' },
      { type: 'done', content: '', model: 'claude', provider: 'anthropic' },
    ]);

    mockGetProviderForModel
      .mockReturnValueOnce(provider1)
      .mockReturnValueOnce(provider2);
    mockGenerateCacheKey
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2');

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-4o',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' },
      },
      {
        model: 'claude-3-opus',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'claude-3-opus' },
      },
    ])) {
      chunks.push(chunk);
    }

    const textChunks = chunks.filter((c) => c.type === 'text');
    const models = textChunks.map((c) => c.model);
    expect(models).toContain('gpt-4o');
    expect(models).toContain('claude-3-opus');
  });

  it('skips API call when cache hits', async () => {
    mockGetCached.mockReturnValue({
      content: 'cached response',
      provider: 'openai',
      cachedAt: Date.now(),
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-4o',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' },
      },
    ])) {
      chunks.push(chunk);
    }

    // Should have received text + done from cache, no API call
    expect(chunks.length).toBe(2);
    expect(chunks[0].type).toBe('text');
    expect(chunks[0].content).toBe('cached response');
    expect(chunks[0].metadata?.cached).toBe(true);
    expect(chunks[1].type).toBe('done');

    // Provider should never be called
    expect(mockGetProviderForModel).not.toHaveBeenCalled();
  });

  it('passes reasoning chunks through to output', async () => {
    const provider = createMockProvider('openai', [
      { type: 'reasoning', content: 'Let me think...', model: 'gpt', provider: 'openai' },
      { type: 'text', content: 'The answer is 42', model: 'gpt', provider: 'openai' },
      { type: 'done', content: '', model: 'gpt', provider: 'openai' },
    ]);

    mockGetProviderForModel.mockReturnValue(provider);

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-5.2',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-5.2' },
      },
    ])) {
      chunks.push(chunk);
    }

    const reasoningChunks = chunks.filter((c) => c.type === 'reasoning');
    expect(reasoningChunks.length).toBe(1);
    expect(reasoningChunks[0].content).toBe('Let me think...');

    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBe(1);
    expect(textChunks[0].content).toBe('The answer is 42');
  });

  it('includes reasoning in cache and replays on hit', async () => {
    mockGetCached.mockReturnValue({
      content: 'cached answer',
      reasoning: 'cached thinking',
      provider: 'openai',
      cachedAt: Date.now(),
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-5.2',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-5.2' },
      },
    ])) {
      chunks.push(chunk);
    }

    // Should have reasoning + text + done from cache
    expect(chunks.length).toBe(3);
    expect(chunks[0].type).toBe('reasoning');
    expect(chunks[0].content).toBe('cached thinking');
    expect(chunks[0].metadata?.cached).toBe(true);
    expect(chunks[1].type).toBe('text');
    expect(chunks[1].content).toBe('cached answer');
    expect(chunks[2].type).toBe('done');

    expect(mockGetProviderForModel).not.toHaveBeenCalled();
  });

  it('produces error chunk when resolveApiKey throws', async () => {
    const provider = createMockProvider('openai', []);
    mockGetProviderForModel.mockReturnValue(provider);
    mockResolveApiKey.mockImplementation(() => {
      throw new Error('No API key for "openai"');
    });

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-4o',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' },
      },
    ])) {
      chunks.push(chunk);
    }

    const errorChunk = chunks.find((c) => c.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk!.content).toContain('No API key');
  });

  it('produces error chunk when provider stream throws', async () => {
    const provider: LLMProvider = {
      name: 'openai',
      type: 'cloud',
      requiresApiKey: true,
      async *chatStream(): AsyncIterable<StreamChunk> {
        throw new Error('Connection timeout');
      },
      async listModels() {
        return [];
      },
    };

    mockGetProviderForModel.mockReturnValue(provider);
    mockIsServerKey.mockReturnValue(false); // user key, no retry

    const chunks: StreamChunk[] = [];
    for await (const chunk of executeParallel([
      {
        model: 'gpt-4o',
        request: { messages: [{ role: 'user', content: 'hi' }], model: 'gpt-4o' },
      },
    ])) {
      chunks.push(chunk);
    }

    const errorChunk = chunks.find((c) => c.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk!.content).toContain('Connection timeout');
  });

  it('retries with next key on 429 rate-limit error (server key)', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const provider: LLMProvider = {
      name: 'openrouter',
      type: 'cloud',
      requiresApiKey: true,
      async *chatStream(): AsyncIterable<StreamChunk> {
        callCount++;
        if (callCount === 1) {
          const err = new Error('429 Rate limit exceeded');
          (err as unknown as { status: number }).status = 429;
          throw err;
        }
        yield { type: 'text', content: 'Success after retry', model: 'test', provider: 'openrouter' };
        yield { type: 'done', content: '', model: 'test', provider: 'openrouter' };
      },
      async listModels() {
        return [];
      },
    };

    mockGetProviderForModel.mockReturnValue(provider);
    mockIsServerKey.mockReturnValue(true);
    mockResolveApiKey
      .mockReturnValueOnce('key-1')
      .mockReturnValueOnce('key-2');

    const chunks: StreamChunk[] = [];
    const collectPromise = (async () => {
      for await (const chunk of executeParallel([
        {
          model: 'test-model',
          request: { messages: [{ role: 'user', content: 'hi' }], model: 'test-model' },
        },
      ])) {
        chunks.push(chunk);
      }
    })();

    // Advance past the 5s backoff (BACKOFF_BASE_MS * 2^0 = 5000ms)
    await vi.advanceTimersByTimeAsync(8000);
    await collectPromise;

    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBe(1);
    expect(textChunks[0].content).toBe('Success after retry');
    expect(mockMarkRateLimited).toHaveBeenCalledWith('openrouter');
    expect(callCount).toBe(2);

    vi.useRealTimers();
  });

  it('retries 429 for user keys with backoff (no key rotation)', async () => {
    vi.useFakeTimers();

    let callCount = 0;
    const provider: LLMProvider = {
      name: 'openrouter',
      type: 'cloud',
      requiresApiKey: true,
      async *chatStream(): AsyncIterable<StreamChunk> {
        callCount++;
        if (callCount === 1) {
          const err = new Error('429 Rate limit exceeded');
          (err as unknown as { status: number }).status = 429;
          throw err;
        }
        yield { type: 'text', content: 'Success after retry', model: 'test', provider: 'openrouter' };
        yield { type: 'done', content: '', model: 'test', provider: 'openrouter' };
      },
      async listModels() {
        return [];
      },
    };

    mockGetProviderForModel.mockReturnValue(provider);
    mockIsServerKey.mockReturnValue(false); // user key — retries with backoff but no key rotation

    const chunks: StreamChunk[] = [];
    const collectPromise = (async () => {
      for await (const chunk of executeParallel([
        {
          model: 'test-model',
          request: { messages: [{ role: 'user', content: 'hi' }], model: 'test-model' },
        },
      ])) {
        chunks.push(chunk);
      }
    })();

    // Advance past the 5s backoff (BACKOFF_BASE_MS * 2^0 = 5000ms)
    await vi.advanceTimersByTimeAsync(8000);
    await collectPromise;

    // Should have retried and succeeded
    const textChunks = chunks.filter((c) => c.type === 'text');
    expect(textChunks.length).toBe(1);
    expect(textChunks[0].content).toBe('Success after retry');

    // markRateLimited should NOT be called for user keys
    expect(mockMarkRateLimited).not.toHaveBeenCalled();
    expect(callCount).toBe(2);

    vi.useRealTimers();
  });

  it('shows friendly error when 429 exhausts all retries', async () => {
    vi.useFakeTimers();

    const provider: LLMProvider = {
      name: 'openrouter',
      type: 'cloud',
      requiresApiKey: true,
      async *chatStream(): AsyncIterable<StreamChunk> {
        const err = new Error('429 Rate limit exceeded');
        (err as unknown as { status: number }).status = 429;
        throw err;
      },
      async listModels() {
        return [];
      },
    };

    mockGetProviderForModel.mockReturnValue(provider);
    mockIsServerKey.mockReturnValue(true);

    const chunks: StreamChunk[] = [];
    const collectPromise = (async () => {
      for await (const chunk of executeParallel([
        {
          model: 'test-model',
          request: { messages: [{ role: 'user', content: 'hi' }], model: 'test-model' },
        },
      ])) {
        chunks.push(chunk);
      }
    })();

    // Advance past all 5 attempts: 5s + 10s + 20s + 40s = 75s backoff + initial attempt
    await vi.advanceTimersByTimeAsync(100_000);
    await collectPromise;

    const errorChunk = chunks.find((c) => c.type === 'error');
    expect(errorChunk).toBeDefined();
    expect(errorChunk!.content).toContain('Rate limited');
    expect(errorChunk!.content).toContain('wait ~1 min');
    expect(errorChunk!.content).toContain('429 Rate limit exceeded');

    vi.useRealTimers();
  });
});

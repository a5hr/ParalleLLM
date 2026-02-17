import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamChunk } from '@/types/provider';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('openai', () => {
  const MockOpenAI = function () {
    return {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };
  };
  return { default: MockOpenAI };
});

// Must import AFTER vi.mock
import { openaiProvider } from './openai';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('openaiProvider', () => {
  it('sends max_completion_tokens instead of max_tokens', async () => {
    const asyncIterable = (async function* () {
      yield { choices: [{ delta: { content: 'hello' } }] };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of openaiProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-5.2',
        maxTokens: 4096,
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).toHaveProperty('max_completion_tokens', 4096);
    expect(callArgs).not.toHaveProperty('max_tokens');
  });

  it('defaults max_completion_tokens to 4096 when not specified', async () => {
    const asyncIterable = (async function* () {
      yield { choices: [{ delta: { content: 'hi' } }] };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of openaiProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'gpt-5.2',
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_completion_tokens).toBe(4096);
    expect(callArgs).not.toHaveProperty('max_tokens');
  });
});

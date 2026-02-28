import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamChunk } from '@/types/provider';

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = function () {
    return {
      messages: {
        create: mockCreate,
      },
    };
  };
  return { default: MockAnthropic };
});

// Must import AFTER vi.mock
import { anthropicProvider } from './anthropic';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('anthropicProvider', () => {
  it('yields text chunks from text_delta events', async () => {
    const asyncIterable = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of anthropicProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-sonnet-4-5-20250929',
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe('text');
    expect(chunks[0].content).toBe('Hello');
    expect(chunks[1].type).toBe('done');
  });

  it('yields reasoning chunks from thinking_delta events', async () => {
    const asyncIterable = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'thinking_delta', thinking: 'Let me consider...' } };
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'The answer' } };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of anthropicProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-opus-4-6',
        thinking: true,
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    expect(chunks[0].type).toBe('reasoning');
    expect(chunks[0].content).toBe('Let me consider...');
    expect(chunks[1].type).toBe('text');
    expect(chunks[1].content).toBe('The answer');
    expect(chunks[2].type).toBe('done');
  });

  it('sends thinking config and omits temperature when thinking is enabled', async () => {
    const asyncIterable = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of anthropicProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-opus-4-6',
        thinking: true,
        temperature: 0.7,
        maxTokens: 4096,
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    // Should have thinking config
    expect(callArgs.thinking).toEqual({ type: 'enabled', budget_tokens: 16384 });
    // Should NOT have temperature when thinking is enabled
    expect(callArgs).not.toHaveProperty('temperature');
  });

  it('sends temperature and no thinking config when thinking is disabled', async () => {
    const asyncIterable = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of anthropicProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.5,
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('thinking');
    expect(callArgs.temperature).toBe(0.5);
  });

  it('computes budget_tokens as 4x maxTokens with minimum 1024', async () => {
    const asyncIterable = (async function* () {
      yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
    })();
    mockCreate.mockResolvedValue(asyncIterable);

    const chunks: StreamChunk[] = [];
    for await (const chunk of anthropicProvider.chatStream(
      {
        messages: [{ role: 'user', content: 'hi' }],
        model: 'claude-opus-4-6',
        thinking: true,
        maxTokens: 100, // 100 * 4 = 400 < 1024, should use 1024
      },
      'test-key',
      new AbortController().signal
    )) {
      chunks.push(chunk);
    }

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.thinking.budget_tokens).toBe(1024);
  });
});

import { describe, it, expect } from 'vitest';
import { encodeSSE, createSSEStream } from './sse-encoder';
import type { StreamChunk } from '@/types/provider';

describe('encodeSSE', () => {
  it('formats SSE event correctly', () => {
    const result = encodeSSE('chunk', { type: 'text', content: 'hello' });
    expect(result).toBe(
      'event: chunk\ndata: {"type":"text","content":"hello"}\n\n'
    );
  });

  it('formats error event', () => {
    const result = encodeSSE('error', { type: 'error', content: 'fail' });
    expect(result).toBe(
      'event: error\ndata: {"type":"error","content":"fail"}\n\n'
    );
  });

  it('formats done event with empty object', () => {
    const result = encodeSSE('done', {});
    expect(result).toBe('event: done\ndata: {}\n\n');
  });
});

describe('createSSEStream', () => {
  it('converts AsyncIterable to ReadableStream', async () => {
    async function* source(): AsyncIterable<StreamChunk> {
      yield { type: 'text', content: 'Hello', model: 'test', provider: 'test' };
      yield { type: 'done', content: '', model: 'test', provider: 'test' };
    }

    const stream = createSSEStream(source());
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    const output = chunks.join('');
    // Should contain the text chunk, done chunk, and final done event
    expect(output).toContain('event: chunk');
    expect(output).toContain('"content":"Hello"');
    // Final done event
    expect(output).toContain('event: done\ndata: {}');
  });

  it('encodes error chunks with error event type', async () => {
    async function* source(): AsyncIterable<StreamChunk> {
      yield { type: 'error', content: 'something broke', model: 'test', provider: 'test' };
    }

    const stream = createSSEStream(source());
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    const output = chunks.join('');
    expect(output).toContain('event: error');
    expect(output).toContain('"content":"something broke"');
  });

  it('sends done event after all chunks', async () => {
    async function* source(): AsyncIterable<StreamChunk> {
      yield { type: 'text', content: 'hi', model: 'test', provider: 'test' };
    }

    const stream = createSSEStream(source());
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    const output = chunks.join('');
    // The last event should be the done event
    const lastEventIndex = output.lastIndexOf('event: done');
    const lastChunkIndex = output.lastIndexOf('event: chunk');
    expect(lastEventIndex).toBeGreaterThan(lastChunkIndex);
  });

  it('emits error event when source throws', async () => {
    async function* source(): AsyncIterable<StreamChunk> {
      yield { type: 'text', content: 'before error', model: 'test', provider: 'test' };
      throw new Error('stream failed');
    }

    const stream = createSSEStream(source());
    const reader = stream.getReader();
    const decoder = new TextDecoder();

    const chunks: string[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(decoder.decode(value));
    }

    const output = chunks.join('');
    expect(output).toContain('event: error');
    expect(output).toContain('stream failed');
  });
});

import { describe, it, expect } from 'vitest';
import { chatRequestSchema, chatMessageSchema } from './validation';

describe('chatMessageSchema', () => {
  it('accepts valid message', () => {
    const result = chatMessageSchema.safeParse({
      role: 'user',
      content: 'Hello, world!',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty content', () => {
    const result = chatMessageSchema.safeParse({
      role: 'user',
      content: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects content exceeding 100,000 characters', () => {
    const result = chatMessageSchema.safeParse({
      role: 'user',
      content: 'x'.repeat(100_001),
    });
    expect(result.success).toBe(false);
  });

  it('accepts content at exactly 100,000 characters', () => {
    const result = chatMessageSchema.safeParse({
      role: 'user',
      content: 'x'.repeat(100_000),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid role', () => {
    const result = chatMessageSchema.safeParse({
      role: 'moderator',
      content: 'Hello',
    });
    expect(result.success).toBe(false);
  });
});

describe('chatRequestSchema', () => {
  const validRequest = {
    messages: [{ role: 'user' as const, content: 'Hello' }],
    models: ['gpt-4o'],
  };

  it('parses a valid request with defaults', () => {
    const result = chatRequestSchema.safeParse(validRequest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.temperature).toBe(0.7);
      expect(result.data.maxTokens).toBe(4096);
    }
  });

  it('rejects empty messages array', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 models', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      models: Array.from({ length: 11 }, (_, i) => `model-${i}`),
    });
    expect(result.success).toBe(false);
  });

  it('accepts exactly 10 models', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      models: Array.from({ length: 10 }, (_, i) => `model-${i}`),
    });
    expect(result.success).toBe(true);
  });

  it('rejects temperature below 0', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      temperature: -0.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects temperature above 2', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      temperature: 2.1,
    });
    expect(result.success).toBe(false);
  });

  it('rejects maxTokens exceeding 2,000,000', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      maxTokens: 2_000_001,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty models array', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      models: [],
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional apiKeys', () => {
    const result = chatRequestSchema.safeParse({
      ...validRequest,
      apiKeys: { openai: 'sk-test' },
    });
    expect(result.success).toBe(true);
  });
});

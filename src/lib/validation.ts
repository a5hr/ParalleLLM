import { z } from 'zod';

export const chatMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant']),
  content: z.string().min(1).max(100_000),
});

const modelConfigSchema = z.object({
  id: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(2_000_000).optional(),
  provider: z.string().optional(),
  baseUrl: z.string().url().optional(),
});

export const chatRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(100),
  models: z.array(z.string()).min(1).max(4),
  modelConfigs: z.array(modelConfigSchema).optional(),
  temperature: z.number().min(0).max(2).optional().default(0.7),
  maxTokens: z.number().int().min(1).max(2_000_000).optional().default(4096),
  apiKeys: z.record(z.string(), z.string()).optional(),
});

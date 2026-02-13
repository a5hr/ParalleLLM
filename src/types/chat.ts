import type { StreamChunk } from './provider';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResponse {
  modelId: string;
  provider: string;
  content: string;
  status: 'idle' | 'streaming' | 'done' | 'error';
  error?: string;
  usage?: TokenUsage;
  latencyMs?: number;
  startedAt?: number;
}

export interface ChatRequestBody {
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  models: string[];
  modelConfigs?: Array<{
    id: string;
    temperature?: number;
    maxTokens?: number;
  }>;
  temperature?: number;
  maxTokens?: number;
  apiKeys?: Record<string, string>;
}

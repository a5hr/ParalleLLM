export type ProviderType = 'cloud' | 'local';

export interface LLMProvider {
  name: string;
  type: ProviderType;
  requiresApiKey: boolean;
  baseUrl?: string;
  chatStream(
    request: ChatRequest,
    apiKey: string,
    signal: AbortSignal
  ): AsyncIterable<StreamChunk>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StreamChunk {
  type: 'text' | 'error' | 'done';
  content: string;
  model: string;
  provider: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
  };
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  providerType: ProviderType;
  maxTokens: number;
  isFree: boolean;
  supportedFeatures: string[];
}

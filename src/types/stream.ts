export interface SSEEvent {
  event: 'chunk' | 'error' | 'done';
  data: SSEChunkData | SSEErrorData | Record<string, never>;
}

export interface SSEChunkData {
  model: string;
  provider: string;
  type: 'text' | 'done';
  content: string;
  metadata?: {
    tokensUsed?: number;
    latencyMs?: number;
  };
}

export interface SSEErrorData {
  model: string;
  provider: string;
  type: 'error';
  content: string;
  code?: string;
}

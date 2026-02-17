import OpenAI from 'openai';
import type { LLMProvider, ChatRequest, StreamChunk, ModelInfo } from '@/types/provider';
import { getProviderModelInfos } from '@/lib/models';
import { isRateLimitError } from '@/lib/errors';

export const openaiProvider: LLMProvider = {
  name: 'openai',
  type: 'cloud',
  requiresApiKey: true,

  async *chatStream(request: ChatRequest, apiKey: string, signal: AbortSignal): AsyncIterable<StreamChunk> {
    try {
      const client = new OpenAI({ apiKey });

      const stream = await client.chat.completions.create(
        {
          model: request.model,
          messages: request.messages,
          ...(request.temperature != null ? { temperature: request.temperature } : {}),
          max_completion_tokens: request.maxTokens ?? 4096,
          stream: true,
        },
        { signal }
      );

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield {
            type: 'text',
            content,
            model: request.model,
            provider: 'openai',
          };
        }
      }

      yield { type: 'done', content: '', model: request.model, provider: 'openai' };
    } catch (error) {
      // Let rate-limit errors propagate to multi-stream for key rotation retry
      if (isRateLimitError(error)) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: message, model: request.model, provider: 'openai' };
    }
  },

  async listModels(): Promise<ModelInfo[]> {
    return getProviderModelInfos('openai');
  },
};

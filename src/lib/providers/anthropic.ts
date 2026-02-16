import Anthropic from '@anthropic-ai/sdk';
import type { LLMProvider, ChatRequest, StreamChunk, ModelInfo } from '@/types/provider';
import { getProviderModelInfos } from '@/lib/models';
import { isRateLimitError } from '@/lib/errors';

export const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  type: 'cloud',
  requiresApiKey: true,

  async *chatStream(request: ChatRequest, apiKey: string, signal: AbortSignal): AsyncIterable<StreamChunk> {
    try {
      const client = new Anthropic({ apiKey });

      const systemMessage = request.messages.find(m => m.role === 'system');
      const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

      const stream = await client.messages.create(
        {
          model: request.model,
          system: systemMessage?.content,
          messages: nonSystemMessages.map(m => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          })),
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          stream: true,
        },
        { signal }
      );

      for await (const event of stream) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          yield {
            type: 'text',
            content: event.delta.text,
            model: request.model,
            provider: 'anthropic',
          };
        }
      }

      yield { type: 'done', content: '', model: request.model, provider: 'anthropic' };
    } catch (error) {
      // Let rate-limit errors propagate to multi-stream for key rotation retry
      if (isRateLimitError(error)) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: message, model: request.model, provider: 'anthropic' };
    }
  },

  async listModels(): Promise<ModelInfo[]> {
    return getProviderModelInfos('anthropic');
  },
};

import OpenAI from 'openai';
import type { LLMProvider, ChatRequest, StreamChunk, ModelInfo, ProviderType } from '@/types/provider';
import { isRateLimitError } from '@/lib/errors';

interface OpenAICompatibleConfig {
  name: string;
  type: ProviderType;
  baseUrl: string;
  requiresApiKey: boolean;
  defaultModels: ModelInfo[];
  supportsModelDiscovery: boolean;
  extraHeaders?: Record<string, string>;
}

export function createOpenAICompatibleProvider(config: OpenAICompatibleConfig): LLMProvider {
  return {
    name: config.name,
    type: config.type,
    requiresApiKey: config.requiresApiKey,
    baseUrl: config.baseUrl,

    async *chatStream(request: ChatRequest, apiKey: string, signal: AbortSignal): AsyncIterable<StreamChunk> {
      try {
        const client = new OpenAI({
          apiKey: apiKey || 'not-needed',
          baseURL: config.baseUrl,
          defaultHeaders: config.extraHeaders,
        });

        const stream = await client.chat.completions.create(
          {
            model: request.model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 4096,
            stream: true,
          },
          { signal }
        );

        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          const content = delta?.content;
          // Some reasoning models (e.g. DeepSeek R1) emit thinking tokens
          // in a separate field before the final answer
          const reasoning = (delta as Record<string, unknown>)?.reasoning_content as string | undefined;
          const text = content || reasoning;
          if (text) {
            yield { type: 'text', content: text, model: request.model, provider: config.name };
          }
        }

        yield { type: 'done', content: '', model: request.model, provider: config.name };
      } catch (error) {
        // Let rate-limit errors propagate to multi-stream for key rotation retry
        if (isRateLimitError(error)) throw error;
        const message = error instanceof Error ? error.message : 'Unknown error';
        yield { type: 'error', content: message, model: request.model, provider: config.name };
      }
    },

    async listModels(apiKey?: string): Promise<ModelInfo[]> {
      if (config.supportsModelDiscovery) {
        try {
          const client = new OpenAI({
            apiKey: apiKey || 'not-needed',
            baseURL: config.baseUrl,
          });
          const response = await client.models.list();
          const models: ModelInfo[] = [];
          for await (const m of response) {
            models.push({
              id: m.id,
              name: m.id,
              provider: config.name,
              providerType: config.type,
              maxTokens: 4096,
              isFree: config.type === 'local',
              supportedFeatures: ['streaming'],
            });
          }
          return models;
        } catch {
          return config.defaultModels;
        }
      }
      return config.defaultModels;
    },
  };
}

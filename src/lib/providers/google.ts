import { GoogleGenerativeAI } from '@google/generative-ai';
import type { LLMProvider, ChatRequest, StreamChunk, ModelInfo } from '@/types/provider';
import { getProviderModelInfos } from '@/lib/models';
import { isRateLimitError } from '@/lib/errors';

export const googleProvider: LLMProvider = {
  name: 'google',
  type: 'cloud',
  requiresApiKey: true,

  async *chatStream(request: ChatRequest, apiKey: string, signal: AbortSignal): AsyncIterable<StreamChunk> {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);

      const systemMessage = request.messages.find(m => m.role === 'system');
      const nonSystemMessages = request.messages.filter(m => m.role !== 'system');

      const model = genAI.getGenerativeModel({
        model: request.model,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 4096,
        },
        ...(systemMessage ? { systemInstruction: systemMessage.content } : {}),
      });

      const geminiMessages = nonSystemMessages.map(m => ({
        role: m.role === 'assistant' ? 'model' as const : 'user' as const,
        parts: [{ text: m.content }],
      }));

      // Use the last message as the prompt, rest as history
      const history = geminiMessages.slice(0, -1);
      const lastMessage = geminiMessages[geminiMessages.length - 1];

      const chat = model.startChat({ history });

      const result = await chat.sendMessageStream(
        lastMessage.parts,
        { signal }
      );

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield {
            type: 'text',
            content: text,
            model: request.model,
            provider: 'google',
          };
        }
      }

      yield { type: 'done', content: '', model: request.model, provider: 'google' };
    } catch (error) {
      // Let rate-limit errors propagate to multi-stream for key rotation retry
      if (isRateLimitError(error)) throw error;
      const message = error instanceof Error ? error.message : 'Unknown error';
      yield { type: 'error', content: message, model: request.model, provider: 'google' };
    }
  },

  async listModels(): Promise<ModelInfo[]> {
    return getProviderModelInfos('google');
  },
};

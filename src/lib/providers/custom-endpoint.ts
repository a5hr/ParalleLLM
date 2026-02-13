import { createOpenAICompatibleProvider } from './openai-compatible';
import type { LLMProvider } from '@/types/provider';

export function createCustomEndpointProvider(baseUrl: string, name?: string): LLMProvider {
  return createOpenAICompatibleProvider({
    name: name || 'custom',
    type: 'local',
    baseUrl,
    requiresApiKey: false,
    defaultModels: [],
    supportsModelDiscovery: true,
  });
}

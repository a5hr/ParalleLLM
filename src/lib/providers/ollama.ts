import { createOpenAICompatibleProvider } from './openai-compatible';

export const ollamaProvider = createOpenAICompatibleProvider({
  name: 'ollama',
  type: 'local',
  baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
  requiresApiKey: false,
  defaultModels: [],
  supportsModelDiscovery: true,
});

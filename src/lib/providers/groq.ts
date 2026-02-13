import { createOpenAICompatibleProvider } from './openai-compatible';
import { getProviderModelInfos } from '@/lib/models';

export const groqProvider = createOpenAICompatibleProvider({
  name: 'groq',
  type: 'cloud',
  baseUrl: 'https://api.groq.com/openai/v1',
  requiresApiKey: true,
  defaultModels: getProviderModelInfos('groq'),
  supportsModelDiscovery: false,
});

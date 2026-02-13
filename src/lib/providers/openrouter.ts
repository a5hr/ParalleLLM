import { createOpenAICompatibleProvider } from './openai-compatible';
import { getProviderModelInfos } from '@/lib/models';

export const openrouterProvider = createOpenAICompatibleProvider({
  name: 'openrouter',
  type: 'cloud',
  baseUrl: 'https://openrouter.ai/api/v1',
  requiresApiKey: true,
  defaultModels: getProviderModelInfos('openrouter'),
  supportsModelDiscovery: false,
  extraHeaders: { 'HTTP-Referer': 'https://parallellm.dev' },
});

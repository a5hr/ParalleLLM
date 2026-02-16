import type { LLMProvider } from '@/types/provider';
import { openaiProvider } from './openai';
import { anthropicProvider } from './anthropic';
import { googleProvider } from './google';
import { groqProvider } from './groq';
import { openrouterProvider } from './openrouter';
import { ollamaProvider } from './ollama';
import { createCustomEndpointProvider } from './custom-endpoint';
import { validateLocalBaseUrl } from '@/lib/url-validation';
import modelsData from '../../../data/models.json';

const defaultCustomProvider = createCustomEndpointProvider(
  process.env.CUSTOM_LLM_BASE_URL || 'http://localhost:8080/v1'
);

export const providerRegistry = new Map<string, LLMProvider>([
  ['openai', openaiProvider],
  ['anthropic', anthropicProvider],
  ['google', googleProvider],
  ['groq', groqProvider],
  ['openrouter', openrouterProvider],
  ['ollama', ollamaProvider],
  ['custom', defaultCustomProvider],
]);

export function getProvider(name: string): LLMProvider {
  const provider = providerRegistry.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: ${name}`);
  }
  return provider;
}

const modelProviderMap: Record<string, string> = Object.fromEntries(
  modelsData.map(m => [m.id, m.provider])
);

/** Map discontinued model IDs to their replacement */
const modelAliases: Record<string, string> = {
  'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-r1-0528:free',
  'deepseek/deepseek-r1-zero:free': 'deepseek/deepseek-r1-0528:free',
};

/** Resolve model alias — returns the canonical model ID */
export function resolveModelId(modelId: string): string {
  return modelAliases[modelId] ?? modelId;
}

export function getProviderForModel(
  modelId: string,
  options?: { provider?: string; baseUrl?: string }
): LLMProvider {
  // Local model with explicit baseUrl — create a dynamic provider
  if (options?.baseUrl) {
    const urlCheck = validateLocalBaseUrl(options.baseUrl);
    if (!urlCheck.valid) {
      throw new Error(`Blocked baseUrl: ${urlCheck.reason}`);
    }
    return createCustomEndpointProvider(options.baseUrl, options.provider || 'local');
  }

  // Resolve aliases for discontinued models
  const resolved = resolveModelId(modelId);

  if (resolved.startsWith('ollama/')) {
    return getProvider('ollama');
  }
  if (resolved.startsWith('custom/')) {
    return getProvider('custom');
  }

  const providerName = modelProviderMap[resolved];
  if (!providerName) {
    throw new Error(`Unknown model: ${resolved}`);
  }
  return getProvider(providerName);
}

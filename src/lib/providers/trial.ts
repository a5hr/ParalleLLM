import { createOpenAICompatibleProvider } from './openai-compatible';
import type { LLMProvider } from '@/types/provider';
import { defaultModels } from '@/lib/models';

// Create a provider specifically for the "trial" environment
export function createTrialProvider(): LLMProvider {
    const customApiKey = process.env.TRIAL_LLM_API_KEY;
    const trialModels = defaultModels.filter(m => m.provider === 'trial').map(m => ({
        id: m.id,
        name: m.name,
        provider: 'trial',
        providerType: 'cloud' as const,
        maxTokens: m.maxTokens,
        isFree: true,
        supportedFeatures: ['streaming']
    }));

    return createOpenAICompatibleProvider({
        name: 'trial',
        type: 'cloud',
        baseUrl: process.env.TRIAL_LLM_BASE_URL || 'http://localhost:11434/v1',
        requiresApiKey: false,
        defaultModels: trialModels,
        supportsModelDiscovery: false,
        extraHeaders: customApiKey ? { Authorization: `Bearer ${customApiKey}` } : undefined,
    });
}

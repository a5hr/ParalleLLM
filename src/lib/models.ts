import type { ModelInfo, ProviderType } from '@/types/provider';
import modelsData from '../../data/models.json';

export interface ModelDefinition {
  id: string;
  name: string;
  provider: string;
  providerType: 'cloud' | 'local';
  isFree: boolean;
  maxTokens: number;
  maxOutput: number;
  supportsTemperature: boolean;
  pricing: {
    input: number;  // $ per 1M input tokens
    output: number; // $ per 1M output tokens
  } | null; // null = free
}

export const defaultModels: ModelDefinition[] = modelsData.map(m => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  providerType: m.providerType as 'cloud' | 'local',
  isFree: m.isFree,
  maxTokens: m.maxTokens,
  maxOutput: m.maxOutput,
  supportsTemperature: (m as Record<string, unknown>).supportsTemperature !== false,
  pricing: m.pricing,
}));

export function getProviderModelInfos(provider: string): ModelInfo[] {
  return modelsData
    .filter(m => m.provider === provider)
    .map(m => ({
      id: m.id,
      name: m.name,
      provider: m.provider,
      providerType: m.providerType as ProviderType,
      maxTokens: m.maxTokens,
      isFree: m.isFree,
      supportedFeatures: m.supportedFeatures,
    }));
}

export const providerNames: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  groq: 'Groq',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  lmstudio: 'LM Studio',
  custom: 'Custom',
  trial: 'Open Weights',
};

export const providerColors: Record<string, { accent: string; hex: string }> = {
  trial: { accent: 'rose', hex: '#e11d48' }, // Noticeable color for trial
  openai: { accent: 'emerald', hex: '#10a37f' },
  anthropic: { accent: 'orange', hex: '#d97706' },
  google: { accent: 'blue', hex: '#4285f4' },
  groq: { accent: 'cyan', hex: '#06b6d4' },
  openrouter: { accent: 'violet', hex: '#7c3aed' },
  ollama: { accent: 'slate', hex: '#64748b' },
  custom: { accent: 'purple', hex: '#8b5cf6' },
};

export const providerTypeBadge = {
  cloud: null,
  local: { label: 'LOCAL', className: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200' },
} as const;

/** Format token count for display (e.g. 200000 -> "200K", 1048576 -> "1M") */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(tokens % 1_000_000 === 0 ? 0 : 1)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1_000)}K`;
  return String(tokens);
}

/** Format price for display (e.g. 1.75 -> "$1.75", 0.15 -> "$0.15") */
export function formatPrice(price: number): string {
  if (price >= 1) return `$${price.toFixed(price % 1 === 0 ? 0 : 2)}`;
  return `$${price.toFixed(2)}`;
}

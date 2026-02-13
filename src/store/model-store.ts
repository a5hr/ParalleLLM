import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultModels } from '@/lib/models';

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  providerType: 'cloud' | 'local';
  enabled: boolean;
  isFree: boolean;
  maxOutput: number;
  pricing: { input: number; output: number } | null;
  baseUrl?: string;
  parameters: {
    temperature: number;
    maxTokens: number;
  };
}

interface LocalLLMEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  status: 'connected' | 'disconnected' | 'checking';
  models: string[];
}

interface ModelState {
  models: ModelConfig[];
  selectedModelIds: string[];
  localEndpoints: LocalLLMEndpoint[];

  toggleModel: (modelId: string) => void;
  updateModelConfig: (modelId: string, config: Partial<ModelConfig>) => void;
  setSelectedModels: (ids: string[]) => void;
  addLocalEndpoint: (endpoint: Omit<LocalLLMEndpoint, 'status' | 'models'>) => void;
  removeLocalEndpoint: (id: string) => void;
  updateLocalEndpointStatus: (id: string, status: LocalLLMEndpoint['status'], models?: string[]) => void;
  addLocalModels: (provider: string, modelIds: string[], baseUrl: string) => void;
  removeLocalModels: (provider: string) => void;
}

const initialModels: ModelConfig[] = defaultModels.map((m) => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  providerType: m.providerType,
  enabled: true,
  isFree: m.isFree,
  maxOutput: m.maxOutput,
  pricing: m.pricing,
  parameters: {
    temperature: 0.7,
    maxTokens: m.maxTokens,
  },
}));

export const useModelStore = create<ModelState>()(
  persist(
    (set) => ({
      models: initialModels,
      selectedModelIds: [],
      localEndpoints: [],

      toggleModel: (modelId) =>
        set((state) => {
          const isSelected = state.selectedModelIds.includes(modelId);
          return {
            selectedModelIds: isSelected
              ? state.selectedModelIds.filter((id) => id !== modelId)
              : [...state.selectedModelIds, modelId],
          };
        }),

      updateModelConfig: (modelId, config) =>
        set((state) => ({
          models: state.models.map((m) =>
            m.id === modelId ? { ...m, ...config } : m
          ),
        })),

      setSelectedModels: (ids) => set({ selectedModelIds: ids }),

      addLocalEndpoint: (endpoint) =>
        set((state) => ({
          localEndpoints: [
            ...state.localEndpoints,
            { ...endpoint, status: 'disconnected' as const, models: [] },
          ],
        })),

      removeLocalEndpoint: (id) =>
        set((state) => ({
          localEndpoints: state.localEndpoints.filter((e) => e.id !== id),
        })),

      updateLocalEndpointStatus: (id, status, models) =>
        set((state) => ({
          localEndpoints: state.localEndpoints.map((e) =>
            e.id === id ? { ...e, status, models: models ?? e.models } : e
          ),
        })),

      addLocalModels: (provider, modelIds, baseUrl) =>
        set((state) => {
          const existing = new Set(state.models.map((m) => m.id));
          const newModels: ModelConfig[] = modelIds
            .filter((id) => !existing.has(`${provider}/${id}`))
            .map((id) => ({
              id: `${provider}/${id}`,
              name: id,
              provider,
              providerType: 'local' as const,
              enabled: true,
              isFree: true,
              maxOutput: 4096,
              pricing: null,
              baseUrl,
              parameters: { temperature: 0.7, maxTokens: 4096 },
            }));
          return { models: [...state.models, ...newModels] };
        }),

      removeLocalModels: (provider) =>
        set((state) => ({
          models: state.models.filter((m) => m.provider !== provider),
          selectedModelIds: state.selectedModelIds.filter(
            (id) => !id.startsWith(`${provider}/`)
          ),
        })),
    }),
    {
      name: 'parallellm-models',
      version: 3,
      partialize: (state) => ({
        models: state.models,
        selectedModelIds: state.selectedModelIds,
        localEndpoints: state.localEndpoints,
      }),
      migrate: (persisted, version) => {
        const state = persisted as Record<string, unknown>;
        const defaultMap = new Map(defaultModels.map((m) => [m.id, m]));
        let models = state.models as ModelConfig[] | undefined;

        if (version < 2 && models) {
          // Backfill maxOutput and pricing from defaultModels
          models = models.map((m) => {
            const def = defaultMap.get(m.id);
            return {
              ...m,
              maxOutput: m.maxOutput ?? def?.maxOutput ?? 4096,
              pricing: m.pricing !== undefined ? m.pricing : (def?.pricing ?? null),
            };
          });
        }

        if (version < 3 && models) {
          // Migrate providerType: 'free' -> 'cloud'
          models = models.map((m) => ({
            ...m,
            providerType: (m.providerType === ('free' as string) ? 'cloud' : m.providerType) as ModelConfig['providerType'],
          }));
        }

        return { ...state, models };
      },
    }
  )
);

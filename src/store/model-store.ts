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
  contextWindow: number;
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

export const MAX_SELECTED_MODELS = 10;

const initialModels: ModelConfig[] = defaultModels.map((m) => ({
  id: m.id,
  name: m.name,
  provider: m.provider,
  providerType: m.providerType,
  enabled: true,
  isFree: m.isFree,
  contextWindow: m.maxTokens,
  maxOutput: m.maxOutput,
  pricing: m.pricing,
  parameters: {
    temperature: 0.7,
    maxTokens: m.maxOutput,
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
          if (!isSelected && state.selectedModelIds.length >= MAX_SELECTED_MODELS) {
            return state; // At limit — ignore
          }
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
              contextWindow: 4096,
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
      version: 7,
      partialize: (state) => ({
        models: state.models,
        selectedModelIds: state.selectedModelIds,
        localEndpoints: state.localEndpoints,
      }),
      migrate: migrateModelState,
    }
  )
);

/** Exported for testing — zustand persist calls this on hydration */
export function migrateModelState(persisted: unknown, version: number): Record<string, unknown> {
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

  if (version < 4 && models) {
    // Cap parameters.maxTokens to maxOutput (was incorrectly using context window)
    models = models.map((m) => {
      const def = defaultMap.get(m.id);
      const maxOutput = m.maxOutput ?? def?.maxOutput ?? 4096;
      return {
        ...m,
        parameters: {
          ...m.parameters,
          maxTokens: Math.min(m.parameters.maxTokens, maxOutput),
        },
      };
    });
  }

  if (version < 5) {
    // Replace removed OpenRouter models and fix maxOutput values
    const modelReplacements: Record<string, string> = {
      'deepseek/deepseek-chat-v3-0324:free': 'deepseek/deepseek-r1-0528:free',
      'deepseek/deepseek-r1-zero:free': 'deepseek/deepseek-r1-0528:free',
    };

    let selectedIds = state.selectedModelIds as string[] | undefined;
    if (selectedIds) {
      selectedIds = selectedIds.filter((id) => !modelReplacements[id]);
      state.selectedModelIds = selectedIds;
    }

    if (models) {
      // Remove old models that no longer exist, add replacements from defaults
      const removedIds = new Set(Object.keys(modelReplacements));
      models = models.filter((m) => !removedIds.has(m.id));
      // Sync maxOutput from defaults for all models
      models = models.map((m) => {
        const def = defaultMap.get(m.id);
        if (!def) return m;
        return {
          ...m,
          maxOutput: def.maxOutput,
          parameters: {
            ...m.parameters,
            maxTokens: Math.min(m.parameters.maxTokens, def.maxOutput),
          },
        };
      });
      // Add new default models not yet in the list
      const existingIds = new Set(models.map((m) => m.id));
      for (const def of defaultModels) {
        if (!existingIds.has(def.id)) {
          models.push({
            id: def.id,
            name: def.name,
            provider: def.provider,
            providerType: def.providerType,
            enabled: true,
            isFree: def.isFree,
            contextWindow: def.maxTokens,
            maxOutput: def.maxOutput,
            pricing: def.pricing,
            parameters: { temperature: 0.7, maxTokens: def.maxOutput },
          });
        }
      }
    }
  }

  if (version < 6) {
    // Re-run model cleanup for users who were already at v5 before
    // deepseek-chat-v3-0324:free and deepseek-r1-zero:free were removed
    const staleModelIds = new Set([
      'deepseek/deepseek-chat-v3-0324:free',
      'deepseek/deepseek-r1-zero:free',
    ]);

    let selectedIds = state.selectedModelIds as string[] | undefined;
    if (selectedIds) {
      selectedIds = selectedIds.filter((id) => !staleModelIds.has(id));
      state.selectedModelIds = selectedIds;
    }

    if (models) {
      models = models.filter((m) => !staleModelIds.has(m.id));
      // Sync maxOutput and cap maxTokens from defaults
      models = models.map((m) => {
        const def = defaultMap.get(m.id);
        if (!def) return m;
        return {
          ...m,
          maxOutput: def.maxOutput,
          parameters: {
            ...m.parameters,
            maxTokens: Math.min(m.parameters.maxTokens, def.maxOutput),
          },
        };
      });
      // Add any missing default models
      const existingIds = new Set(models.map((m) => m.id));
      for (const def of defaultModels) {
        if (!existingIds.has(def.id)) {
          models.push({
            id: def.id,
            name: def.name,
            provider: def.provider,
            providerType: def.providerType,
            enabled: true,
            isFree: def.isFree,
            contextWindow: def.maxTokens,
            maxOutput: def.maxOutput,
            pricing: def.pricing,
            parameters: { temperature: 0.7, maxTokens: def.maxOutput },
          });
        }
      }
    }
  }

  if (version < 7) {
    // Add contextWindow property to all models
    if (models) {
      models = models.map((m) => {
        const def = defaultMap.get(m.id);
        const existing = (m as unknown as Record<string, unknown>).contextWindow as number | undefined;
        return {
          ...m,
          contextWindow: existing ?? def?.maxTokens ?? 4096,
        };
      });
    }
  }

  return { ...state, models };
}

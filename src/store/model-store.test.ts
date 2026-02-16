import { describe, it, expect } from 'vitest';
import { migrateModelState } from './model-store';
import { defaultModels } from '@/lib/models';

interface MigratedState {
  models: Array<{
    id: string;
    maxOutput: number;
    parameters: { maxTokens: number };
  }>;
  selectedModelIds: string[];
}

/** Helper to create a minimal persisted model config */
function makeModel(overrides: {
  id: string;
  provider?: string;
  maxOutput?: number;
  maxTokens?: number;
}) {
  return {
    id: overrides.id,
    name: overrides.id,
    provider: overrides.provider ?? 'openrouter',
    providerType: 'cloud' as const,
    enabled: true,
    isFree: true,
    maxOutput: overrides.maxOutput ?? 32768,
    pricing: null,
    parameters: {
      temperature: 0.7,
      maxTokens: overrides.maxTokens ?? overrides.maxOutput ?? 32768,
    },
  };
}

describe('migrateModelState', () => {
  describe('v5 → v6: stale model removal', () => {
    it('removes deepseek/deepseek-chat-v3-0324:free from models', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free', maxOutput: 163840, maxTokens: 163840 }),
          makeModel({ id: 'meta-llama/llama-3.3-70b-instruct:free' }),
        ],
        selectedModelIds: [
          'deepseek/deepseek-chat-v3-0324:free',
          'meta-llama/llama-3.3-70b-instruct:free',
        ],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const models = result.models;
      const selectedIds = result.selectedModelIds;

      // Stale model should be removed from models array
      expect(models.find(m => m.id === 'deepseek/deepseek-chat-v3-0324:free')).toBeUndefined();

      // Stale model should be replaced in selectedModelIds
      expect(selectedIds).not.toContain('deepseek/deepseek-chat-v3-0324:free');
      expect(selectedIds).toContain('deepseek/deepseek-r1-0528:free');

      // Other model should remain
      expect(models.find(m => m.id === 'meta-llama/llama-3.3-70b-instruct:free')).toBeDefined();
      expect(selectedIds).toContain('meta-llama/llama-3.3-70b-instruct:free');
    });

    it('removes deepseek/deepseek-r1-zero:free from models', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-r1-zero:free', maxOutput: 163840, maxTokens: 163840 }),
        ],
        selectedModelIds: ['deepseek/deepseek-r1-zero:free'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const models = result.models;
      const selectedIds = result.selectedModelIds;

      expect(models.find(m => m.id === 'deepseek/deepseek-r1-zero:free')).toBeUndefined();
      expect(selectedIds).not.toContain('deepseek/deepseek-r1-zero:free');
      expect(selectedIds).toContain('deepseek/deepseek-r1-0528:free');
    });

    it('deduplicates selectedModelIds when replacement already exists', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free' }),
          makeModel({ id: 'deepseek/deepseek-r1-0528:free' }),
        ],
        selectedModelIds: [
          'deepseek/deepseek-chat-v3-0324:free',
          'deepseek/deepseek-r1-0528:free',
        ],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const selectedIds = result.selectedModelIds;

      // Should not have duplicate deepseek-r1-0528:free
      const r1Count = selectedIds.filter(id => id === 'deepseek/deepseek-r1-0528:free').length;
      expect(r1Count).toBe(1);
    });

    it('adds deepseek-r1-0528:free to models if missing after removal', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free' }),
        ],
        selectedModelIds: ['deepseek/deepseek-chat-v3-0324:free'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const models = result.models;

      // The replacement model should be added from defaults
      expect(models.find(m => m.id === 'deepseek/deepseek-r1-0528:free')).toBeDefined();
    });

    it('caps maxTokens to maxOutput from defaults during v6 migration', () => {
      const persisted = {
        models: [
          // Model with inflated maxTokens (should be capped to 32768)
          makeModel({
            id: 'meta-llama/llama-3.3-70b-instruct:free',
            maxOutput: 65536,
            maxTokens: 65536,
          }),
        ],
        selectedModelIds: [],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const models = result.models;

      const llama = models.find(m => m.id === 'meta-llama/llama-3.3-70b-instruct:free');
      expect(llama).toBeDefined();
      // maxOutput should be synced from defaults (32768)
      expect(llama!.maxOutput).toBe(32768);
      // maxTokens should be capped to maxOutput
      expect(llama!.parameters.maxTokens).toBe(32768);
    });
  });

  describe('v4 → v6: full migration chain', () => {
    it('runs both v5 and v6 migrations for user at v4', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free', maxOutput: 163840, maxTokens: 163840 }),
        ],
        selectedModelIds: ['deepseek/deepseek-chat-v3-0324:free'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 4) as unknown as MigratedState;
      const models = result.models;
      const selectedIds = result.selectedModelIds;

      expect(models.find(m => m.id === 'deepseek/deepseek-chat-v3-0324:free')).toBeUndefined();
      expect(selectedIds).not.toContain('deepseek/deepseek-chat-v3-0324:free');
      expect(selectedIds).toContain('deepseek/deepseek-r1-0528:free');
    });
  });

  describe('current version: no migration needed', () => {
    it('returns state unchanged for version 6', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-r1-0528:free' }),
        ],
        selectedModelIds: ['deepseek/deepseek-r1-0528:free'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 6) as unknown as MigratedState;
      const models = result.models;

      expect(models.length).toBe(1);
      expect(models[0].id).toBe('deepseek/deepseek-r1-0528:free');
    });
  });

  describe('defaultModels sync', () => {
    it('all default models exist after migrating from v5', () => {
      // Simulate a user with only a few old models
      const persisted = {
        models: [
          makeModel({ id: 'meta-llama/llama-3.3-70b-instruct:free' }),
        ],
        selectedModelIds: [],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const models = result.models;
      const modelIds = new Set(models.map(m => m.id));

      // Every default model should be present
      for (const def of defaultModels) {
        expect(modelIds.has(def.id)).toBe(true);
      }
    });
  });
});

import { describe, it, expect } from 'vitest';
import { migrateModelState } from './model-store';
import { defaultModels } from '@/lib/models';

interface MigratedState {
  models: Array<{
    id: string;
    providerType: 'cloud' | 'local';
    maxOutput: number;
    parameters: { maxTokens: number };
  }>;
  selectedModelIds: string[];
}

/** Helper to create a minimal persisted model config */
function makeModel(overrides: {
  id: string;
  provider?: string;
  providerType?: 'cloud' | 'local';
  maxOutput?: number;
  maxTokens?: number;
}) {
  return {
    id: overrides.id,
    name: overrides.id,
    provider: overrides.provider ?? 'openrouter',
    providerType: overrides.providerType ?? ('cloud' as const),
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

const defaultIds = defaultModels.map((m) => m.id);
const defaultMaxOutput = (id: string) => {
  const model = defaultModels.find((m) => m.id === id);
  if (!model) throw new Error(`Not a default model: ${id}`);
  return model.maxOutput;
};

// A default cloud model that is not a Groq/OpenRouter free one, so it stays across lineup changes
const KEPT_ID = 'openai/gpt-oss-120b';

describe('migrateModelState', () => {
  describe('v5 → v6: stale model removal', () => {
    it('removes discontinued deepseek models from selectedModelIds', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free', maxOutput: 163840, maxTokens: 163840 }),
          makeModel({ id: 'deepseek/deepseek-r1-zero:free', maxOutput: 163840, maxTokens: 163840 }),
          makeModel({ id: KEPT_ID, provider: 'groq' }),
        ],
        selectedModelIds: [
          'deepseek/deepseek-chat-v3-0324:free',
          'deepseek/deepseek-r1-zero:free',
          KEPT_ID,
        ],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;

      expect(result.selectedModelIds).toEqual([KEPT_ID]);
      expect(result.models.find((m) => m.id.startsWith('deepseek/'))).toBeUndefined();
    });

    it('caps maxTokens to maxOutput from defaults during v6 migration', () => {
      const persisted = {
        models: [
          // Model with inflated maxTokens (should be capped to the default maxOutput)
          makeModel({ id: KEPT_ID, provider: 'groq', maxOutput: 200000, maxTokens: 200000 }),
        ],
        selectedModelIds: [],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const model = result.models.find((m) => m.id === KEPT_ID);

      expect(model).toBeDefined();
      // maxOutput should be synced from defaults
      expect(model!.maxOutput).toBe(defaultMaxOutput(KEPT_ID));
      // maxTokens should be capped to maxOutput
      expect(model!.parameters.maxTokens).toBe(defaultMaxOutput(KEPT_ID));
    });
  });

  describe('v4 → v8: full migration chain', () => {
    it('runs all migrations for a user at v4', () => {
      const persisted = {
        models: [
          makeModel({ id: 'deepseek/deepseek-chat-v3-0324:free', maxOutput: 163840, maxTokens: 163840 }),
        ],
        selectedModelIds: ['deepseek/deepseek-chat-v3-0324:free'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 4) as unknown as MigratedState;

      expect(result.models.find((m) => m.id === 'deepseek/deepseek-chat-v3-0324:free')).toBeUndefined();
      expect(result.selectedModelIds).toEqual([]);
      expect(new Set(result.models.map((m) => m.id))).toEqual(new Set(defaultIds));
    });
  });

  describe('v7 → v8: lineup replacement', () => {
    it('removes cloud models that are no longer defaults', () => {
      const persisted = {
        models: [
          makeModel({ id: 'gpt-5.2', provider: 'openai' }),
          makeModel({ id: 'claude-opus-4-6', provider: 'anthropic' }),
          makeModel({ id: KEPT_ID, provider: 'groq' }),
        ],
        selectedModelIds: ['gpt-5.2', 'claude-opus-4-6', KEPT_ID],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 7) as unknown as MigratedState;
      const ids = result.models.map((m) => m.id);

      expect(ids).not.toContain('gpt-5.2');
      expect(ids).not.toContain('claude-opus-4-6');
      expect(result.selectedModelIds).toEqual([KEPT_ID]);
    });

    it('keeps local models and their selection', () => {
      const persisted = {
        models: [
          makeModel({ id: 'ollama/llama3', provider: 'ollama', providerType: 'local' }),
          makeModel({ id: 'gpt-5.2', provider: 'openai' }),
        ],
        selectedModelIds: ['ollama/llama3', 'gpt-5.2'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 7) as unknown as MigratedState;

      expect(result.models.find((m) => m.id === 'ollama/llama3')).toBeDefined();
      expect(result.selectedModelIds).toEqual(['ollama/llama3']);
    });

    it('adds all new default models', () => {
      const persisted = {
        models: [makeModel({ id: 'gpt-5.2', provider: 'openai' })],
        selectedModelIds: [],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 7) as unknown as MigratedState;
      const ids = new Set(result.models.map((m) => m.id));

      for (const id of defaultIds) {
        expect(ids.has(id), `${id} should be added`).toBe(true);
      }
    });
  });

  describe('current version: no migration needed', () => {
    it('returns state unchanged for version 8', () => {
      const persisted = {
        models: [makeModel({ id: 'some-old-model' })],
        selectedModelIds: ['some-old-model'],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 8) as unknown as MigratedState;

      expect(result.models.length).toBe(1);
      expect(result.models[0].id).toBe('some-old-model');
      expect(result.selectedModelIds).toEqual(['some-old-model']);
    });
  });

  describe('defaultModels sync', () => {
    it('all default models exist after migrating from v5', () => {
      // Simulate a user with only a few old models
      const persisted = {
        models: [makeModel({ id: 'meta-llama/llama-3.3-70b-instruct:free' })],
        selectedModelIds: [],
        localEndpoints: [],
      };

      const result = migrateModelState(persisted, 5) as unknown as MigratedState;
      const modelIds = new Set(result.models.map((m) => m.id));

      // Every default model should be present
      for (const def of defaultModels) {
        expect(modelIds.has(def.id)).toBe(true);
      }
    });
  });
});

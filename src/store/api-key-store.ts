import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ApiKeyState {
  keys: Record<string, string>; // provider -> api key
  setKey: (provider: string, key: string) => void;
  removeKey: (provider: string) => void;
  getKey: (provider: string) => string | undefined;
}

export const useApiKeyStore = create<ApiKeyState>()(
  persist(
    (set, get) => ({
      keys: {},

      setKey: (provider, key) =>
        set((state) => ({
          keys: { ...state.keys, [provider]: key },
        })),

      removeKey: (provider) =>
        set((state) => {
          const { [provider]: _discarded, ...rest } = state.keys;
          void _discarded;
          return { keys: rest };
        }),

      getKey: (provider) => get().keys[provider] || undefined,
    }),
    {
      name: 'parallellm-api-keys',
    }
  )
);

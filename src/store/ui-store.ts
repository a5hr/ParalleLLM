import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  viewMode: 'parallel' | 'diff' | 'focus';
  focusedModelId: string | null;
  theme: 'light' | 'dark' | 'system';

  setViewMode: (mode: UIState['viewMode']) => void;
  setFocusedModel: (modelId: string | null) => void;
  setTheme: (theme: UIState['theme']) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      viewMode: 'parallel',
      focusedModelId: null,
      theme: 'system',

      setViewMode: (viewMode) => set({ viewMode }),
      setFocusedModel: (focusedModelId) => set({ focusedModelId }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'parallellm-ui',
      partialize: (state) => ({ theme: state.theme }),
    }
  )
);

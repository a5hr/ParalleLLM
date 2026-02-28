import { create } from 'zustand';
import type { ModelResponse, TokenUsage } from '@/types/chat';

interface ChatState {
  prompt: string;
  systemPrompt: string;
  responses: Record<string, ModelResponse>;
  isStreaming: boolean;
  abortController: AbortController | null;

  setPrompt: (prompt: string) => void;
  setSystemPrompt: (systemPrompt: string) => void;
  startStream: (modelIds: string[]) => void;
  updateResponse: (modelId: string, update: Partial<ModelResponse>) => void;
  appendContent: (modelId: string, content: string) => void;
  appendReasoning: (modelId: string, content: string) => void;
  completeResponse: (modelId: string, usage?: TokenUsage, latencyMs?: number) => void;
  setError: (modelId: string, error: string) => void;
  cancelStream: () => void;
  clearResponses: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  prompt: '',
  systemPrompt: '',
  responses: {},
  isStreaming: false,
  abortController: null,

  setPrompt: (prompt) => set({ prompt }),
  setSystemPrompt: (systemPrompt) => set({ systemPrompt }),

  startStream: (modelIds) => {
    const abortController = new AbortController();
    const responses: Record<string, ModelResponse> = {};
    for (const id of modelIds) {
      responses[id] = {
        modelId: id,
        provider: '',
        content: '',
        reasoning: '',
        status: 'streaming',
        startedAt: Date.now(),
      };
    }
    set({ responses, isStreaming: true, abortController });
  },

  updateResponse: (modelId, update) =>
    set((state) => ({
      responses: {
        ...state.responses,
        [modelId]: { ...state.responses[modelId], ...update },
      },
    })),

  appendContent: (modelId, content) =>
    set((state) => {
      const existing = state.responses[modelId];
      if (!existing) return state;
      return {
        responses: {
          ...state.responses,
          [modelId]: { ...existing, content: existing.content + content },
        },
      };
    }),

  appendReasoning: (modelId, content) =>
    set((state) => {
      const existing = state.responses[modelId];
      if (!existing) return state;
      return {
        responses: {
          ...state.responses,
          [modelId]: { ...existing, reasoning: (existing.reasoning ?? '') + content },
        },
      };
    }),

  completeResponse: (modelId, usage, latencyMs) =>
    set((state) => {
      const existing = state.responses[modelId];
      if (!existing) return state;
      const updated = {
        ...state.responses,
        [modelId]: { ...existing, status: 'done' as const, usage, latencyMs },
      };
      const allDone = Object.values(updated).every(
        (r) => r.status === 'done' || r.status === 'error'
      );
      return {
        responses: updated,
        isStreaming: !allDone,
        abortController: allDone ? null : state.abortController,
      };
    }),

  setError: (modelId, error) =>
    set((state) => {
      const existing = state.responses[modelId];
      if (!existing) return state;
      const updated = {
        ...state.responses,
        [modelId]: { ...existing, status: 'error' as const, error },
      };
      const allDone = Object.values(updated).every(
        (r) => r.status === 'done' || r.status === 'error'
      );
      return {
        responses: updated,
        isStreaming: !allDone,
        abortController: allDone ? null : state.abortController,
      };
    }),

  cancelStream: () => {
    const { abortController } = get();
    abortController?.abort();
    set((state) => {
      const responses = { ...state.responses };
      for (const [id, resp] of Object.entries(responses)) {
        if (resp.status === 'streaming') {
          responses[id] = { ...resp, status: 'error', error: 'Cancelled' };
        }
      }
      return { responses, isStreaming: false, abortController: null };
    });
  },

  clearResponses: () => {
    const { abortController } = get();
    abortController?.abort();
    set({ responses: {}, isStreaming: false, abortController: null, prompt: '' });
  },
}));

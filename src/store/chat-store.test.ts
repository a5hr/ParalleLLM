import { describe, it, expect, beforeEach } from 'vitest';
import { useChatStore } from './chat-store';

describe('chat-store', () => {
  beforeEach(() => {
    // Reset store to initial state
    useChatStore.setState({
      prompt: '',
      systemPrompt: '',
      responses: {},
      isStreaming: false,
      abortController: null,
    });
  });

  describe('startStream', () => {
    it('sets all models to streaming status', () => {
      useChatStore.getState().startStream(['model-a', 'model-b']);

      const state = useChatStore.getState();
      expect(state.isStreaming).toBe(true);
      expect(state.responses['model-a'].status).toBe('streaming');
      expect(state.responses['model-b'].status).toBe('streaming');
      expect(state.abortController).not.toBeNull();
    });

    it('initializes empty content for all models', () => {
      useChatStore.getState().startStream(['model-a']);

      const resp = useChatStore.getState().responses['model-a'];
      expect(resp.content).toBe('');
      expect(resp.modelId).toBe('model-a');
    });
  });

  describe('appendContent', () => {
    it('accumulates content for a model', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().appendContent('model-a', 'Hello');
      useChatStore.getState().appendContent('model-a', ' World');

      expect(useChatStore.getState().responses['model-a'].content).toBe('Hello World');
    });

    it('does nothing for non-existent model', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().appendContent('model-z', 'text');

      expect(useChatStore.getState().responses['model-z']).toBeUndefined();
    });
  });

  describe('completeResponse', () => {
    it('sets status to done', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().completeResponse('model-a');

      expect(useChatStore.getState().responses['model-a'].status).toBe('done');
    });

    it('sets isStreaming to false when all models complete', () => {
      useChatStore.getState().startStream(['model-a', 'model-b']);
      useChatStore.getState().completeResponse('model-a');

      // Still streaming because model-b is not done
      expect(useChatStore.getState().isStreaming).toBe(true);

      useChatStore.getState().completeResponse('model-b');
      expect(useChatStore.getState().isStreaming).toBe(false);
    });

    it('sets isStreaming to false when mix of done and error', () => {
      useChatStore.getState().startStream(['model-a', 'model-b']);
      useChatStore.getState().setError('model-a', 'failed');
      useChatStore.getState().completeResponse('model-b');

      expect(useChatStore.getState().isStreaming).toBe(false);
      expect(useChatStore.getState().abortController).toBeNull();
    });
  });

  describe('setError', () => {
    it('sets status to error with message', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().setError('model-a', 'Network timeout');

      const resp = useChatStore.getState().responses['model-a'];
      expect(resp.status).toBe('error');
      expect(resp.error).toBe('Network timeout');
    });
  });

  describe('cancelStream', () => {
    it('sets streaming models to error with Cancelled message', () => {
      useChatStore.getState().startStream(['model-a', 'model-b']);
      useChatStore.getState().completeResponse('model-a'); // model-a is done

      useChatStore.getState().cancelStream();

      const state = useChatStore.getState();
      // model-a was already done, should stay done
      expect(state.responses['model-a'].status).toBe('done');
      // model-b was still streaming, should be error
      expect(state.responses['model-b'].status).toBe('error');
      expect(state.responses['model-b'].error).toBe('Cancelled');
      expect(state.isStreaming).toBe(false);
      expect(state.abortController).toBeNull();
    });
  });

  describe('appendReasoning', () => {
    it('accumulates reasoning for a model', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().appendReasoning('model-a', 'Let me think');
      useChatStore.getState().appendReasoning('model-a', ' about this');

      expect(useChatStore.getState().responses['model-a'].reasoning).toBe('Let me think about this');
    });

    it('does nothing for non-existent model', () => {
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().appendReasoning('model-z', 'text');

      expect(useChatStore.getState().responses['model-z']).toBeUndefined();
    });
  });

  describe('startStream reasoning initialization', () => {
    it('initializes empty reasoning for all models', () => {
      useChatStore.getState().startStream(['model-a']);

      const resp = useChatStore.getState().responses['model-a'];
      expect(resp.reasoning).toBe('');
    });
  });

  describe('clearResponses', () => {
    it('resets all state', () => {
      useChatStore.getState().setPrompt('test prompt');
      useChatStore.getState().startStream(['model-a']);
      useChatStore.getState().appendContent('model-a', 'content');

      useChatStore.getState().clearResponses();

      const state = useChatStore.getState();
      expect(state.responses).toEqual({});
      expect(state.isStreaming).toBe(false);
      expect(state.abortController).toBeNull();
      expect(state.prompt).toBe('');
    });
  });
});

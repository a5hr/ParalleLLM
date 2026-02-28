'use client';

import { useRef, useCallback } from 'react';
import { Send, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useChatStore } from '@/store/chat-store';
import { useModelStore } from '@/store/model-store';
import { useApiKeyStore } from '@/store/api-key-store';
import { useStreamChat } from '@/hooks/use-stream-chat';
import { SystemPromptEditor } from './system-prompt-editor';
import { useT } from '@/store/locale-store';

export function PromptInput() {
  const prompt = useChatStore((s) => s.prompt);
  const setPrompt = useChatStore((s) => s.setPrompt);
  const systemPrompt = useChatStore((s) => s.systemPrompt);
  const clearResponses = useChatStore((s) => s.clearResponses);
  const selectedModelIds = useModelStore((s) => s.selectedModelIds);
  const models = useModelStore((s) => s.models);
  const keys = useApiKeyStore((s) => s.keys);
  const { startChat, cancelStream, isStreaming } = useStreamChat();
  const { t } = useT();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = prompt.trim().length > 0 && selectedModelIds.length > 0 && !isStreaming;

  const handleSend = useCallback(() => {
    if (!canSend) return;

    for (const id of selectedModelIds) {
      const model = models.find(m => m.id === id);
      if (model && model.providerType === 'cloud' && model.provider !== 'trial') {
        const hasKey = !!keys[model.provider as keyof typeof keys];
        if (!hasKey) {
          alert(t('guide.noKeys'));
          return; // Prevent sending
        }
      }
    }

    startChat(prompt, systemPrompt, selectedModelIds);
  }, [canSend, prompt, systemPrompt, selectedModelIds, startChat, models, keys, t]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IME変換中はEnterで送信しない
    if (e.nativeEvent.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <SystemPromptEditor />
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedModelIds.length === 0
              ? t('prompt.placeholderNoModel')
              : t('prompt.placeholder')
          }
          disabled={selectedModelIds.length === 0}
          className="min-h-[80px] resize-none pr-24"
        />
        <div className="absolute bottom-2 right-2 flex items-center gap-1">
          {isStreaming ? (
            <Button
              size="sm"
              variant="destructive"
              onClick={cancelStream}
              aria-label={t('prompt.stopStreaming')}
            >
              <Square className="size-3" />
              {t('prompt.stop')}
            </Button>
          ) : (
            <>
              <Button
                size="icon-sm"
                variant="ghost"
                onClick={clearResponses}
                aria-label={t('prompt.clear')}
                disabled={!prompt}
              >
                <Trash2 className="size-3.5" />
              </Button>
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!canSend}
                aria-label={t('prompt.sendPrompt')}
              >
                <Send className="size-3.5" />
                {t('prompt.send')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

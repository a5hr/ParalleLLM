'use client';

import { useState } from 'react';
import { Eye, EyeOff, Check, ExternalLink } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useApiKeyStore } from '@/store/api-key-store';
import { providerNames, providerColors } from '@/lib/models';
import { cn } from '@/lib/utils';

const apiKeyProviders = [
  { id: 'openai', placeholder: 'sk-...', signupUrl: 'https://platform.openai.com/api-keys', hint: 'Paid' },
  { id: 'anthropic', placeholder: 'sk-ant-...', signupUrl: 'https://console.anthropic.com/settings/keys', hint: 'Paid' },
  { id: 'google', placeholder: 'AI...', signupUrl: 'https://aistudio.google.com/apikey', hint: 'Paid' },
  { id: 'groq', placeholder: 'gsk_...', signupUrl: 'https://console.groq.com/keys', hint: 'Free' },
  { id: 'openrouter', placeholder: 'sk-or-...', signupUrl: 'https://openrouter.ai/keys', hint: 'Free' },
] as const;

interface ApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ApiKeyDialog({ open, onOpenChange }: ApiKeyDialogProps) {
  const keys = useApiKeyStore((s) => s.keys);
  const setKey = useApiKeyStore((s) => s.setKey);
  const removeKey = useApiKeyStore((s) => s.removeKey);

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const toggleVisible = (provider: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const getDraft = (provider: string) =>
    drafts[provider] ?? keys[provider] ?? '';

  const updateDraft = (provider: string, value: string) => {
    setDrafts((prev) => ({ ...prev, [provider]: value }));
  };

  const saveDraft = (provider: string) => {
    const value = (drafts[provider] ?? '').trim();
    if (value) {
      setKey(provider, value);
    } else {
      removeKey(provider);
    }
    setDrafts((prev) => {
      const { [provider]: _, ...rest } = prev;
      return rest;
    });
  };

  const hasDraft = (provider: string) =>
    drafts[provider] !== undefined && drafts[provider] !== (keys[provider] ?? '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Keys</DialogTitle>
          <DialogDescription>
            Enter API keys for each provider. Keys are stored in your browser only.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {apiKeyProviders.map(({ id, placeholder, signupUrl, hint }) => {
            const color = providerColors[id] ?? providerColors.custom;
            const name = providerNames[id] ?? id;
            const isVisible = visibleKeys.has(id);
            const hasKey = !!keys[id];
            const isDirty = hasDraft(id);
            const isFreeProvider = hint === 'Free';

            return (
              <div key={id} className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 rounded-full shrink-0"
                    style={{ backgroundColor: color.hex }}
                  />
                  <label
                    htmlFor={`key-${id}`}
                    className="text-xs font-semibold"
                    style={{ color: color.hex }}
                  >
                    {name}
                  </label>
                  {isFreeProvider && (
                    <span className="rounded-full bg-green-100 px-1.5 py-0 text-[10px] font-bold leading-4 text-green-800 dark:bg-green-900 dark:text-green-200">
                      FREE
                    </span>
                  )}
                  {hasKey && !isDirty && (
                    <Check className="size-3 text-green-500" />
                  )}
                  <a
                    href={signupUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto inline-flex items-center gap-0.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Get key <ExternalLink className="size-2.5" />
                  </a>
                </div>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      id={`key-${id}`}
                      type={isVisible ? 'text' : 'password'}
                      value={getDraft(id)}
                      onChange={(e) => updateDraft(id, e.target.value)}
                      onBlur={() => saveDraft(id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveDraft(id);
                      }}
                      placeholder={placeholder}
                      className={cn(
                        'w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono',
                        'placeholder:text-muted-foreground/50',
                        'focus:outline-none focus:ring-2 focus:ring-ring'
                      )}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => toggleVisible(id)}
                    aria-label={isVisible ? 'Hide key' : 'Show key'}
                  >
                    {isVisible ? (
                      <EyeOff className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                  {isDirty && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => saveDraft(id)}
                    >
                      Save
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-1.5 mt-2 text-[11px] text-muted-foreground">
          <p>
            Groq and OpenRouter offer free API access. Sign up and paste your key above.
          </p>
          <p>
            For local models (Ollama, LM Studio), no key is needed — just start the server locally.
          </p>
          <p>
            Keys are stored in your browser only and sent to your own server.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

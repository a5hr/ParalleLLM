'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useChatStore } from '@/store/chat-store';
import { useT } from '@/store/locale-store';

export function SystemPromptEditor() {
  const [open, setOpen] = useState(false);
  const systemPrompt = useChatStore((s) => s.systemPrompt);
  const setSystemPrompt = useChatStore((s) => s.setSystemPrompt);
  const { t } = useT();

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        {t('systemPrompt.label')}
        {systemPrompt.trim() && (
          <span className="ml-1 inline-block size-1.5 rounded-full bg-primary" />
        )}
      </button>
      {open && (
        <Textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder={t('systemPrompt.placeholder')}
          className="mt-2 min-h-[60px] text-sm"
        />
      )}
    </div>
  );
}

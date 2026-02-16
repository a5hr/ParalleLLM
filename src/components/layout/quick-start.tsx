'use client';

import { KeyRound, Layers, Send, ArrowRight } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useT } from '@/store/locale-store';

export function QuickStart() {
  const hasResponses = useChatStore((s) => Object.keys(s.responses).length > 0);
  const { t } = useT();

  if (hasResponses) return null;

  const steps = [
    { icon: KeyRound, label: t('quickstart.step1') },
    { icon: Layers, label: t('quickstart.step2') },
    { icon: Send, label: t('quickstart.step3') },
  ];

  return (
    <div className="rounded-lg border bg-card/50 px-4 py-3">
      <p className="text-sm font-semibold mb-2">{t('quickstart.title')}</p>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        {steps.map((step, i) => (
          <li key={i} className="flex items-center gap-1.5">
            <step.icon className="size-3.5 shrink-0" />
            <span>{step.label}</span>
            {i < steps.length - 1 && (
              <ArrowRight className="size-3 text-muted-foreground/40 ml-1" />
            )}
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-muted-foreground/70 mt-1.5">
        {t('quickstart.hint')}
      </p>
    </div>
  );
}

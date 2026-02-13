'use client';

import { KeyRound, Layers, Send, Sparkles } from 'lucide-react';
import { useT } from '@/store/locale-store';

interface WelcomeGuideProps {
  hasKeys: boolean;
  hasSelectedModels: boolean;
}

export function WelcomeGuide({ hasKeys, hasSelectedModels }: WelcomeGuideProps) {
  const { t } = useT();

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-card/50 px-6 py-12 text-center">
      <Sparkles className="size-8 text-muted-foreground/50 mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-2">
        {t('guide.welcome')}
      </h2>

      <div className="mt-4 space-y-3 text-sm text-muted-foreground max-w-md">
        <div className="flex items-center gap-3 text-left">
          <KeyRound className="size-4 shrink-0" />
          <span>{t('guide.step1')}</span>
        </div>
        <div className="flex items-center gap-3 text-left">
          <Layers className="size-4 shrink-0" />
          <span>{t('guide.step2')}</span>
        </div>
        <div className="flex items-center gap-3 text-left">
          <Send className="size-4 shrink-0" />
          <span>{t('guide.step3')}</span>
        </div>
      </div>

      <div className="mt-6 space-y-1.5 text-xs text-muted-foreground/70">
        <p>{t('guide.freeHint')}</p>
        <p>{t('guide.localHint')}</p>
      </div>

      {/* Contextual hints */}
      {!hasKeys && (
        <p className="mt-4 text-xs font-medium text-amber-600 dark:text-amber-400">
          {t('guide.noKeys')}
        </p>
      )}
      {hasKeys && !hasSelectedModels && (
        <p className="mt-4 text-xs font-medium text-blue-600 dark:text-blue-400">
          {t('guide.noModels')}
        </p>
      )}
    </div>
  );
}

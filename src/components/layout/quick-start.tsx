'use client';

import { KeyRound, Layers, Send, Sparkles, Zap, Globe, ShieldCheck } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { useT } from '@/store/locale-store';

export function QuickStart() {
  const hasResponses = useChatStore((s) => Object.keys(s.responses).length > 0);
  const { t } = useT();

  if (hasResponses) return null;

  const steps = [
    { icon: KeyRound, label: t('quickstart.step1'), accent: 'text-violet-600 dark:text-violet-400' },
    { icon: Layers, label: t('quickstart.step2'), accent: 'text-blue-600 dark:text-blue-400' },
    { icon: Send, label: t('quickstart.step3'), accent: 'text-emerald-600 dark:text-emerald-400' },
  ];

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card/80 backdrop-blur-sm p-5 sm:p-6">
      {/* Subtle background glow */}
      <div className="pointer-events-none absolute -right-20 -top-20 size-64 rounded-full bg-gradient-to-br from-violet-500/[0.03] to-blue-500/[0.03] blur-3xl" />

      {/* Title row */}
      <div className="mb-6 flex items-center gap-2.5">
        <Sparkles className="size-5 text-violet-500 dark:text-violet-400" />
        <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
          {t('quickstart.title')}
        </h2>
      </div>

      {/* Desktop stepper */}
      <div className="mx-auto hidden max-w-2xl sm:block">
        {/* Circles row: 3-col grid with absolute connecting line behind */}
        <div className="relative mb-3 grid grid-cols-3">
          {/* Connecting line — positioned behind circles from col1-center to col3-center */}
          <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-muted-foreground/15" />

          {steps.map((_, i) => (
            <div key={i} className="relative z-10 flex justify-center">
              <div className="flex size-10 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-background text-muted-foreground">
                <span className="text-sm font-bold">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Labels row: same 3-col grid, centered */}
        <div className="grid grid-cols-3">
          {steps.map((step, i) => {
            const StepIcon = step.icon;
            return (
              <div key={i} className="flex items-center justify-center gap-2">
                <StepIcon className={`size-4 shrink-0 ${step.accent}`} />
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile stepper — vertical list */}
      <div className="flex flex-col gap-3 sm:hidden">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/20 bg-background text-muted-foreground">
                <span className="text-sm font-bold">{i + 1}</span>
              </div>
              <StepIcon className={`size-4 shrink-0 ${step.accent}`} />
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {step.label}
              </p>
            </div>
          );
        })}
      </div>

      {/* Hints */}
      <div className="relative mt-5 flex flex-col items-center gap-1.5 text-[11px] text-muted-foreground/70 sm:flex-row sm:justify-center sm:gap-4">
        <span className="inline-flex items-center gap-1.5">
          <Zap className="size-3 text-emerald-500" />
          <span className="font-medium text-foreground/70">Groq · OpenRouter</span>
          <span className="text-muted-foreground/50">—</span>
          <span>{t('quickstart.hintFree')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Globe className="size-3 text-blue-500" />
          <span className="font-medium text-foreground/70">Ollama · LM Studio</span>
          <span className="text-muted-foreground/50">—</span>
          <span>{t('quickstart.hintLocal')}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ShieldCheck className="size-3 text-muted-foreground/40" />
          <span>{t('quickstart.hintKeys')}</span>
        </span>
      </div>
    </div>
  );
}

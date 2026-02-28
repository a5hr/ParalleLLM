'use client';

import { useModelStore, MAX_SELECTED_MODELS } from '@/store/model-store';
import {
  providerColors,
  providerNames,
  formatTokens,
  formatPrice,
} from '@/lib/models';
import { ModelConfigDialog } from './model-config-dialog';
import { LocalModelsSection } from './local-models-section';
import { PrivacyNotice } from '@/components/common/privacy-notice';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Settings2, Check, Zap, DollarSign, MessageSquare, Info } from 'lucide-react';
import { useT } from '@/store/locale-store';

export function ModelSelector() {
  const models = useModelStore((s) => s.models);
  const selectedModelIds = useModelStore((s) => s.selectedModelIds);
  const toggleModel = useModelStore((s) => s.toggleModel);
  const { t } = useT();

  const [configModelId, setConfigModelId] = useState<string | null>(null);

  // Group models by provider
  const groupedByProvider = new Map<string, typeof models>();
  for (const m of models) {
    const list = groupedByProvider.get(m.provider) ?? [];
    list.push(m);
    groupedByProvider.set(m.provider, list);
  }

  const getProviders = (type: 'cloud' | 'local') => {
    const providers: string[] = [];
    for (const [provider, list] of groupedByProvider) {
      if (list[0]?.providerType === type && !providers.includes(provider)) {
        providers.push(provider);
      }
    }
    return providers;
  };

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t('models.title')}</h2>
        <span className={cn('text-xs', selectedModelIds.length >= MAX_SELECTED_MODELS ? 'text-orange-500 font-medium' : 'text-muted-foreground')}>
          {t('models.selected', { count: selectedModelIds.length })} / {MAX_SELECTED_MODELS}
        </span>
      </div>

      <PrivacyNotice />

      {/* Cloud section */}
      {(() => {
        const cloudProviders = getProviders('cloud');
        if (cloudProviders.length === 0) return null;
        return (
          <div className="space-y-3">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('models.cloud')}
            </span>
            {cloudProviders.map((provider) => {
              const providerModels = groupedByProvider.get(provider) ?? [];
              const color = providerColors[provider] ?? providerColors.custom;
              const name = providerNames[provider] ?? provider;
              return (
                <div key={provider} className="space-y-1.5">
                  <div className="flex items-center gap-1.5 pl-1">
                    <span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                    <span className="text-xs font-semibold" style={{ color: color.hex }}>{name}</span>
                  </div>
                  {provider === 'trial' && (
                    <div className="flex items-start gap-2 rounded-md bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 border border-amber-200/50 dark:border-amber-900/50">
                      <Info className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                      <div className="flex-1 leading-relaxed">
                        <strong>{t('trial.coldStartTitle')}</strong>{t('trial.coldStartDesc')}
                      </div>
                    </div>
                  )}
                  <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {providerModels.map((m) => {
                      const selected = selectedModelIds.includes(m.id);
                      const atLimit = !selected && selectedModelIds.length >= MAX_SELECTED_MODELS;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          disabled={atLimit}
                          onClick={() => toggleModel(m.id)}
                          className={cn(
                            'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                            selected
                              ? 'border-2 bg-accent/50 shadow-sm'
                              : atLimit
                                ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                                : 'border-border bg-background hover:bg-accent/30 hover:border-muted-foreground/30'
                          )}
                          style={selected ? { borderColor: color.hex } : undefined}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="text-sm font-semibold truncate">{m.name}</span>
                              {m.isFree && (
                                <span className="rounded-full bg-green-100 px-1.5 py-0 text-[10px] font-bold leading-4 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">
                                  {t('models.free')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => { e.stopPropagation(); setConfigModelId(m.id); }}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setConfigModelId(m.id); } }}
                                className="rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                              >
                                <Settings2 className="size-3 text-muted-foreground" />
                              </span>
                              <div
                                className={cn('flex items-center justify-center size-5 rounded-full border-2 transition-colors', selected ? 'text-white' : 'border-muted-foreground/30')}
                                style={selected ? { backgroundColor: color.hex, borderColor: color.hex } : undefined}
                              >
                                {selected && <Check className="size-3" />}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1" title={t('models.contextWindow')}>
                              <MessageSquare className="size-3" />
                              {formatTokens(m.parameters.maxTokens)}
                            </span>
                            <span className="inline-flex items-center gap-1" title={t('models.maxOutput')}>
                              <Zap className="size-3" />
                              {formatTokens(m.maxOutput)}
                            </span>
                            {m.pricing ? (
                              <span className="inline-flex items-center gap-1" title={t('models.pricingTitle')}>
                                <DollarSign className="size-3" />
                                <span>{formatPrice(m.pricing.input)}/{formatPrice(m.pricing.output)}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                                <DollarSign className="size-3" />
                                {t('models.freeLower')}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Local section — always shown with connect UI */}
      <LocalModelsSection />

      {/* Local model cards (rendered from discovered models) */}
      {(() => {
        const localProviders = getProviders('local');
        if (localProviders.length === 0) return null;
        return localProviders.map((provider) => {
          const providerModels = groupedByProvider.get(provider) ?? [];
          const color = providerColors[provider] ?? providerColors.custom;
          const name = providerNames[provider] ?? provider;
          return (
            <div key={provider} className="space-y-1.5">
              <div className="flex items-center gap-1.5 pl-1">
                <span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: color.hex }} />
                <span className="text-xs font-semibold" style={{ color: color.hex }}>{name}</span>
              </div>
              <div className="grid gap-2 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {providerModels.map((m) => {
                  const selected = selectedModelIds.includes(m.id);
                  const atLimit = !selected && selectedModelIds.length >= MAX_SELECTED_MODELS;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={atLimit}
                      onClick={() => toggleModel(m.id)}
                      className={cn(
                        'group relative flex flex-col gap-2 rounded-lg border p-3 text-left transition-all',
                        selected
                          ? 'border-2 bg-accent/50 shadow-sm'
                          : atLimit
                            ? 'border-border bg-muted/50 opacity-50 cursor-not-allowed'
                            : 'border-border bg-background hover:bg-accent/30 hover:border-muted-foreground/30'
                      )}
                      style={selected ? { borderColor: color.hex } : undefined}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm font-semibold truncate">{m.name}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => { e.stopPropagation(); setConfigModelId(m.id); }}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); setConfigModelId(m.id); } }}
                            className="rounded-full p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                          >
                            <Settings2 className="size-3 text-muted-foreground" />
                          </span>
                          <div
                            className={cn('flex items-center justify-center size-5 rounded-full border-2 transition-colors', selected ? 'text-white' : 'border-muted-foreground/30')}
                            style={selected ? { backgroundColor: color.hex, borderColor: color.hex } : undefined}
                          >
                            {selected && <Check className="size-3" />}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                          <DollarSign className="size-3" />
                          Free
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        });
      })()}

      <ModelConfigDialog
        modelId={configModelId}
        open={configModelId !== null}
        onOpenChange={(open) => {
          if (!open) setConfigModelId(null);
        }}
      />
    </div>
  );
}

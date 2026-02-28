'use client';

import { useModelStore } from '@/store/model-store';
import {
  providerColors,
  providerNames,
  formatTokens,
  formatPrice,
  defaultModels,
} from '@/lib/models';

// Pre-compute lookup map for default model context windows
const defaultContextWindows = new Map(defaultModels.map((m) => [m.id, m.maxTokens]));
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useT } from '@/store/locale-store';

interface ModelListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelListDialog({ open, onOpenChange }: ModelListDialogProps) {
  const models = useModelStore((s) => s.models);
  const { t } = useT();

  // Helper to get context window with fallback
  const getContextWindow = (m: typeof models[number]) =>
    m.contextWindow ?? defaultContextWindows.get(m.id) ?? m.maxOutput;

  // Group models by provider
  const groupedByProvider = new Map<string, typeof models>();
  for (const m of models) {
    const list = groupedByProvider.get(m.provider) ?? [];
    list.push(m);
    groupedByProvider.set(m.provider, list);
  }

  const providers = Array.from(groupedByProvider.keys());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-6xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t('modelList.title')}</DialogTitle>
          <DialogDescription>{t('modelList.description')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-8rem)]">
          <div className="space-y-6 pr-4">
            {providers.map((provider) => {
              const providerModels = groupedByProvider.get(provider) ?? [];
              const color = providerColors[provider] ?? providerColors.custom;
              const name = providerNames[provider] ?? provider;

              return (
                <div key={provider} className="space-y-2">
                  <div className="flex items-center gap-2 sticky top-0 bg-background py-1">
                    <span
                      className="inline-block size-3 rounded-full shrink-0"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span
                      className="text-sm font-semibold"
                      style={{ color: color.hex }}
                    >
                      {name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({providerModels.length} {t('modelList.modelCount')})
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50 dark:bg-muted">
                          <th className="px-3 py-2 text-left font-medium">
                            {t('modelList.colName')}
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            {t('modelList.colId')}
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            {t('modelList.colContext')}
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            {t('modelList.colMaxOutput')}
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            {t('modelList.colPricing')}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {providerModels.map((m) => (
                          <tr
                            key={m.id}
                            className="border-b border-border last:border-b-0 hover:bg-accent/50 transition-colors"
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{m.name}</span>
                                {m.isFree && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px] px-1.5 py-0"
                                  >
                                    {t('models.free')}
                                  </Badge>
                                )}
                                {m.providerType === 'local' && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200 text-[10px] px-1.5 py-0"
                                  >
                                    {t('models.localBadge')}
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                {m.id}
                              </code>
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {formatTokens(getContextWindow(m))}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-xs">
                              {formatTokens(m.maxOutput)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {m.pricing ? (
                                <span className="text-xs">
                                  {formatPrice(m.pricing.input)} /{' '}
                                  {formatPrice(m.pricing.output)}
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                                  {t('models.freeLower')}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { memo, useCallback, useState } from 'react';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { providerColors, providerNames, providerTypeBadge } from '@/lib/models';
import { useModelStore } from '@/store/model-store';
import { ResponseContent } from './response-content';
import { ResponseMeta } from './response-meta';
import { cn } from '@/lib/utils';
import type { ModelResponse } from '@/types/chat';
import { useT } from '@/store/locale-store';

interface ResponseCardProps {
  response: ModelResponse;
}

export const ResponseCard = memo(function ResponseCard({ response }: ResponseCardProps) {
  const models = useModelStore((s) => s.models);
  const model = models.find((m) => m.id === response.modelId);
  const provider = response.provider || model?.provider || 'custom';
  const color = providerColors[provider] ?? providerColors.custom;
  const badge = providerTypeBadge[model?.providerType ?? 'cloud'];
  const displayProviderName = providerNames[provider] ?? provider;
  const { t } = useT();
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!response.content) return;
    await navigator.clipboard.writeText(response.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [response.content]);

  const isError = response.status === 'error';
  const isStreaming = response.status === 'streaming';

  return (
    <Card
      className={cn(
        'flex flex-col overflow-hidden transition-shadow',
        isError && 'border-destructive/50'
      )}
    >
      {/* Provider color bar */}
      <div className="h-1.5 -mx-px -mt-px rounded-t-xl" style={{ backgroundColor: color.hex }} />

      <CardHeader className="pb-2 pt-3 gap-0">
        <div className="flex items-center justify-between">
          {/* Left: Provider + Model info */}
          <div className="flex flex-col gap-1 min-w-0">
            {/* Provider row */}
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: color.hex }}
              />
              <span
                className="text-xs font-semibold"
                style={{ color: color.hex }}
              >
                {displayProviderName}
              </span>
              {badge && (
                <span className={cn('rounded-full px-1.5 py-0 text-[10px] font-bold leading-4', badge.className)}>
                  {t('models.localBadge')}
                </span>
              )}
            </div>
            {/* Model name */}
            <span className="text-sm font-medium text-foreground truncate">
              {model?.name ?? response.modelId}
            </span>
          </div>

          {/* Right: Copy button */}
          {response.content && (
            <Button
              variant="ghost"
              size="icon"
              className="size-7 shrink-0"
              onClick={handleCopy}
              aria-label={t('response.copy')}
            >
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 min-h-[100px] overflow-y-auto pt-0">
        {isError ? (
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <p className="text-sm">{response.error}</p>
          </div>
        ) : (
          <ResponseContent
            content={response.content}
            isStreaming={isStreaming}
          />
        )}
      </CardContent>

      <CardFooter className="pt-0">
        <ResponseMeta
          status={response.status}
          latencyMs={response.latencyMs}
          usage={response.usage}
          provider={displayProviderName}
          providerColor={color.hex}
        />
      </CardFooter>
    </Card>
  );
});

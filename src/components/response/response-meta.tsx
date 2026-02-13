import type { TokenUsage } from '@/types/chat';

interface ResponseMetaProps {
  status: string;
  latencyMs?: number;
  usage?: TokenUsage;
  provider?: string;
  providerColor?: string;
}

export function ResponseMeta({ status, latencyMs, usage, provider, providerColor }: ResponseMetaProps) {
  if (status === 'idle') return null;

  if (status === 'streaming') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-green-500 animate-pulse" />
        <span>Streaming...</span>
      </div>
    );
  }

  if (status !== 'done') return null;

  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      {provider && (
        <span className="font-medium" style={providerColor ? { color: providerColor } : undefined}>
          {provider}
        </span>
      )}
      {latencyMs != null && (
        <span>{latencyMs < 1000 ? `${latencyMs}ms` : `${(latencyMs / 1000).toFixed(1)}s`}</span>
      )}
      {usage && (
        <span>{usage.totalTokens.toLocaleString()} tokens</span>
      )}
    </div>
  );
}

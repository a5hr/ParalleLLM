import { cn } from '@/lib/utils';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'checking';
}

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={cn(
          'inline-block size-2 rounded-full',
          status === 'connected' && 'bg-green-500',
          status === 'disconnected' && 'bg-red-500',
          status === 'checking' && 'bg-yellow-500 animate-pulse'
        )}
      />
      <span className="capitalize text-muted-foreground">{status}</span>
    </span>
  );
}

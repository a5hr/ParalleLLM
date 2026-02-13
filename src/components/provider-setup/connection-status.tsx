import { cn } from '@/lib/utils';
import { useT } from '@/store/locale-store';

interface ConnectionStatusProps {
  status: 'connected' | 'disconnected' | 'checking';
}

const statusKeys = {
  connected: 'connection.connected',
  disconnected: 'connection.disconnected',
  checking: 'connection.checking',
} as const;

export function ConnectionStatus({ status }: ConnectionStatusProps) {
  const { t } = useT();

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
      <span className="text-muted-foreground">{t(statusKeys[status])}</span>
    </span>
  );
}

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useModelStore } from '@/store/model-store';
import { cn } from '@/lib/utils';
import { RefreshCw, Plus, X, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useT } from '@/store/locale-store';

/** Well-known local servers to auto-scan on mount */
const wellKnownServers = [
  { baseUrl: 'http://localhost:11434/v1', label: 'Ollama' },
  { baseUrl: 'http://localhost:1234/v1', label: 'LM Studio' },
];

function endpointId(baseUrl: string) {
  // Derive a stable ID from the URL
  return baseUrl.replace(/[^a-zA-Z0-9]/g, '_');
}

function endpointLabel(baseUrl: string) {
  const known = wellKnownServers.find((s) => s.baseUrl === baseUrl);
  if (known) return known.label;
  try {
    const u = new URL(baseUrl);
    return `${u.hostname}:${u.port || '80'}`;
  } catch {
    return baseUrl;
  }
}

export function LocalModelsSection() {
  const localEndpoints = useModelStore((s) => s.localEndpoints);
  const addLocalEndpoint = useModelStore((s) => s.addLocalEndpoint);
  const removeLocalEndpoint = useModelStore((s) => s.removeLocalEndpoint);
  const updateLocalEndpointStatus = useModelStore((s) => s.updateLocalEndpointStatus);
  const addLocalModels = useModelStore((s) => s.addLocalModels);
  const removeLocalModels = useModelStore((s) => s.removeLocalModels);

  const { t } = useT();
  const [scanning, setScanning] = useState<Set<string>>(new Set());
  const [urlInput, setUrlInput] = useState('');
  const [showInput, setShowInput] = useState(false);
  const autoScanned = useRef(false);

  const probe = useCallback(
    async (baseUrl: string): Promise<boolean> => {
      const id = endpointId(baseUrl);
      const name = endpointLabel(baseUrl);

      setScanning((prev) => new Set(prev).add(id));

      // Ensure endpoint exists in store
      const exists = useModelStore.getState().localEndpoints.some((e) => e.id === id);
      if (!exists) {
        addLocalEndpoint({ id, name, baseUrl });
      }
      updateLocalEndpointStatus(id, 'checking');

      try {
        const res = await fetch(
          `/api/providers/local/models?provider=${id}&baseUrl=${encodeURIComponent(baseUrl)}`
        );
        const data = await res.json();

        if (res.ok && data.models?.length > 0) {
          const modelIds = data.models.map((m: { id: string }) => m.id);
          updateLocalEndpointStatus(id, 'connected', modelIds);
          addLocalModels(id, modelIds, baseUrl);
          return true;
        } else {
          // Remove silently if auto-scan, keep if user-added
          updateLocalEndpointStatus(id, 'disconnected');
          return false;
        }
      } catch {
        updateLocalEndpointStatus(id, 'disconnected');
        return false;
      } finally {
        setScanning((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    [addLocalEndpoint, updateLocalEndpointStatus, addLocalModels]
  );

  // Auto-scan well-known ports on first mount
  useEffect(() => {
    if (autoScanned.current) return;
    autoScanned.current = true;

    for (const server of wellKnownServers) {
      const id = endpointId(server.baseUrl);
      const existing = useModelStore.getState().localEndpoints.find((e) => e.id === id);
      // Re-probe if already registered, or silently try new ones
      if (existing) {
        probe(server.baseUrl);
      } else {
        // Silent probe — add temporarily, remove if fails
        probe(server.baseUrl).then((ok) => {
          if (!ok) {
            // Clean up failed auto-scan endpoint
            removeLocalEndpoint(id);
            removeLocalModels(id);
          }
        });
      }
    }
  }, [probe, removeLocalEndpoint, removeLocalModels]);

  const handleAddUrl = () => {
    let url = urlInput.trim();
    if (!url) return;

    // Add protocol if missing
    if (!url.startsWith('http')) url = `http://${url}`;
    // Add /v1 suffix if not present
    if (!url.endsWith('/v1') && !url.endsWith('/v1/')) {
      url = url.replace(/\/+$/, '') + '/v1';
    }

    setUrlInput('');
    setShowInput(false);
    probe(url);
  };

  const handleRemove = (ep: { id: string }) => {
    removeLocalModels(ep.id);
    removeLocalEndpoint(ep.id);
  };

  const handleRefresh = (ep: { id: string; baseUrl: string }) => {
    removeLocalModels(ep.id);
    probe(ep.baseUrl);
  };

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {t('models.local')}
        </span>
        <span className="rounded-full px-1.5 py-0 text-[10px] font-bold leading-4 bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200">
          {t('models.free')}
        </span>
      </div>

      {/* Connected endpoints */}
      {localEndpoints.map((ep) => {
        const isScanning = scanning.has(ep.id);

        return (
          <div
            key={ep.id}
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2',
              ep.status === 'connected'
                ? 'border-green-500/30 bg-green-50/50 dark:bg-green-950/20'
                : ep.status === 'checking'
                  ? 'border-yellow-500/30 bg-yellow-50/50 dark:bg-yellow-950/20'
                  : 'border-destructive/30 bg-destructive/5'
            )}
          >
            <Server className="size-3.5 text-muted-foreground shrink-0" />
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold truncate">{ep.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">{ep.baseUrl}</span>
            </div>
            {ep.status === 'connected' && (
              <span className="text-[10px] text-green-600 dark:text-green-400 font-medium shrink-0">
                {t('localModels.models', { count: ep.models.length })}
              </span>
            )}
            {ep.status === 'disconnected' && !isScanning && (
              <span className="text-[10px] text-destructive font-medium shrink-0">
                {t('localModels.offline')}
              </span>
            )}
            {ep.status === 'checking' && (
              <span className="text-[10px] text-yellow-600 dark:text-yellow-400 font-medium shrink-0">
                {t('localModels.connecting')}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0"
              onClick={() => handleRefresh(ep)}
              disabled={isScanning}
              aria-label={t('localModels.refresh')}
            >
              <RefreshCw className={cn('size-3', isScanning && 'animate-spin')} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={() => handleRemove(ep)}
              aria-label={t('localModels.remove')}
            >
              <X className="size-3" />
            </Button>
          </div>
        );
      })}

      {/* Add endpoint */}
      {showInput ? (
        <div className="flex gap-1.5">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
            placeholder="http://localhost:8080"
            className={cn(
              'flex-1 rounded-md border bg-background px-3 py-1.5 text-sm font-mono',
              'placeholder:text-muted-foreground/50',
              'focus:outline-none focus:ring-2 focus:ring-ring'
            )}
            autoFocus
          />
          <Button size="sm" className="h-8" onClick={handleAddUrl}>
            {t('localModels.connect')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={() => { setShowInput(false); setUrlInput(''); }}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => setShowInput(true)}
        >
          <Plus className="size-3" />
          {t('localModels.addServer')}
        </Button>
      )}

      {/* Help text */}
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        {t('localModels.helpText')}
        {localEndpoints.length === 0 && t('localModels.autoDetect')}
      </p>
    </div>
  );
}

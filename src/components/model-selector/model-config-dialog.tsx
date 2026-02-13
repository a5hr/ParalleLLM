'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { useModelStore } from '@/store/model-store';
import { useState, useEffect } from 'react';
import { useT } from '@/store/locale-store';

interface ModelConfigDialogProps {
  modelId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ModelConfigDialog({ modelId, open, onOpenChange }: ModelConfigDialogProps) {
  const models = useModelStore((s) => s.models);
  const updateModelConfig = useModelStore((s) => s.updateModelConfig);

  const model = models.find((m) => m.id === modelId);

  const { t } = useT();
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  useEffect(() => {
    if (model) {
      setTemperature(model.parameters.temperature);
      setMaxTokens(model.parameters.maxTokens);
    }
  }, [model]);

  if (!model) return null;

  const handleSave = () => {
    updateModelConfig(model.id, {
      parameters: { temperature, maxTokens },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{model.name}</DialogTitle>
          <DialogDescription>{t('modelConfig.title')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{t('modelConfig.temperature')}</label>
              <span className="text-sm text-muted-foreground">{temperature.toFixed(2)}</span>
            </div>
            <Slider
              value={[temperature]}
              onValueChange={([v]) => setTemperature(v)}
              min={0}
              max={2}
              step={0.01}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('modelConfig.precise')}</span>
              <span>{t('modelConfig.creative')}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">{t('modelConfig.maxTokens')}</label>
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={model.parameters.maxTokens}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {t('modelConfig.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center justify-center rounded-md px-4 py-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t('modelConfig.save')}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

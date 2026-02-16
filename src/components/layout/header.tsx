'use client';

import { Moon, Sun, Monitor, KeyRound, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '@/store/ui-store';
import { useApiKeyStore } from '@/store/api-key-store';
import { useLocaleStore, useT } from '@/store/locale-store';
import { ApiKeyDialog } from '@/components/settings/api-key-dialog';
import { useEffect, useState, useSyncExternalStore } from 'react';

const subscribeMounted = () => () => {};
const getMounted = () => true;
const getServerMounted = () => false;

export function Header() {
  const { theme, setTheme } = useUIStore();
  const keys = useApiKeyStore((s) => s.keys);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const { t, locale } = useT();
  const mounted = useSyncExternalStore(subscribeMounted, getMounted, getServerMounted);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const configuredCount = Object.values(keys).filter(Boolean).length;

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(prefersDark ? 'dark' : 'light');
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const cycleTheme = () => {
    const order: Array<'light' | 'dark' | 'system'> = ['light', 'dark', 'system'];
    const idx = order.indexOf(theme);
    setTheme(order[(idx + 1) % order.length]);
  };

  const toggleLocale = () => {
    setLocale(locale === 'en' ? 'ja' : 'en');
  };

  const ThemeIcon = theme === 'dark' ? Moon : theme === 'light' ? Sun : Monitor;

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            P
          </div>
          <h1 className="text-lg font-semibold tracking-tight">ParallelLM</h1>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setKeyDialogOpen(true)}
            aria-label={t('header.apiKeys')}
            className="relative"
          >
            <KeyRound className="size-4" />
            {mounted && configuredCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-green-500 text-[9px] font-bold text-white">
                {configuredCount}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLocale}
            aria-label={t('lang.switch')}
            className="gap-1 text-xs font-medium"
          >
            <Languages className="size-3.5" />
            {mounted && (locale === 'en' ? 'EN' : 'JA')}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={cycleTheme}
            aria-label={`${t('header.theme')}: ${theme}`}
          >
            {mounted ? <ThemeIcon className="size-4" /> : <Monitor className="size-4" />}
          </Button>
        </div>

        <ApiKeyDialog open={keyDialogOpen} onOpenChange={setKeyDialogOpen} />
      </div>
    </header>
  );
}

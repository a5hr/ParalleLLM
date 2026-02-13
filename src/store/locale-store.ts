import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect } from 'react';
import en from '@/locales/en';
import ja from '@/locales/ja';
import type { TranslationKey } from '@/locales/en';

export type Locale = 'en' | 'ja';

const dictionaries: Record<Locale, Record<TranslationKey, string>> = { en, ja };

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

function translate(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>
): string {
  let text = dictionaries[locale]?.[key] ?? dictionaries.en[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set) => ({
      locale: 'en' as Locale, // SSR-safe default — matches server render
      setLocale: (locale) => set({ locale }),
    }),
    {
      name: 'parallellm-locale',
      partialize: (state) => ({ locale: state.locale }),
      skipHydration: true, // Prevent auto-rehydration to avoid SSR mismatch
    }
  )
);

/**
 * Shorthand hook for translations.
 *
 * On the server and during the first client render, the locale is always 'en'
 * (skipHydration ensures the store default is used). After mount, we rehydrate
 * from localStorage and — on first visit — detect the browser language.
 * This guarantees hydration matches while still respecting the user's locale.
 */
let _hydrated = false;

export function useT() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    if (!_hydrated) {
      _hydrated = true;
      useLocaleStore.persist.rehydrate();

      // On first visit (nothing persisted), detect from browser
      const raw = localStorage.getItem('parallellm-locale');
      if (!raw) {
        const detected = navigator.language.startsWith('ja') ? 'ja' : 'en';
        useLocaleStore.getState().setLocale(detected);
      }
    }
  }, []);

  return {
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
    locale,
  };
}

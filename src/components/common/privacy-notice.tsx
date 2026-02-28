'use client';

import { ShieldCheck } from 'lucide-react';
import { useT } from '@/store/locale-store';

export function PrivacyNotice() {
    const { t } = useT();

    return (
        <div className="flex items-start gap-2 rounded-md bg-blue-50/50 dark:bg-blue-950/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-900/50">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <div className="flex-1 leading-relaxed">
                <strong>{t('trial.privacyTitle')}</strong>{t('trial.privacyDesc')}
            </div>
        </div>
    );
}

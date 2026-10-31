import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CompanySuspendedScreen } from '@repo/ui';
import { useEffect, useSyncExternalStore } from 'react';
import {
  isCompanySuspended,
  subscribeCompanySuspended,
} from '#/features/auth/company-suspension';
import { syncNow } from '#/features/sync/sync';
import { useSync } from '#/features/sync/use-sync';

const t = createTranslator(DEFAULT_LOCALE);

const RECHECK_MS = 60_000;

export function useCompanySuspended(): boolean {
  return useSyncExternalStore(subscribeCompanySuspended, () =>
    isCompanySuspended(localStorage),
  );
}

/**
 * In place of every page: nothing here empties the phone, no sign-out above
 * all. The synchronisation keeps trying behind it and lifts it once reactivated.
 */
export function CompanySuspendedPage() {
  const { pending, rejected } = useSync();
  const waiting = pending + rejected;
  // Past the back-off of the refusals: reactivated, the phone finds out within a minute.
  useEffect(() => {
    const check = () => void syncNow({ force: true });
    check();
    const timer = setInterval(check, RECHECK_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <CompanySuspendedScreen
      title={t('company.suspended.title')}
      description={t('company.suspended.description')}
      pending={
        waiting > 0
          ? t('company.suspended.pending', { count: waiting })
          : undefined
      }
      retryLabel={t('company.suspended.retry')}
      onRetry={() => void syncNow({ force: true })}
    />
  );
}

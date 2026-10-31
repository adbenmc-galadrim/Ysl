import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CompanySuspendedScreen } from '@repo/ui';
import { useSyncExternalStore } from 'react';
import {
  isCompanySuspended,
  subscribeCompanySuspended,
} from '#/features/auth/company-suspension';
import { syncNow } from '#/features/sync/sync';
import { useSync } from '#/features/sync/use-sync';

const t = createTranslator(DEFAULT_LOCALE);

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

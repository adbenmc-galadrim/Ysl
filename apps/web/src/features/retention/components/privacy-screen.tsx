import { resolveRetention } from '@repo/contract/company-settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Banner, Button, DonneesScreen, Sheet } from '@repo/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  SignOutBlockedError,
  useEraseDevice,
} from '#/features/auth/api/sign-out';
import {
  counted,
  describePurge,
  retentionGroup,
} from '#/features/retention/describe';
import { localPurge } from '#/features/retention/start';
import { useCompanySettings } from '#/features/settings/use-company-settings';
import { syncNow } from '#/features/sync/sync';
import { trpcClient } from '#/lib/trpc';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

const STATUS_KEY = ['maintenance', 'status'] as const;

type Outcome = 'done' | 'busy' | 'failed' | null;

const OUTCOME = {
  done: { tone: 'green', icon: 'check', key: 'privacy.purge.done' },
  busy: { tone: 'orange', icon: 'clock', key: 'privacy.purge.busy' },
  failed: { tone: 'red', icon: 'alert', key: 'privacy.purge.failed' },
} as const;

function eraseMessage(error: unknown): string {
  if (error instanceof SignOutBlockedError) {
    return counted('privacy.erase.pending', error.pending + error.rejected);
  }
  return t('privacy.erase.failed');
}

/** Réglages › Données et confidentialité (admin): durations, last purge, purge now, erase this iPhone. */
export function PrivacyScreen() {
  const navigate = useNavigate();
  const online = useOnline();
  const company = useCompanySettings();
  const queryClient = useQueryClient();
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [confirming, setConfirming] = useState(false);
  const erase = useEraseDevice();

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => trpcClient.maintenance.status.query(),
    enabled: online,
  });

  const purge = useMutation({
    mutationFn: () => trpcClient.maintenance.purgeNow.mutate(),
    onSuccess: async (result) => {
      if (result.status === 'busy') {
        setOutcome('busy');
        return;
      }
      queryClient.setQueryData(STATUS_KEY, { last: result.run });
      setOutcome('done');
      await syncNow({ force: true });
      await localPurge.schedule({ force: true });
    },
    onError: (error) => {
      console.error('Purge failed', error);
      setOutcome('failed');
    },
  });

  const subtitle = purge.isPending
    ? t('privacy.purge.running')
    : status.data
      ? status.data.last
        ? describePurge(status.data.last, new Date())
        : t('privacy.purge.never')
      : !online
        ? t('privacy.purge.offline')
        : status.isError
          ? t('privacy.purge.unavailable')
          : t('privacy.purge.loading');

  const blocked = erase.error instanceof SignOutBlockedError;
  const shown = outcome ? OUTCOME[outcome] : null;

  return (
    <>
      <DonneesScreen
        retention={retentionGroup(resolveRetention(company.retention))}
        purge={{
          title: t('privacy.purge.title'),
          subtitle,
          action: t('privacy.purge.action'),
          onAction: () => {
            setOutcome(null);
            purge.mutate();
          },
          disabled: !online || purge.isPending,
        }}
        banner={
          shown && (
            <div role="status">
              <Banner
                tone={shown.tone}
                icon={shown.icon}
                title={t(shown.key)}
              />
            </div>
          )
        }
        note={t('privacy.note')}
        erase={{
          label: t('privacy.erase'),
          note: t('privacy.erase.note'),
          onPress: () => {
            erase.reset();
            setConfirming(true);
          },
          disabled: erase.isPending,
        }}
        onBack={() => void navigate({ to: '/reglages' })}
      />
      {confirming && (
        <Sheet
          fixed
          title={t('privacy.erase.title')}
          description={
            erase.isError
              ? eraseMessage(erase.error)
              : t('privacy.erase.description')
          }
          className="pb-[calc(var(--safe-bottom)+16px)]"
          onDismiss={() => setConfirming(false)}
        >
          <Button
            variant="destructive"
            block
            disabled={erase.isPending}
            className="mt-6"
            onClick={() => erase.mutate({ force: blocked })}
          >
            {blocked ? t('privacy.erase.force') : t('privacy.erase.confirm')}
          </Button>
          <Button
            variant="secondary"
            block
            className="mt-3"
            onClick={() => setConfirming(false)}
          >
            {t('privacy.erase.cancel')}
          </Button>
        </Sheet>
      )}
    </>
  );
}

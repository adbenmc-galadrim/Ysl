import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  ColisScreen,
  EmptyState,
  RemettreActions,
  Toast,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useHomeParcels } from '#/features/parcels/api/use-parcels';
import { summarize, toSections } from '#/features/parcels/sections';
import { showsPendingBanner, syncPill } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';
import { applyUpdate, useUpdate } from '#/features/update/updater';
import { useDelayedPending } from '#/lib/use-delayed-pending';

const t = createTranslator(DEFAULT_LOCALE);

export function ColisHome() {
  const navigate = useNavigate();
  const sync = useSync();
  const update = useUpdate();
  const parcels = useHomeParcels();
  const loading = useDelayedPending(parcels === undefined);
  const rows = parcels ?? [];
  const empty = parcels !== undefined && rows.length === 0;

  const scan = () => void navigate({ to: '/scan' });
  const handover = () => void navigate({ to: '/remise' });

  return (
    <ColisScreen
      sync={syncPill(sync)}
      summary={parcels ? summarize(rows) : t('colis.summary.loading')}
      sections={toSections(rows)}
      notice={
        showsPendingBanner(sync) ? (
          <Banner
            tone="orange"
            icon="cloud"
            title={
              sync.pending === 1
                ? t('colis.pending.title.one')
                : t('colis.pending.title.many', { count: sync.pending })
            }
            description={t('colis.pending.description')}
            classNames={{
              root: 'h-16 py-[11px]',
              description: 'mt-[3px] leading-4',
            }}
          />
        ) : undefined
      }
      loading={loading}
      toast={
        update.offered ? (
          <Toast
            message={t('update.available')}
            actionLabel={t('update.apply')}
            onAction={() => void applyUpdate()}
          />
        ) : undefined
      }
      bottomBar={!empty}
      actions={<RemettreActions onHandover={handover} onScan={scan} />}
      onMenu={() => void navigate({ to: '/reglages' })}
      onScan={scan}
    >
      {empty ? (
        <EmptyState
          icon="inbox"
          title={t('colis.empty.title')}
          description={t('colis.empty.description')}
          className="mt-[129px]"
        >
          <Button onClick={scan} className="w-[201px]">
            {t('colis.empty.scan')}
          </Button>
          <Button
            variant="link"
            onClick={handover}
            className="text-16 font-semibold"
          >
            {t('colis.empty.handover')}
          </Button>
        </EmptyState>
      ) : undefined}
    </ColisScreen>
  );
}

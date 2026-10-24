import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, ColisScreen, EmptyState, RemettreActions } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { listParcelsQueryOptions } from '#/features/parcels/api/list-parcels';
import { summarize, toSections } from '#/features/parcels/sections';
import { useDelayedPending } from '#/lib/use-delayed-pending';
import { useOnline } from '#/lib/use-online';

const t = createTranslator(DEFAULT_LOCALE);

export function ColisHome() {
  const navigate = useNavigate();
  const online = useOnline();
  const parcels = useQuery(listParcelsQueryOptions);
  const loading = useDelayedPending(parcels.isPending);
  const rows = parcels.data ?? [];
  const empty = parcels.data !== undefined && rows.length === 0;

  const scan = () => void navigate({ to: '/scan' });
  const handover = () => void navigate({ to: '/remise' });

  return (
    <ColisScreen
      sync={online ? 'synced' : 'offline'}
      summary={parcels.data ? summarize(rows) : t('colis.summary.loading')}
      sections={toSections(rows)}
      loading={loading}
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

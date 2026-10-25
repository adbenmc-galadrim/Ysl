import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  ColisScreen,
  EmptyState,
  ListRowValue,
  RemettreActions,
  Toast,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { usePendingParcels } from '#/features/parcels/api/pending-parcels';
import { useHomeParcels } from '#/features/parcels/api/use-parcels';
import { useFoldedSections } from '#/features/parcels/folded-sections';
import {
  sectionId,
  sectionTitles,
  summarize,
  toSections,
} from '#/features/parcels/sections';
import {
  awaitsServer,
  pendingBanner,
  showsPendingBanner,
  syncPill,
} from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';
import { applyUpdate, useUpdate } from '#/features/update/updater';
import { useDelayedPending } from '#/lib/use-delayed-pending';

const t = createTranslator(DEFAULT_LOCALE);

export function ColisHome() {
  const navigate = useNavigate();
  const sync = useSync();
  const update = useUpdate();
  const parcels = useHomeParcels();
  const [folded, toggleFolded] = useFoldedSections();
  // The rows already on the iPhone show at once; only what the server may
  // still send is drawn as a skeleton, and "nothing waits" only once it spoke.
  const waiting = awaitsServer(sync);
  const loading = useDelayedPending(parcels === undefined || waiting);
  const rows = parcels ?? [];
  const empty = parcels !== undefined && rows.length === 0 && !waiting;
  const counted = parcels !== undefined && (rows.length > 0 || !waiting);
  const banner = showsPendingBanner(sync) ? pendingBanner(sync, t) : null;
  const pending = usePendingParcels();
  // Next to the banner, the rows say which parcels its changes are; online,
  // a change leaves within seconds and a label would only flicker.
  const sections = toSections(rows).map((section) =>
    banner
      ? {
          ...section,
          rowAction: (parcel: { id: string }) => {
            const state = pending.get(parcel.id);
            return (
              state && <ListRowValue>{t(`colis.row.${state}`)}</ListRowValue>
            );
          },
        }
      : section,
  );

  const scan = () => void navigate({ to: '/scan' });
  const handover = () => void navigate({ to: '/remise' });

  return (
    <ColisScreen
      sync={syncPill(sync)}
      summary={counted ? summarize(rows) : t('colis.summary.loading')}
      sections={sections}
      folded={sectionTitles(folded)}
      onToggleSection={(title) => {
        const id = sectionId(title);
        if (id) toggleFolded(id);
      }}
      notice={
        banner ? (
          <Banner
            tone={banner.tone}
            icon={banner.icon}
            title={banner.title}
            description={banner.description}
            onClick={() => void navigate({ to: '/reglages/synchronisation' })}
            // Penpot fixes the orange card at 64 px; the red title runs on
            // two lines and needs the card to grow.
            classNames={{
              root: banner.tone === 'orange' ? 'h-16 py-[11px]' : undefined,
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

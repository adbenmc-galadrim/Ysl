import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  ColisScreen,
  EmptyState,
  ListRowValue,
  RemettreActions,
  SearchTrigger,
  Toast,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { useAccess } from '#/features/auth/use-access';
import { db } from '#/features/db/database';
import {
  type HandoverToast,
  useHandoverToast,
} from '#/features/handover/done-toast';
import { dueCount, useReminderMails } from '#/features/mail/reminder-mails';
import { useMailNotes } from '#/features/mail/use-sent-mails';
import { usePendingParcels } from '#/features/parcels/api/pending-parcels';
import {
  listUnaddressed,
  useHomeParcels,
} from '#/features/parcels/api/use-parcels';
import { ColisSelection } from '#/features/parcels/components/colis-selection';
import { assignRecipient } from '#/features/parcels/complete';
import { useFoldedSections } from '#/features/parcels/folded-sections';
import {
  type CounterId,
  counters,
  filterRows,
  sectionId,
  sectionTitles,
  summarize,
  toSections,
} from '#/features/parcels/sections';
import type { Selection } from '#/features/parcels/selection';
import { RecipientChooser } from '#/features/recipient/components/recipient-chooser';
import {
  awaitsServer,
  pendingBanner,
  showsPendingBanner,
  syncPill,
} from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';
import { applyUpdate, useUpdate } from '#/features/update/updater';
import { useDelayedPending } from '#/lib/use-delayed-pending';
import { useOnDesk } from '#/features/shell/components/use-work-path';

const t = createTranslator(DEFAULT_LOCALE);

function conflictMessage({
  firstName,
  byMe,
}: Extract<HandoverToast, { kind: 'conflict' }>): string {
  const by = byMe ? 'mine' : 'colleague';
  return firstName
    ? t(`handover.conflict.${by}`, { name: firstName })
    : t(`handover.conflict.${by}.unnamed`);
}

const NOBODY: ReadonlyMap<string, string | null> = new Map();

export function ColisHome() {
  const navigate = useNavigate();
  const session = useSession();
  const access = useAccess();
  // The scan is on the phone (D23): the computer roles do not get it here.
  const onDesk = useOnDesk();
  const sync = useSync();
  const update = useUpdate();
  const handed = useHandoverToast();
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
  const mails = useMailNotes();
  // F37: the reminders due, counted per person; the app proposes, the
  // agent sends (D2). Read again as the app comes back to the front.
  const reminders = useReminderMails();
  const toRemind = reminders ? dueCount(reminders) : 0;
  // « Choisir » (maquette 05): the parcels « À compléter » nobody is set
  // for, with the name read on their label, open the picker in place.
  const unaddressed = useLiveQuery(() => listUnaddressed(db), [], NOBODY);
  const [choosing, setChoosing] = useState<string | null>(null);
  const withoutAddress = useMemo(
    () =>
      new Set(
        (parcels ?? []).filter((row) => row.noAddress).map((row) => row.id),
      ),
    [parcels],
  );
  // F32: a counter on keeps only its parcels; the sections fold as before.
  const [counter, setCounter] = useState<CounterId | null>(null);
  // F31: a long press on a row, or « Sélectionner », turns the list into
  // checkboxes; the ids ticked when it opens.
  const [selecting, setSelecting] = useState<Selection | null>(null);
  // Next to the banner, the rows say which parcels its changes are; online,
  // a change leaves within seconds and a label would only flicker.
  const labelled = banner !== null;
  const sections = useMemo(
    () =>
      toSections(filterRows(parcels ?? [], counter)).map((section) => ({
        ...section,
        ...(sectionId(section.title) === 'toNotify' && {
          action: (
            <Button
              size="xs"
              className="w-[84px]"
              onClick={() => void navigate({ to: '/notifier' })}
            >
              {t('colis.section.notify')}
            </Button>
          ),
        }),
        // « À relancer » on: one tap prepares every reminder due (F37).
        ...(sectionId(section.title) === 'waiting' &&
          counter === 'remind' && {
            action: (
              <Button
                size="xs"
                variant="warning"
                className="w-[84px]"
                onClick={() =>
                  void navigate({ to: '/notifier', search: { relance: true } })
                }
              >
                {t('colis.section.remind')}
              </Button>
            ),
          }),
        onParcelClick: (parcel: { id: string }) =>
          void navigate({
            to: '/colis/$parcelId',
            params: { parcelId: parcel.id },
          }),
        onParcelLongPress: (parcel: { id: string }) =>
          setSelecting(new Set([parcel.id])),
        rowAction: (parcel: { id: string }) => {
          const state = labelled ? pending.get(parcel.id) : undefined;
          if (state)
            return <ListRowValue>{t(`colis.row.${state}`)}</ListRowValue>;
          // A mail declared not sent never notifies: the parcel stays
          // here, and says why the agent may want to look at it.
          return sectionId(section.title) === 'toNotify' &&
            mails?.failed.has(parcel.id) ? (
            <ListRowValue className="text-red">
              {t('mails.row.failed')}
            </ListRowValue>
          ) : undefined;
        },
        rowControl: (parcel: { id: string }) =>
          withoutAddress.has(parcel.id) &&
          sectionId(section.title) === 'toNotify' ? (
            // « Destinataire sans e-mail » (YSL-72): no mail to prepare, the
            // ways to tell them instead.
            <Button
              variant="warning"
              size="xs"
              className="w-[81px]"
              onClick={() =>
                void navigate({
                  to: '/notifier',
                  search: { colis: parcel.id, prevenir: true },
                })
              }
            >
              {t('colis.row.otherWay')}
            </Button>
          ) : (
            unaddressed.has(parcel.id) &&
            !(labelled && pending.has(parcel.id)) && (
              // « Ce n'est pas pour moi » (YSL-70): the same picker, worded
              // as the maquette 09 does.
              <Button
                variant="danger"
                size="xs"
                className={
                  sectionId(section.title) === 'replies'
                    ? 'w-[112px]'
                    : 'w-[81px]'
                }
                onClick={() => setChoosing(parcel.id)}
              >
                {sectionId(section.title) === 'replies'
                  ? t('colis.row.reassign')
                  : t('colis.row.choose')}
              </Button>
            )
          ),
      })),
    [
      parcels,
      counter,
      labelled,
      pending,
      mails,
      navigate,
      unaddressed,
      withoutAddress,
    ],
  );
  const foldedTitles = useMemo(() => sectionTitles(folded), [folded]);

  const handover = () => void navigate({ to: '/remise' });
  // A department scans the QR of whoever collects (D23), not labels.
  const scan = access.receives
    ? () => void navigate({ to: '/scan' })
    : handover;
  const searchParcels = () => void navigate({ to: '/recherche' });

  if (selecting) {
    return (
      <ColisSelection
        rows={rows}
        counter={counter}
        onCounter={setCounter}
        initial={selecting}
        onDone={() => setSelecting(null)}
      />
    );
  }

  return (
    <>
      <ColisScreen
        sync={syncPill(sync)}
        summary={counted ? summarize(rows) : t('colis.summary.loading')}
        sections={sections}
        counters={
          empty
            ? undefined
            : counters(rows, counter).map(({ id, label, count }) => ({
                label,
                count,
                selected: id === counter,
                onClick: () => setCounter(id === counter ? null : id),
              }))
        }
        folded={foldedTitles}
        onToggleSection={(title) => {
          const id = sectionId(title);
          if (id) toggleFolded(id);
        }}
        notice={
          !banner && mails?.stale ? (
            <Banner
              tone="orange"
              icon="mail"
              title={
                mails.stale === 1
                  ? t('mails.stale.one')
                  : t('mails.stale.many', { count: mails.stale })
              }
              description={t('mails.stale.description')}
              onClick={() =>
                void navigate({
                  to: '/reglages/e-mails',
                  search: { filtre: 'toConfirm' },
                })
              }
              classNames={{
                root: 'h-16 py-[11px]',
                description: 'mt-[3px] leading-4',
              }}
            />
          ) : !banner && toRemind > 0 ? (
            <Banner
              tone="orange"
              icon="clock"
              title={
                toRemind === 1
                  ? t('colis.remind.one')
                  : t('colis.remind.many', { count: toRemind })
              }
              description={t('colis.remind.description')}
              onClick={() => void navigate({ to: '/relances' })}
              classNames={{
                root: 'h-16 py-[11px]',
                description: 'mt-[3px] leading-4',
              }}
            />
          ) : banner ? (
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
          handed ? (
            <Toast
              message={
                handed.kind === 'cancelled'
                  ? handed.count > 1
                    ? t('handover.cancel.done.many', { count: handed.count })
                    : t('handover.cancel.done.one')
                  : conflictMessage(handed)
              }
            />
          ) : update.offered ? (
            <Toast
              message={t('update.available')}
              actionLabel={t('update.apply')}
              onAction={() => void applyUpdate()}
            />
          ) : undefined
        }
        bottomBar={!empty}
        actions={
          onDesk ? (
            <>
              <SearchTrigger
                size="dock"
                onClick={searchParcels}
                className="min-w-0 flex-1"
              />
              {access.handsOver && (
                <Button
                  variant="secondary"
                  icon="qr"
                  iconSize={20}
                  onClick={handover}
                  className="w-[145px] gap-2 text-16"
                >
                  {t('colis.handover')}
                </Button>
              )}
            </>
          ) : access.receives && access.handsOver ? (
            <RemettreActions
              onSearch={searchParcels}
              onHandover={handover}
              onScan={scan}
            />
          ) : undefined
        }
        onMenu={() => void navigate({ to: '/reglages' })}
        onSelect={empty ? undefined : () => setSelecting(new Set())}
        onSearch={searchParcels}
        onScan={scan}
      >
        {empty ? (
          <EmptyState
            icon="inbox"
            title={t('colis.empty.title')}
            description={
              access.receives
                ? t('colis.empty.description')
                : t('colis.empty.description.department')
            }
            className="mt-[129px]"
          >
            {access.receives && !onDesk && (
              <Button onClick={scan} className="w-[201px]">
                {t('colis.empty.scan')}
              </Button>
            )}
            {access.handsOver && (
              <Button
                variant={access.receives && !onDesk ? 'link' : undefined}
                onClick={handover}
                className={
                  access.receives && !onDesk
                    ? 'text-16 font-semibold'
                    : 'w-[201px]'
                }
              >
                {t('colis.empty.handover')}
              </Button>
            )}
          </EmptyState>
        ) : undefined}
      </ColisScreen>
      {choosing && (
        <RecipientChooser
          readName={unaddressed.get(choosing)}
          onClose={() => setChoosing(null)}
          onPick={async (pick) => {
            const parcelId = choosing;
            await assignRecipient(
              db,
              parcelId,
              pick.kind === 'card'
                ? { kind: pick.choice.kind, id: pick.choice.id }
                : { ...pick, kind: 'typed' },
              // Only the name shows here: a number still in doubt stays so.
              {
                agentId: session.user.id,
                seesTracking: false,
                learns: access.receives,
              },
            );
            setChoosing(null);
          }}
        />
      )}
    </>
  );
}

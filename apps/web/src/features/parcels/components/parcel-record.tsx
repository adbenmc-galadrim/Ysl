import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  EmptyState,
  FicheColisScreen,
  type FicheColisPhoto,
  PhotoViewer,
  Screen,
  Sheet,
} from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import {
  type PhotoUrl,
  useLabelPhotoUrl,
  useParcelRecord,
} from '#/features/parcels/api/parcel-record';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import {
  describeRecord,
  type RecordAction,
  stepBackLabel,
} from '#/features/parcels/record';
import { changeParcelStatus, deleteParcel } from '#/features/parcels/status';
import { showsPendingBanner } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';

const t = createTranslator(DEFAULT_LOCALE);

type Confirm = 'delete' | Extract<RecordAction, { kind: 'stepBack' }>;

function photoOf(url: PhotoUrl, onOpen: () => void): FicheColisPhoto {
  switch (url.state) {
    case 'loading':
      return { loading: true };
    case 'absent':
      return { absent: t('record.photo.absent') };
    case 'ready':
      return { src: url.url, alt: t('record.photo.alt'), onOpen };
  }
}

const UNDO_DESCRIPTION: Record<'notifie' | 'retourne', string> = {
  notifie: t('record.undo.description.notifie'),
  retourne: t('record.undo.description.retourne'),
};

/**
 * A parcel's record (F29), opened from a row of Colis or of the search:
 * what was read, where it stands, the photo, what happened. Every change
 * is written on the iPhone first and leaves with the next sync.
 */
export function ParcelRecordView({ parcelId }: { parcelId: string }) {
  const navigate = useNavigate();
  const router = useRouter();
  const session = useSession();
  const sync = useSync();
  const now = useMinuteClock();
  const record = useParcelRecord(parcelId);
  const [viewing, setViewing] = useState(false);
  const photoUrl = useLabelPhotoUrl(parcelId);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const back = () => {
    if (router.history.canGoBack()) router.history.back();
    else void navigate({ to: '/' });
  };

  if (record === undefined) return <Screen>{null}</Screen>;
  if (record === null) {
    return (
      <Screen>
        <EmptyState
          icon="package"
          title={t('record.missing.title')}
          description={t('record.missing.description')}
          className="mt-[129px]"
        >
          <Button
            variant="link"
            onClick={() => void navigate({ to: '/' })}
            className="text-16 font-semibold"
          >
            {t('record.missing.back')}
          </Button>
        </EmptyState>
      </Screen>
    );
  }

  const view = describeRecord(record, {
    now,
    t,
    showUnsent: showsPendingBanner(sync, now),
  });
  const edit = () =>
    void navigate({
      to: '/colis/$parcelId/modifier',
      params: { parcelId },
    });
  const photo = photoOf(photoUrl, () => setViewing(true));
  const options = { agentId: session.user.id };

  const run = async (change: () => Promise<unknown>, after?: () => void) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      await change();
      setConfirm(null);
      after?.();
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  const sheet =
    confirm &&
    (confirm === 'delete' ? (
      <Sheet
        fixed
        title={t('record.delete.title')}
        description={
          failed ? t('record.error.write') : t('record.delete.description')
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setConfirm(null)}
      >
        <Button
          variant="destructive"
          block
          disabled={busy}
          className="mt-6"
          onClick={() =>
            void run(() => deleteParcel(db, parcelId, options), back)
          }
        >
          {t('record.delete.confirm')}
        </Button>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setConfirm(null)}
        >
          {t('record.cancel')}
        </Button>
      </Sheet>
    ) : (
      <Sheet
        fixed
        title={`${stepBackLabel(confirm.from, t)} ?`}
        description={
          failed ? t('record.error.write') : UNDO_DESCRIPTION[confirm.from]
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setConfirm(null)}
      >
        <Button
          block
          disabled={busy}
          className="mt-6"
          onClick={() =>
            void run(() =>
              changeParcelStatus(db, parcelId, confirm.to, options),
            )
          }
        >
          {stepBackLabel(confirm.from, t)}
        </Button>
        <Button
          variant="secondary"
          block
          className="mt-3"
          onClick={() => setConfirm(null)}
        >
          {t('record.cancel')}
        </Button>
      </Sheet>
    ));

  const action = view.action;
  return (
    <FicheColisScreen
      {...view}
      photo={photo}
      primaryAction={
        action?.kind === 'complete' ? t('record.action.complete') : undefined
      }
      onPrimaryAction={edit}
      secondaryAction={
        action?.kind === 'stepBack'
          ? {
              label: stepBackLabel(action.from, t),
              onClick: () => {
                setFailed(false);
                setConfirm(action);
              },
            }
          : undefined
      }
      onDelete={() => {
        setFailed(false);
        setConfirm('delete');
      }}
      onBack={back}
      onEdit={edit}
      overlay={
        <>
          {sheet}
          {viewing && photoUrl.state === 'ready' && (
            <PhotoViewer
              src={photoUrl.url}
              alt={t('record.photo.alt')}
              closeLabel={t('record.photo.close')}
              onClose={() => setViewing(false)}
            />
          )}
        </>
      }
    />
  );
}

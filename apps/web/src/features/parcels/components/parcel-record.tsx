import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  EmptyState,
  FicheColisScreen,
  type FicheColisDamage,
  type FicheColisPhoto,
  PhotoViewer,
  Screen,
  Sheet,
} from '@repo/ui';
import { useNavigate, useRouter } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { useDamagePhotoUrls } from '#/features/damage/api/damage-photos';
import { proofMediaItems, useProofUrls } from '#/features/handover/proof-urls';
import { liftDamage } from '#/features/damage/report';
import { db } from '#/features/db/database';
import type { LocalParcel } from '#/features/db/schema';
import { ContactSheet } from '#/features/directory/components/contact-sheet';
import {
  type PhotoUrl,
  useLabelPhotoUrl,
  useParcelRecord,
} from '#/features/parcels/api/parcel-record';
import { lastMailLine } from '#/features/mail/tracking';
import { useLatestMail } from '#/features/mail/use-sent-mails';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { CompleteParcel } from '#/features/parcels/components/complete-parcel';
import { addressMissing } from '#/features/parcels/model';
import {
  describeRecord,
  type RecordAction,
  type RecordDamage,
  stepBackLabel,
} from '#/features/parcels/record';
import { changeParcelStatus, deleteParcel } from '#/features/parcels/status';
import { answeredWith } from '#/features/replies/record';
import { EmployeeReply } from '#/features/replies/components/employee-reply';
import { showsPendingBanner } from '#/features/sync/sync-value';
import { useSync } from '#/features/sync/use-sync';

const t = createTranslator(DEFAULT_LOCALE);

type Confirm = 'delete' | 'lift' | Extract<RecordAction, { kind: 'stepBack' }>;

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

/** The reserve card: its photos when this iPhone has them, else where they are. */
function damageCardOf(
  damage: RecordDamage,
  urls: { id: string; url: string }[] | undefined,
  onOpen: (url: string) => void,
  onLift: () => void,
): FicheColisDamage {
  const here = urls ?? [];
  return {
    title: damage.title,
    description: damage.description,
    photos: here.map(({ url }, index) => ({
      src: url,
      alt: t('record.damage.photo.alt', { n: index + 1 }),
      onOpen: () => onOpen(url),
    })),
    photosAbsent:
      urls && here.length === 0 && damage.photos > 0
        ? damage.photos === 1
          ? t('record.damage.photos.absent.one')
          : t('record.damage.photos.absent.other', { count: damage.photos })
        : undefined,
    onLift,
  };
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
  const [viewingDamage, setViewingDamage] = useState<string | null>(null);
  const damagedAt = record?.parcel.damagedAt ?? null;
  const damageUrls = useDamagePhotoUrls(parcelId, damagedAt);
  const proofUrls = useProofUrls(
    (record?.handover ?? record?.cancelledHandover)?.id ?? '',
  );
  const [viewingProof, setViewingProof] = useState<string | null>(null);
  const lastMail = useLatestMail(parcelId);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [completing, setCompleting] = useState(false);
  const [addingEmail, setAddingEmail] = useState(false);
  // Frozen at the tap: « pas pour moi » takes the parcel out of the live
  // list while its sheet still has the recipient to choose.
  const [replying, setReplying] = useState<LocalParcel[] | null>(null);
  // The recipient answers for all their parcels the e-mails told about.
  const answered = useLiveQuery(() => answeredWith(db, parcelId), [parcelId]);
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
    me: session.user.id,
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
    (confirm === 'lift' ? (
      <Sheet
        fixed
        title={t('record.lift.title')}
        description={
          failed ? t('record.error.write') : t('record.lift.description')
        }
        className="pb-[calc(var(--safe-bottom)+16px)]"
        onDismiss={() => setConfirm(null)}
      >
        <Button
          block
          disabled={busy}
          className="mt-6"
          onClick={() => void run(() => liftDamage(db, parcelId, options))}
        >
          {t('record.lift.confirm')}
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
    ) : confirm === 'delete' ? (
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

  const { action, damage, ...shown } = view;
  const handoverId = (record.handover ?? record.cancelledHandover)?.id;
  // « Sans e-mail »: the address goes on the contact, for this parcel and
  // the next ones, and the record shows it at once.
  const withAddress = addressMissing(record)
    ? shown.details.map((item) =>
        item.label === t('record.detail.email')
          ? {
              ...item,
              value: (
                <button
                  type="button"
                  className="text-blue"
                  onClick={() => setAddingEmail(true)}
                >
                  {t('record.email.add')}
                </button>
              ),
            }
          : item,
      )
    : shown.details;
  // The last mail about the parcel, a tap from the sending log.
  // Only the agent who wrote the mail can act on it from the log; a
  // colleague's mail is said, not linked.
  const details = lastMail
    ? [
        ...withAddress,
        {
          label: t('record.mail'),
          value:
            lastMail.preparedBy === session.user.id ? (
              <button
                type="button"
                className="text-blue"
                onClick={() =>
                  void navigate({
                    to: '/reglages/e-mails',
                    search: { colis: parcelId },
                  })
                }
              >
                {lastMailLine(lastMail, now, t)}
              </button>
            ) : (
              lastMailLine(lastMail, now, t)
            ),
        },
      ]
    : withAddress;
  return (
    <FicheColisScreen
      {...shown}
      handover={
        shown.handover && handoverId !== undefined
          ? {
              ...shown.handover,
              media: {
                items: proofMediaItems(
                  proofUrls,
                  {
                    signature: t('handover.proof.signature'),
                    photo: t('handover.proof.photo'),
                  },
                  setViewingProof,
                ),
              },
              onOpen: () =>
                void navigate({
                  to: '/reglages/remises/$handoverId',
                  params: { handoverId },
                }),
            }
          : undefined
      }
      details={details}
      photo={photo}
      damage={
        damage &&
        damageCardOf(damage, damageUrls, setViewingDamage, () => {
          setFailed(false);
          setConfirm('lift');
        })
      }
      onReportDamage={() =>
        void navigate({ to: '/colis/$parcelId/dommage', params: { parcelId } })
      }
      onShowReading={() =>
        void navigate({ to: '/colis/$parcelId/lecture', params: { parcelId } })
      }
      primaryAction={
        action?.kind === 'complete'
          ? t('record.action.complete')
          : action?.kind === 'notify'
            ? t('record.action.notify')
            : undefined
      }
      onPrimaryAction={
        action?.kind === 'notify'
          ? () =>
              void navigate({ to: '/notifier', search: { colis: parcelId } })
          : action?.kind === 'complete'
            ? () => setCompleting(true)
            : edit
      }
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
      replyAction={
        answered?.length
          ? {
              label: t('record.action.reply'),
              onClick: () => setReplying(answered),
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
          {addingEmail && record.contact && (
            <ContactSheet
              contact={record.contact}
              addingEmail
              onDone={() => setAddingEmail(false)}
              onDismiss={() => setAddingEmail(false)}
            />
          )}
          {replying && (
            <EmployeeReply
              parcels={replying}
              recipient={shown.recipient}
              onClose={() => setReplying(null)}
            />
          )}
          {completing && (
            <CompleteParcel
              parcel={record.parcel}
              onEdit={() => {
                setCompleting(false);
                edit();
              }}
              onClose={() => setCompleting(false)}
            />
          )}
          {viewing && photoUrl.state === 'ready' && (
            <PhotoViewer
              src={photoUrl.url}
              alt={t('record.photo.alt')}
              closeLabel={t('record.photo.close')}
              onClose={() => setViewing(false)}
            />
          )}
          {viewingDamage && (
            <PhotoViewer
              src={viewingDamage}
              alt={t('record.damage.photo.alt', {
                n:
                  (damageUrls?.findIndex(({ url }) => url === viewingDamage) ??
                    0) + 1,
              })}
              closeLabel={t('record.photo.close')}
              onClose={() => setViewingDamage(null)}
            />
          )}
          {viewingProof && (
            <PhotoViewer
              src={viewingProof}
              alt={t('handover.proof.photo')}
              closeLabel={t('record.photo.close')}
              onClose={() => setViewingProof(null)}
            />
          )}
        </>
      }
    />
  );
}

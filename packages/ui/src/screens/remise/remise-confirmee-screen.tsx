import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import type { CheckListItem } from '#components/check-list';
import { DetailsList } from '#components/details-list';
import { DoneDisc, ProofCard } from '#components/phone-parts';
import { ProofMedia, type ProofMediaProps } from '#components/proof-media';
import { Screen } from '#components/screen';
import { SYNC_PILL, StatusPill } from '#components/status-pill';
import { Toast } from '#components/toast';

/** A parcel handed over: "Zalando", "DPD ···4471". */
export type RemiseConfirmeeParcel = {
  id: string;
  title: string;
  detail: string;
};

export type RemiseConfirmeeScreenProps = {
  /** "3 colis remis". */
  title: string;
  /** "à Nora Haddad, à 11 h 21". */
  description: string;
  proofs: CheckListItem[];
  /** The signature and the photo, under the proofs, once taken. */
  media?: ProofMediaProps;
  /** The parcels the handover lists, under the proofs. */
  parcels?: RemiseConfirmeeParcel[];
  /** The iPhone is offline: the handover waits on it, said at the top. */
  offline?: boolean;
  /** Shows the undo toast while the handover can still be cancelled. */
  undoable?: boolean;
  undoLabel?: string;
  onUndo?: () => void;
  /** A grey button beside "Terminé": straight back to the viewfinder. */
  onAnother?: () => void;
  /**
   * Handovers queued from a selection: the next person, in place of
   * « Remettre un autre », above a grey « Terminé ».
   */
  next?: { label: string; onClick: () => void };
  onDone?: () => void;
};

/**
 * The end of a handover. The proofs are listed so the agent can tell the
 * recipient it is all recorded; the undo stays a toast — a mistake caught
 * at the desk is fixed in one tap, without a menu.
 */
export function RemiseConfirmeeScreen({
  title,
  description,
  proofs,
  media,
  parcels,
  offline = false,
  undoable = true,
  undoLabel = 'Annuler',
  onUndo,
  onAnother,
  next,
  onDone,
}: RemiseConfirmeeScreenProps) {
  return (
    <Screen
      bottomInset={next ? 240 : 180}
      bottom={
        <BottomBar surface="plain" className="flex-col gap-9 pt-0 pb-9">
          {undoable && (
            <Toast
              message="Remise enregistrée"
              actionLabel={undoLabel}
              onAction={onUndo}
              className="w-full rounded-[14px] px-4 [&>button]:text-white"
            />
          )}
          {next ? (
            <div className="flex w-full flex-col gap-3">
              <Button block onClick={next.onClick} className="truncate">
                {next.label}
              </Button>
              <Button variant="secondary" block onClick={onDone}>
                Terminé
              </Button>
            </div>
          ) : (
            <div className="flex w-full gap-3">
              {onAnother && (
                <Button
                  variant="secondary"
                  className="min-w-0 flex-1"
                  onClick={onAnother}
                >
                  Remettre un autre
                </Button>
              )}
              <Button className="min-w-0 flex-1" onClick={onDone}>
                Terminé
              </Button>
            </div>
          )}
        </BottomBar>
      }
    >
      {offline && (
        <StatusPill {...SYNC_PILL.offline} className="mt-3 self-center" />
      )}
      <DoneDisc
        className={
          offline || parcels?.length
            ? 'mt-[clamp(16px,calc(100dvh-790px),92px)]'
            : 'mt-[clamp(24px,calc(100dvh-690px),92px)]'
        }
      />
      <h1 className="mt-6 text-center text-28 font-bold">{title}</h1>
      <p className="mt-1.5 text-center text-15 text-muted">{description}</p>
      <ProofCard items={proofs} />
      {media && <ProofMedia {...media} className="mt-3 px-1" />}
      {parcels && parcels.length > 0 && (
        <DetailsList
          title="Colis remis"
          items={parcels.map((parcel) => ({
            label: parcel.title,
            value: parcel.detail,
          }))}
          className="mt-6"
        />
      )}
    </Screen>
  );
}

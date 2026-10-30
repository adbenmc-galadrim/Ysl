import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CheckList, type CheckListItem } from '#components/check-list';
import { DetailsList } from '#components/details-list';
import { ProofMedia, type ProofMediaProps } from '#components/proof-media';
import { ResultHero } from '#components/result-hero';
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
        <BottomBar surface="none" className="flex-col gap-7">
          {undoable && (
            <Toast
              message="Remise enregistrée"
              actionLabel={undoLabel}
              onAction={onUndo}
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
      {/* 162 px down on the mockup's phone; on a shorter one the hero rises
          so the proofs stay clear of the toast. The parcel list (about
          100 px) and the offline pill (44 px) take their room from it. */}
      <ResultHero
        title={title}
        description={description}
        className={
          offline
            ? 'mt-[clamp(16px,calc(100dvh-850px),118px)]'
            : parcels?.length
              ? 'mt-[clamp(24px,calc(100dvh-790px),162px)]'
              : 'mt-[clamp(24px,calc(100dvh-690px),162px)]'
        }
      />
      <CheckList items={proofs} className="mt-[34px]" />
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

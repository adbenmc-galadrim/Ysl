import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { Chip, ChipGroup } from '#components/chip';
import { Field, FieldInput } from '#components/field';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Sheet } from '#components/sheet';
import type { Parcel } from '#fixtures/parcels';

export const CANCEL_REASONS = [
  'Mauvais colis',
  'Mauvaise personne',
  'Erreur de saisie',
] as const;

export type AnnulerRemiseScreenProps = {
  /** The handed-over parcel whose record the sheet opens on, drawn behind it. */
  parcel?: Parcel;
  /** Over the app: the screen it opened from stays mounted under the sheet. */
  fixed?: boolean;
  onDismiss?: () => void;
  /** "Remis hier à 9 h 12". */
  handedOver: string;
  /** "À Malik Benali, QR code vérifié, par Karim". */
  proof: string;
  reason?: string;
  onReasonChange?: (reason: string) => void;
  note?: string;
  onNoteChange?: (note: string) => void;
  onConfirm?: () => void;
  /** "Le colis repasse en attente de retrait": a handover may hold several. */
  backTitle?: string;
};

/**
 * Undoing a handover after the toast is gone. It is a sheet over the parcel
 * record, not a screen of its own: the agent sees which handover is being
 * undone, picks a reason in one tap, and the red button says it plainly.
 * The record keeps the cancellation, so nothing is erased.
 */
export function AnnulerRemiseScreen({
  parcel,
  fixed = false,
  onDismiss,
  handedOver,
  proof,
  reason,
  onReasonChange,
  note,
  onNoteChange,
  onConfirm,
  backTitle = 'Le colis repasse en attente de retrait',
}: AnnulerRemiseScreenProps) {
  return (
    <Sheet
      title="Annuler la remise ?"
      scrimClassName="bg-black/35"
      className="pb-[calc(var(--safe-bottom)-2px)]"
      fixed={fixed}
      onDismiss={onDismiss}
      behind={
        parcel && (
          <Screen>
            <NavBar />
            <h1 className="mt-3.5 text-32 font-bold">{parcel.recipient}</h1>
            <p className="mt-1 text-15 text-muted">
              {parcel.department}, {parcel.carrier} ···{parcel.last4}
            </p>
          </Screen>
        )
      }
    >
      <Banner
        tone="green"
        icon="check"
        title={handedOver}
        description={proof}
        // Penpot draws these boxes at a fixed height with the text from the
        // top, so the icon is placed on the box rather than on the text.
        classNames={{
          root: 'h-16 items-start pb-0',
          icon: 'mt-2',
          description: 'leading-[18px]',
        }}
        className="mt-2.5"
      />
      <Field label="Pourquoi ?" className="mt-5">
        <ChipGroup label="Motif">
          {CANCEL_REASONS.map((r) => (
            <Chip
              key={r}
              selected={r === reason}
              onClick={() => onReasonChange?.(r)}
              className="px-5"
            >
              {r}
            </Chip>
          ))}
        </ChipGroup>
      </Field>
      <Field label="Précision" className="mt-[18px]">
        {(id) => (
          <FieldInput
            id={id}
            value={note}
            placeholder="Facultatif"
            onChange={(e) => onNoteChange?.(e.target.value)}
          />
        )}
      </Field>
      <Banner
        tone="blue"
        icon="info"
        title={backTitle}
        description="L’annulation reste dans l’historique, avec son motif."
        classNames={{
          root: 'h-[72px] items-start pb-0',
          icon: 'mt-3',
          description: 'leading-[18px]',
        }}
        className="mt-6"
      />
      <Button
        variant="destructive"
        block
        disabled={!reason}
        onClick={onConfirm}
        // The sheet is drawn 616 px tall; this gap is what gives on a short phone.
        className="mt-[clamp(24px,calc(100dvh-760px),92px)]"
      >
        Annuler la remise
      </Button>
    </Sheet>
  );
}

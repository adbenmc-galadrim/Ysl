import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { Chip, ChipGroup } from '#components/chip';
import { Field, FieldInput } from '#components/field';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { PhotoPicker } from '#components/photo-picker';
import { Screen } from '#components/screen';
import { SwitchRow } from '#components/switch-row';
import type { Parcel } from '#fixtures/parcels';

export type ColisAbimeScreenProps = {
  parcel: Parcel;
  reasons: readonly string[];
  reason?: string;
  onReasonChange?: (reason: string) => void;
  /** Photos taken so far, as 104 px thumbnails. */
  photos?: ReactNode;
  onAddPhoto?: () => void;
  remark?: string;
  onRemarkChange?: (remark: string) => void;
  /** Mention the damage in the pickup e-mail. */
  notifyRecipient: boolean;
  onNotifyRecipientChange?: (value: boolean) => void;
  /** Record a reserve with the carrier, for a claim. */
  carrierReserve: boolean;
  onCarrierReserveChange?: (value: boolean) => void;
  onClose?: () => void;
  onSave?: () => void;
};

/**
 * Reporting a parcel that arrived damaged. Proof first — a reason, a photo
 * — because a claim with the carrier is only accepted with it; then who
 * should hear about it. The employee is warned by default: finding a crushed
 * box at the counter is worse than reading about it beforehand.
 */
export function ColisAbimeScreen({
  parcel,
  reasons,
  reason,
  onReasonChange,
  photos,
  onAddPhoto,
  remark,
  onRemarkChange,
  notifyRecipient,
  onNotifyRecipientChange,
  carrierReserve,
  onCarrierReserveChange,
  onClose,
  onSave,
}: ColisAbimeScreenProps) {
  return (
    <Screen
      bottom={
        <BottomBar>
          <Button block disabled={!reason} onClick={onSave}>
            Enregistrer le dommage
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        title="Signaler un dommage"
        leading={
          // The leading slot pads for text actions; the square hangs into
          // the gutter like the back square instead.
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
            className="-ml-0.5"
          />
        }
      />
      <p className="mt-3 text-15 text-muted">
        {parcel.recipient}, {parcel.carrier} ···{parcel.last4}
      </p>
      <h2 className="mt-2.5 text-22 font-bold">Qu’est-ce qui ne va pas ?</h2>
      <ChipGroup label="Dommage" className="mt-[18px]">
        {reasons.map((item) => (
          <Chip
            key={item}
            selected={item === reason}
            onClick={() => onReasonChange?.(item)}
          >
            {item}
          </Chip>
        ))}
      </ChipGroup>

      <section className="mt-[26px] flex flex-col">
        <h3 className="text-13 font-medium text-muted">Photos du dommage</h3>
        <PhotoPicker onAdd={onAddPhoto} className="mt-2">
          {photos}
        </PhotoPicker>
      </section>

      <Field label="Remarque" className="mt-6">
        {(id) => (
          <FieldInput
            id={id}
            value={remark}
            onChange={(event) => onRemarkChange?.(event.target.value)}
            placeholder="Ce que vous voyez"
          />
        )}
      </Field>

      <div className="mt-9 flex flex-col gap-3">
        <SwitchRow
          label="Prévenir dans l’e-mail au salarié"
          checked={notifyRecipient}
          onCheckedChange={onNotifyRecipientChange}
        />
        <SwitchRow
          label="Réserve auprès du transporteur"
          checked={carrierReserve}
          onCheckedChange={onCarrierReserveChange}
        />
      </div>
    </Screen>
  );
}

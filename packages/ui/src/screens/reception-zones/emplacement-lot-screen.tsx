import { Button } from '#components/button';
import { ChoiceTile, ChoiceTileGrid } from '#components/choice-tile';
import type { ParcelLabelProps } from '#components/parcel-label';
import { Sheet } from '#components/sheet';
import { ScanScreen } from '#screens/reception/scan-screen';

export type EmplacementLotScreenProps = {
  /** Parcels in the batch so far, shown in the camera's top bar. */
  count: number;
  /** The label the camera was pointed at when the sheet opened. */
  label: ParcelLabelProps;
  locations: readonly string[];
  /** The location picked, if any. */
  value?: string;
  onChange?: (location: string) => void;
  onAddLocation?: () => void;
  onStart?: () => void;
};

/**
 * Asked once, as the batch starts: where this delivery is going to be put
 * away. Every parcel scanned inherits it, so the agent does not answer the
 * same question twelve times — and can still change one parcel afterwards.
 */
export function EmplacementLotScreen({
  count,
  label,
  locations,
  value,
  onChange,
  onAddLocation,
  onStart,
}: EmplacementLotScreenProps) {
  return (
    <Sheet
      title="Où rangez-vous ce lot ?"
      description="Appliqué à tous les colis du lot. Modifiable colis par colis."
      behind={
        <ScanScreen
          count={count}
          label={label}
          reading={{ kind: 'idle' }}
          controls={false}
          dim={0.4}
        />
      }
    >
      <ChoiceTileGrid label="Emplacement du lot" className="mt-1">
        {locations.map((location) => (
          <ChoiceTile
            key={location}
            label={location}
            selected={location === value}
            onClick={() => onChange?.(location)}
          />
        ))}
      </ChoiceTileGrid>
      <Button
        variant="link"
        className="mt-[26px] self-start text-16 font-semibold"
        onClick={onAddLocation}
      >
        + Ajouter un emplacement
      </Button>
      <Button block className="mt-[53px]" disabled={!value} onClick={onStart}>
        Commencer le lot
      </Button>
    </Sheet>
  );
}

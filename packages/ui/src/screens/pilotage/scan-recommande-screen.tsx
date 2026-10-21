import {
  CameraControls,
  CameraTool,
  CameraTopBar,
} from '#components/camera-controls';
import { CameraPanel } from '#components/camera-panel';
import { CameraViewport } from '#components/camera-viewport';
import {
  ParcelBox,
  ParcelLabel,
  type ParcelLabelProps,
} from '#components/parcel-label';
import { ScanFields, type ScanField } from '#components/scan-fields';
import { SegmentedControl } from '#components/segmented-control';

export const MAIL_KINDS = ['Colis', 'Recommandé', 'Courrier'] as const;
export type MailKind = (typeof MAIL_KINDS)[number];

export type ScanRecommandeScreenProps = {
  /** Items in the batch so far. */
  count: number;
  kind: MailKind;
  /** The letter's label under the camera. */
  label: ParcelLabelProps;
  /** "Lettre recommandée avec avis de réception". */
  title: string;
  fields: ScanField[];
  onKindChange?: (kind: MailKind) => void;
};

/**
 * Registered mail goes through the same scanner as parcels: the agent picks
 * "Recommandé" over the camera and the reading switches to the La Poste
 * number, the sender and the department it is for — what the signed receipt
 * needs.
 */
export function ScanRecommandeScreen({
  count,
  kind,
  label,
  title,
  fields,
  onKindChange,
}: ScanRecommandeScreenProps) {
  return (
    <CameraViewport
      subject={
        <ParcelBox tone="envelope">
          <ParcelLabel {...label} />
        </ParcelBox>
      }
    >
      <CameraTopBar title={`Lot : ${count} colis`} />
      <SegmentedControl
        tone="night"
        label="Type d’envoi"
        options={MAIL_KINDS}
        value={kind}
        onChange={onKindChange}
        className="mx-auto mt-3 w-full max-w-[301px]"
      />

      <div className="flex-1" />

      <CameraPanel className="mx-4 px-4 pt-3.5 pb-4">
        <p className="text-14 font-semibold">{title}</p>
        {/* Three short fields: a tighter pitch and label column than the
            parcel reading, so the panel clears the tools row. */}
        <ScanFields
          fields={fields}
          className="mt-2.5 gap-[9px] [&_dt]:w-[90px]"
        />
      </CameraPanel>
      <CameraControls
        count={count}
        tools={{
          start: <CameraTool icon="image" label="Importer une photo" />,
          end: <CameraTool icon="keyboard" label="Saisir le numéro" />,
        }}
      />
    </CameraViewport>
  );
}

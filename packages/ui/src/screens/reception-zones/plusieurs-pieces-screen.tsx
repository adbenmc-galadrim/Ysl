import {
  CameraControls,
  CameraTool,
  CameraTopBar,
} from '#components/camera-controls';
import {
  CameraNoticeButton,
  CameraPanel,
  LastScanPanel,
} from '#components/camera-panel';
import { CameraViewport } from '#components/camera-viewport';
import {
  ParcelBox,
  ParcelLabel,
  type ParcelLabelProps,
} from '#components/parcel-label';
import { PieceDots } from '#components/piece-dots';

export type PlusieursPiecesScreenProps = {
  /** Parcels in the batch so far. */
  count: number;
  /** The label the camera is pointed at: one of the pieces. */
  label: ParcelLabelProps;
  /** The parcel the pieces belong to. */
  parcel: { recipient: string; meta: string };
  /** Pieces announced on the label ("1 of 3") and pieces read so far. */
  pieces: { total: number; read: number };
  onSavePartial?: () => void;
};

/** "La 3e pièce manque" for one gap, "2 pièces manquent" for more. */
function missingLabel({ total, read }: { total: number; read: number }) {
  const missing = total - read;
  return missing === 1
    ? `La ${read + 1}e pièce manque`
    : `${missing} pièces manquent`;
}

/**
 * A parcel delivered as several boxes carries one tracking number on each.
 * Reading the same number again is then not a duplicate but the next piece,
 * so the pieces gather under one parcel and the dots show which are still
 * on the trolley. A piece that never came can be left out on purpose.
 */
export function PlusieursPiecesScreen({
  count,
  label,
  parcel,
  pieces,
  onSavePartial,
}: PlusieursPiecesScreenProps) {
  const complete = pieces.read >= pieces.total;
  return (
    <CameraViewport
      subject={
        <ParcelBox>
          <ParcelLabel {...label} />
        </ParcelBox>
      }
    >
      <CameraTopBar title={`Lot : ${count} colis`} />
      <LastScanPanel
        className="mx-4 mt-3.5"
        caption={`Colis en ${pieces.total} pièces`}
        title={parcel.recipient}
        meta={parcel.meta}
        trailing={<PieceDots total={pieces.total} read={pieces.read} />}
      />

      <div className="flex-1" />

      <CameraPanel role="status" className="mx-4 px-4 pt-3.5 pb-3">
        <p className="text-16 font-semibold">
          Pièce {pieces.read} sur {pieces.total} lue
        </p>
        <p className="mt-[5px] text-14 text-night-muted">
          Même numéro : pièces regroupées en un colis.
        </p>
        {!complete && (
          <CameraNoticeButton
            onClick={onSavePartial}
            className="mt-[13px] h-[30px] w-full text-13"
          >
            {missingLabel(pieces)} : enregistrer {pieces.read} sur{' '}
            {pieces.total}
          </CameraNoticeButton>
        )}
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

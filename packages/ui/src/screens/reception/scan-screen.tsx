import { Button } from '#components/button';
import {
  CameraControls,
  CameraTool,
  CameraTopBar,
} from '#components/camera-controls';
import {
  CameraNotice,
  CameraNoticeButton,
  CameraPanel,
  LastScanPanel,
} from '#components/camera-panel';
import { CameraViewport } from '#components/camera-viewport';
import { Keypad } from '#components/keypad';
import { KeypadField, KeypadFieldHint } from '#components/keypad-field';
import {
  ParcelBox,
  ParcelLabel,
  type ParcelLabelProps,
} from '#components/parcel-label';
import { ScanFields, type ScanField } from '#components/scan-fields';
import { Sheet } from '#components/sheet';

/** What the scanner made of the label in front of it. */
export type ScanReading =
  /** Read: the fields, and the parcel added just before this one. */
  | {
      kind: 'read';
      fields: ScanField[];
      last?: { name: string; meta: string };
    }
  /** Already in the batch: when, and what to do about it. */
  | { kind: 'duplicate'; title: string; detail: string; message: string }
  /** Nothing usable: why, and the two ways out. */
  | { kind: 'unreadable'; title: string; hint: string }
  /** Nothing to say yet, e.g. behind the manual entry sheet. */
  | { kind: 'idle' };

export type ScanScreenProps = {
  /** Parcels in the batch so far. */
  count: number;
  /** The label the camera is pointed at; none before the camera starts. */
  label?: ParcelLabelProps;
  reading: ScanReading;
  /** Hides the bottom row, when a sheet covers it. */
  controls?: boolean;
  /** Veil over the picture, see `CameraViewport`. */
  dim?: number;
  onClose?: () => void;
  onTorch?: () => void;
  onOpenList?: () => void;
  onShutter?: () => void;
  onDone?: () => void;
  onImport?: () => void;
  onType?: () => void;
};

/**
 * Reception, burst mode: the agent sweeps the camera over the parcels of a
 * delivery and each label is read and added without a tap. The screen only
 * talks when something needs a look — a duplicate, an unreadable label —
 * and keeps the last parcel on screen with a way to take it back.
 */
export function ScanScreen({
  count,
  label,
  reading,
  controls = true,
  dim,
  onClose,
  onTorch,
  onOpenList,
  onShutter,
  onDone,
  onImport,
  onType,
}: ScanScreenProps) {
  const unreadable = reading.kind === 'unreadable';
  return (
    <CameraViewport
      subject={
        label && (
          <ParcelBox>
            <ParcelLabel {...label} />
          </ParcelBox>
        )
      }
      frame={
        reading.kind === 'duplicate' ? 'warning' : unreadable ? 'error' : 'idle'
      }
      dim={dim ?? (unreadable ? 0.25 : undefined)}
    >
      <CameraTopBar
        title={`Lot : ${count} colis`}
        onClose={onClose}
        onTorch={onTorch}
      />

      {reading.kind === 'read' && reading.last && (
        <LastScanPanel
          className="mx-4 mt-3.5"
          title={reading.last.name}
          meta={reading.last.meta}
          action={{ icon: 'undo', label: 'Annuler' }}
        />
      )}
      {reading.kind === 'duplicate' && (
        <CameraNotice
          tone="warning"
          icon="alert"
          title={reading.title}
          className="mx-4 mt-3.5"
        >
          {reading.detail}
        </CameraNotice>
      )}

      <div className="flex-1" />

      {reading.kind === 'read' && (
        <CameraPanel className="mx-4 px-4 pt-[17px] pb-[18px]">
          <ScanFields fields={reading.fields} />
        </CameraPanel>
      )}
      {reading.kind === 'duplicate' && (
        <CameraNotice
          className="mx-4"
          actions={
            <>
              <CameraNoticeButton>Voir le colis</CameraNoticeButton>
              <CameraNoticeButton>Ajouter quand même</CameraNoticeButton>
            </>
          }
        >
          {reading.message}
        </CameraNotice>
      )}
      {unreadable && (
        <CameraNotice
          tone="danger"
          icon="alert"
          title={reading.title}
          className="mx-4"
          actions={
            <>
              <CameraNoticeButton>Saisir le numéro</CameraNoticeButton>
              <CameraNoticeButton>Garder la photo</CameraNoticeButton>
            </>
          }
        >
          {reading.hint}
        </CameraNotice>
      )}

      {controls && (
        <CameraControls
          count={count}
          onOpenList={onOpenList}
          onShutter={onShutter}
          onDone={onDone}
          tools={{
            start: (
              <CameraTool
                icon="image"
                label="Importer une photo"
                onClick={onImport}
              />
            ),
            end: (
              <CameraTool
                icon="keyboard"
                label="Saisir le numéro"
                onClick={onType}
              />
            ),
          }}
        />
      )}
    </CameraViewport>
  );
}

export type SaisieManuelleScreenProps = {
  count: number;
  label: ParcelLabelProps;
  /** Digits typed so far, grouped as printed. */
  value: string;
  /** The carrier the number matches, once it matches one. */
  carrier?: string;
};

/**
 * The number typed by hand when the label will not read. The camera stays
 * behind the sheet, dimmed, so closing it puts the agent back where they
 * were; the carrier is recognised as the digits come.
 */
export function SaisieManuelleScreen({
  count,
  label,
  value,
  carrier,
}: SaisieManuelleScreenProps) {
  return (
    <Sheet
      title="Saisir le numéro"
      scrimClassName="bg-black/35"
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
      <KeypadField value={value} className="mt-[22px]" />
      {/* The hint keeps its line while empty, so the keypad never jumps. */}
      {carrier ? (
        <KeypadFieldHint className="mt-[15px]">
          Format {carrier} reconnu
        </KeypadFieldHint>
      ) : (
        <span className="mt-[15px] h-[18px]" />
      )}
      <Keypad className="mt-[27px]" />
      <Button block className="mt-3">
        Ajouter au lot
      </Button>
    </Sheet>
  );
}

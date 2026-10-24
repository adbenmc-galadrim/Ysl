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
import {
  KeypadField,
  KeypadFieldHint,
  type KeypadFieldHintProps,
} from '#components/keypad-field';
import {
  ParcelBox,
  ParcelLabel,
  type ParcelLabelProps,
} from '#components/parcel-label';
import { ScanFields, type ScanField } from '#components/scan-fields';
import { Sheet } from '#components/sheet';
import type { IconName } from '#icons';
import type { ReactNode } from 'react';

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
  /** Nothing usable: why, and the two ways out; `keep` renames the second. */
  | { kind: 'unreadable'; title: string; hint: string; keep?: string }
  /** The camera is starting: black until the first frame. */
  | { kind: 'starting'; title: string }
  /** The camera was refused, is missing or off: retry (`retry` renames it), or import a photo. */
  | { kind: 'blocked'; title: string; hint: string; retry?: string }
  /** Nothing to say yet, e.g. behind the manual entry sheet. */
  | { kind: 'idle' };

export type ScanScreenProps = {
  /** Parcels in the batch so far. */
  count: number;
  /** The label the camera is pointed at; none before the camera starts. */
  label?: ParcelLabelProps;
  reading: ScanReading;
  /** The live `<video>` of the app, see `CameraViewport`. */
  video?: ReactNode;
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
  /** Takes the last parcel out of the batch. */
  onUndo?: () => void;
  /** Asks for the camera again after a refusal. */
  onRetry?: () => void;
  /** Types the number of the label that would not read. */
  onFix?: () => void;
  /** Keeps the unread photo as it is and closes the notice. */
  onKeep?: () => void;
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
  video,
  controls = true,
  dim,
  onClose,
  onTorch,
  onOpenList,
  onShutter,
  onDone,
  onImport,
  onType,
  onUndo,
  onRetry,
  onFix,
  onKeep,
}: ScanScreenProps) {
  const unreadable = reading.kind === 'unreadable';
  const blocked = reading.kind === 'blocked';
  const starting = reading.kind === 'starting';
  return (
    <CameraViewport
      video={video}
      subject={
        label && (
          <ParcelBox>
            <ParcelLabel {...label} />
          </ParcelBox>
        )
      }
      frame={
        reading.kind === 'duplicate'
          ? 'warning'
          : unreadable || blocked
            ? 'error'
            : starting
              ? false
              : 'idle'
      }
      dim={dim ?? (unreadable ? 0.25 : starting ? 1 : undefined)}
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
          action={{ icon: 'undo', label: 'Annuler', onClick: onUndo }}
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

      {starting ? (
        <p
          role="status"
          className="flex flex-1 items-center justify-center text-16 text-night-muted"
        >
          {reading.title}
        </p>
      ) : (
        <div className="flex-1" />
      )}

      {reading.kind === 'read' && reading.fields.length > 0 && (
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
              <CameraNoticeButton onClick={onFix}>
                Saisir le numéro
              </CameraNoticeButton>
              <CameraNoticeButton onClick={onKeep}>
                {reading.keep ?? 'Garder la photo'}
              </CameraNoticeButton>
            </>
          }
        >
          {reading.hint}
        </CameraNotice>
      )}
      {blocked && (
        <CameraNotice
          tone="danger"
          icon="alert"
          title={reading.title}
          className="mx-4"
          actions={
            <>
              <CameraNoticeButton onClick={onRetry}>
                {reading.retry ?? 'Réessayer'}
              </CameraNoticeButton>
              <CameraNoticeButton onClick={onImport}>
                Importer une photo
              </CameraNoticeButton>
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

/** The verdict under the field, as the characters come. */
export type SaisieManuelleHint = {
  tone: Extract<KeypadFieldHintProps['tone'], 'green' | 'orange' | 'red'>;
  text: string;
};

const HINT_ICON: Record<SaisieManuelleHint['tone'], IconName> = {
  green: 'check',
  orange: 'alert',
  red: 'alert',
};

export type SaisieManuelleSheetProps = {
  /** Characters typed so far, grouped as printed. */
  value: string;
  hint?: SaisieManuelleHint;
  /** "Ajouter au lot", or what filling an unread label says. */
  submitLabel?: string;
  /** Over the app's own screen rather than around `behind`, see `Sheet`. */
  fixed?: boolean;
  /** Opens the pad on the letters, see `Keypad`. */
  letters?: boolean;
  onDigit?: (digit: string) => void;
  onLetter?: (letter: string) => void;
  onDelete?: () => void;
  onSubmit?: () => void;
  onDismiss?: () => void;
};

/**
 * One field, the carrier recognised as the characters come, the pad, and
 * the one button. Nothing is ever refused — an unknown number still joins
 * the batch — so the button only waits for a first character.
 */
function SaisieManuelleBody({
  value,
  hint,
  submitLabel = 'Ajouter au lot',
  letters,
  onDigit,
  onLetter,
  onDelete,
  onSubmit,
}: Omit<SaisieManuelleSheetProps, 'fixed' | 'onDismiss'>) {
  return (
    <>
      <KeypadField value={value} className="mt-[22px]" />
      {/* The hint keeps its line while empty, so the keypad never jumps. */}
      {hint ? (
        <KeypadFieldHint
          tone={hint.tone}
          icon={HINT_ICON[hint.tone]}
          className="mt-[15px]"
        >
          {hint.text}
        </KeypadFieldHint>
      ) : (
        <span className="mt-[15px] h-[18px]" />
      )}
      <Keypad
        className="mt-[27px]"
        letters={letters}
        onDigit={onDigit}
        onLetter={onLetter}
        onDelete={onDelete}
      />
      <Button block className="mt-3" disabled={value === ''} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </>
  );
}

/**
 * The number typed by hand when the label will not read, as the app mounts
 * it: next to its own `ScanScreen`, which keeps the live camera.
 */
export function SaisieManuelleSheet({
  fixed,
  onDismiss,
  ...body
}: SaisieManuelleSheetProps) {
  return (
    <Sheet
      title="Saisir le numéro"
      scrimClassName="bg-black/35"
      fixed={fixed}
      onDismiss={onDismiss}
    >
      <SaisieManuelleBody {...body} />
    </Sheet>
  );
}

export type SaisieManuelleScreenProps = Omit<
  SaisieManuelleSheetProps,
  'fixed'
> & {
  count: number;
  label?: ParcelLabelProps;
  video?: ReactNode;
};

/**
 * The sheet as the mockup draws it: the camera stays behind, dimmed, so
 * closing it puts the agent back where they were.
 */
export function SaisieManuelleScreen({
  count,
  label,
  video,
  onDismiss,
  ...body
}: SaisieManuelleScreenProps) {
  return (
    <Sheet
      title="Saisir le numéro"
      scrimClassName="bg-black/35"
      onDismiss={onDismiss}
      behind={
        <ScanScreen
          count={count}
          label={label}
          video={video}
          reading={{ kind: 'idle' }}
          controls={false}
          dim={0.4}
        />
      }
    >
      <SaisieManuelleBody {...body} />
    </Sheet>
  );
}

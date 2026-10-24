import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { env } from '@repo/shared/env/web';
import {
  CameraDeniedScreen,
  CameraPermissionScreen,
  SaisieManuelleSheet,
  ScanScreen,
  type ScanReading,
} from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import {
  addDraft,
  finishBatch,
  openBatch,
  typeDraft,
  undoLast,
  updateDraft,
} from '#/features/batch/store';
import {
  canUndo,
  undoWindow,
  type UndoWindow,
} from '#/features/batch/undo-window';
import { useBatch } from '#/features/batch/use-batch';
import { encodePhoto, grabFrame } from '#/features/camera/capture';
import { frameQuality } from '#/features/camera/quality';
import {
  cameraEntry,
  markExplained,
  wasExplained,
} from '#/features/camera/entry';
import { cameraReading } from '#/features/camera/notice';
import { shutterMode } from '#/features/camera/shutter';
import {
  cameraPermission,
  cameraStream,
  useCameraState,
  useTorchState,
} from '#/features/camera/stream';
import { db } from '#/features/db/database';
import { photoFiles, StorageUnavailableError } from '#/features/photos/opfs';
import { lastOf } from '#/features/scan/last';
import {
  readDraft,
  recoverPending,
  settled,
  trackWork,
  type Symbols,
} from '#/features/scan/reader';
import { readImageFile } from '#/features/scan/read-file';
import {
  failedReading,
  type ShotHint,
  toScanReading,
} from '#/features/scan/reading';
import { decodeQueue } from '#/features/scan/decoder';
import { appendTyped, typedEntry } from '#/features/scan/typed';
import { ocrReader, readText } from '#/features/scan/text';
import { holdUpdates } from '#/features/update/updater';

const t = createTranslator(DEFAULT_LOCALE);

export const Route = createFileRoute('/_authenticated/scan')({
  component: ScanPage,
});

const SETTINGS_STEPS = [
  t('camera.steps.settings'),
  t('camera.steps.safari'),
  t('camera.steps.allow'),
  t('camera.steps.back', { appName: env.PUBLIC_APP_NAME }),
];
const STORAGE_FAILED: ScanReading = {
  kind: 'unreadable',
  title: t('scan.storageFailed.title'),
  hint: t('scan.storageFailed.hint'),
  keep: t('scan.storageFailed.dismiss'),
};

/** The sheet, typing a new parcel or the number of an unread draft. */
type Typing = { fix: string | null; value: string };

/** What is on screen: nothing yet, the explanation, or the viewfinder. */
type Opening = 'pending' | 'explain' | 'scan';

function ScanPage() {
  const navigate = useNavigate();
  const session = useSession();
  const close = () => void navigate({ to: '/' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const finishing = useRef(false);
  const camera = useCameraState();
  const torch = useTorchState();
  const [opening, setOpening] = useState<Opening>(() =>
    wasExplained() ? 'scan' : 'pending',
  );
  /** The agent chose to work without the camera: it only reopens on a tap. */
  const [fallback, setFallback] = useState(false);
  const view = useBatch();
  const [opened] = useState(() => Date.now());
  const [undo, setUndo] = useState<UndoWindow>(null);
  /** Only moves when a window closes: a window always opens later than it. */
  const [now, setNow] = useState(opened);
  const nextUndo = undoWindow(undo, view?.last, Date.now(), opened);
  if (nextUndo !== undo) setUndo(nextUndo);
  useEffect(() => {
    if (!undo || undo.until === Infinity) return;
    const { until } = undo;
    const timer = setTimeout(
      () => setNow(Math.max(until, Date.now())),
      Math.max(0, until - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [undo]);
  const undoable = canUndo(undo, now);
  const queue = decodeQueue();
  const [reading, setReading] = useState<ScanReading>({ kind: 'idle' });
  const [typing, setTyping] = useState<Typing | null>(null);
  const unread = useRef<string | null>(null);
  /** The draft the fields on screen belong to: a later text must not overwrite another's. */
  const shownDraft = useRef<string | null>(null);
  /** How that draft's shot looked, for the advice when nothing was read. */
  const shownShot = useRef<ShotHint | undefined>(undefined);

  useEffect(() => holdUpdates(), []);

  useEffect(() => {
    void ocrReader()
      .warmup()
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (opening !== 'pending') return;
    let cancelled = false;
    void cameraPermission().then((permission) => {
      if (!cancelled) setOpening(cameraEntry(wasExplained(), permission));
    });
    return () => {
      cancelled = true;
    };
  }, [opening]);

  /** The refusal takes the whole screen until the agent picks a way around it. */
  const refused = camera === 'denied' && !fallback;
  const viewfinder = opening === 'scan' && !refused;
  useEffect(() => {
    const video = videoRef.current;
    if (!viewfinder || !video) return;
    if (!fallback) void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, [viewfinder, fallback]);

  const onAllow = () => {
    markExplained();
    setOpening('scan');
  };

  /** Working without the camera: the viewfinder stays off until asked. */
  const withoutCamera = () => {
    markExplained();
    setFallback(true);
    setOpening('scan');
  };

  const onImportInstead = () => {
    withoutCamera();
    inputRef.current?.click();
  };

  /** From the refusal screen: the phone's own camera, which asks nothing of Safari. */
  const onPhotoInstead = () => {
    withoutCamera();
    captureRef.current?.click();
  };

  /** Asking again is a choice: a new refusal shows the Réglages steps again. */
  const onRetry = () => {
    setFallback(false);
    const video = videoRef.current;
    void (video ? cameraStream.attach(video) : cameraStream.retry());
  };

  const batchId = view?.batch?.id;
  useEffect(() => {
    if (!batchId) return;
    void trackWork(
      recoverPending(db, photoFiles, queue, batchId, undefined, (id, blob) =>
        readText(db, id, blob),
      ),
    );
  }, [batchId, queue]);

  /**
   * One tap, one parcel: the draft and its photo land before the reading.
   * `live` says the frame comes from the viewfinder, where the torch may
   * have lit it; a photo from the library owes it nothing.
   */
  const shoot = async (grab: () => Promise<ImageBitmap>, live: boolean) => {
    await queue.acquire();
    let bitmap: ImageBitmap | undefined;
    let clone: ImageBitmap | undefined;
    let handed = false;
    try {
      bitmap = await grab();
      const shot = shotHint(bitmap, live);
      clone = await createImageBitmap(bitmap);
      const batch = await openBatch(db);
      const photo = await encodePhoto(clone);
      const draft = await addDraft(db, photoFiles, batch.id, photo);
      handed = true;
      const { symbols, kept, failed } = await readDraft(
        db,
        queue,
        draft.id,
        bitmap,
        clone,
      );
      if (kept) {
        unread.current = symbols.length === 0 ? draft.id : null;
        shownDraft.current = draft.id;
        shownShot.current = shot;
        setReading(
          failed
            ? failedReading(t)
            : toScanReading({ symbols }, t, undefined, shot),
        );
      }
      if (kept) void showText(draft.id, photo.blob, symbols);
    } catch (error) {
      if (!handed) {
        queue.release();
        bitmap?.close();
        clone?.close();
      }
      if (!handed) unread.current = null;
      setReading(
        error instanceof StorageUnavailableError
          ? STORAGE_FAILED
          : failedReading(t),
      );
    }
  };

  /**
   * The text lands after the codes, whatever they gave, and outside the
   * batch's work: "Terminer" never waits for it. Without a code, only a
   * name is worth replacing what the screen says.
   */
  const showText = async (draftId: string, blob: Blob, symbols: Symbols) => {
    const text = await readText(db, draftId, blob);
    const worth = symbols.length > 0 || text.ocrName !== null;
    if (text.kept && !text.failed && worth && shownDraft.current === draftId) {
      setReading(toScanReading({ symbols }, t, text, shownShot.current));
    }
  };

  /** Measured on the frame before the reader takes it; a canvas failure says nothing. */
  const shotHint = (bitmap: ImageBitmap, live: boolean): ShotHint => {
    let quality: ShotHint['quality'] = 'ok';
    try {
      quality = frameQuality(bitmap).verdict;
    } catch {
      // No 2D canvas: the generic advice will do.
    }
    return { quality, torchOn: live && cameraStream.torch === 'on' };
  };

  const fire = (grab: () => Promise<ImageBitmap>, live: boolean) => {
    if (!finishing.current) void trackWork(shoot(grab, live));
  };

  /** The viewfinder's frame, or the phone's camera when there is no stream. */
  const onShutter = () => {
    const mode = shutterMode(camera, fallback);
    if (mode === 'native') {
      if (!finishing.current) captureRef.current?.click();
      return;
    }
    const video = videoRef.current;
    if (mode !== 'grab' || !video || !cameraStream.live) return;
    fire(() => grabFrame(video, cameraStream.track), true);
  };

  /** Each picture chosen is one parcel, in the order chosen: the queue paces them. */
  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const files = [...(input.files ?? [])];
    input.value = '';
    for (const file of files) fire(() => readImageFile(file), false);
  };

  const onUndo = () => {
    if (!view?.batch) return;
    unread.current = null;
    shownDraft.current = null;
    setReading({ kind: 'idle' });
    void undoLast(db, photoFiles, view.batch.id);
  };

  const onKeep = () => {
    unread.current = null;
    setReading({ kind: 'idle' });
  };

  /** While an unread label is on screen, any entry fills that draft. */
  const onType = () => setTyping({ fix: unread.current, value: '' });

  /** From the refusal screen: typing is the way to work, the camera stays off. */
  const onTypeInstead = () => {
    withoutCamera();
    onType();
  };

  const onTyped = async ({ fix, value }: Typing) => {
    const { carrier, tracking, trackingNorm } = typedEntry(value, t);
    const typed = { carrier, tracking, trackingNorm };
    const filled =
      fix !== null &&
      (await updateDraft(db, fix, { reading: 'typed', ...typed }));
    if (!filled) {
      const batch = await openBatch(db);
      await typeDraft(db, batch.id, typed);
    }
  };

  const onSubmit = () => {
    if (!typing || typing.value === '' || finishing.current) return;
    const entry = typing;
    setTyping(null);
    if (unread.current === entry.fix || unread.current === null) {
      unread.current = null;
      setReading({ kind: 'idle' });
    }
    void trackWork(onTyped(entry));
  };

  const onDone = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await settled();
      if (view?.batch) {
        await finishBatch(db, {
          batchId: view.batch.id,
          agentId: session.user.id,
        });
      }
      close();
    } finally {
      finishing.current = false;
    }
  };

  const last = view?.last && lastOf(view.last, t);
  const shown: ScanReading = typing
    ? { kind: 'idle' }
    : reading.kind === 'read'
      ? { ...reading, last }
      : reading.kind !== 'idle'
        ? reading
        : (cameraReading(camera, fallback, t) ??
          (last ? { kind: 'read', fields: [], last } : reading));

  const entry = typing && typedEntry(typing.value, t);

  if (opening === 'pending') return null;

  /* The file inputs live outside the screens: the chooser opened from one
     screen must deliver its files to the input still mounted on the next.
     `capture` opens the phone's camera for one shot; the other, the library. */
  return (
    <>
      {refused ? (
        <CameraDeniedScreen
          steps={SETTINGS_STEPS}
          onPhoto={onPhotoInstead}
          onKeyboard={onTypeInstead}
          onRetry={onRetry}
        />
      ) : opening === 'explain' ? (
        <CameraPermissionScreen onAllow={onAllow} onImport={onImportInstead} />
      ) : (
        <>
          <ScanScreen
            count={view?.count ?? 0}
            reading={shown}
            controls={!typing}
            dim={typing ? 0.4 : undefined}
            video={
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="size-full object-cover"
              />
            }
            torch={torch !== 'none'}
            torchOn={torch === 'on'}
            onClose={close}
            onTorch={() => void cameraStream.toggleTorch()}
            onShutter={onShutter}
            onUndo={undoable ? onUndo : undefined}
            onDone={() => void onDone()}
            onImport={() => inputRef.current?.click()}
            onType={onType}
            onFix={onType}
            onKeep={onKeep}
            onRetry={onRetry}
          />
          {typing && entry && (
            <SaisieManuelleSheet
              fixed
              value={entry.grouped}
              hint={entry.hint ?? undefined}
              submitLabel={typing.fix ? t('scan.type.save') : undefined}
              onDigit={(key) =>
                setTyping(
                  (s) => s && { ...s, value: appendTyped(s.value, key) },
                )
              }
              onLetter={(key) =>
                setTyping(
                  (s) => s && { ...s, value: appendTyped(s.value, key) },
                )
              }
              onDelete={() =>
                setTyping((s) => s && { ...s, value: s.value.slice(0, -1) })
              }
              onSubmit={onSubmit}
              onDismiss={() => setTyping(null)}
            />
          )}
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onFiles}
      />
      <input
        ref={captureRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFiles}
      />
    </>
  );
}

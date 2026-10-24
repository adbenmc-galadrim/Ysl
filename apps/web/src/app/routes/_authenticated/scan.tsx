import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { SaisieManuelleSheet, ScanScreen, type ScanReading } from '@repo/ui';
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
import { useBatch } from '#/features/batch/use-batch';
import { encodePhoto, grabFrame } from '#/features/camera/capture';
import { cameraStream, useCameraState } from '#/features/camera/stream';
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
import { failedReading, toScanReading } from '#/features/scan/reading';
import { decodeQueue } from '#/features/scan/decoder';
import { appendTyped, typedEntry } from '#/features/scan/typed';
import { ocrReader, readText } from '#/features/scan/text';
import { holdUpdates } from '#/features/update/updater';

const t = createTranslator(DEFAULT_LOCALE);

export const Route = createFileRoute('/_authenticated/scan')({
  component: ScanPage,
});

const STARTING: ScanReading = { kind: 'starting', title: t('scan.starting') };
const BLOCKED: ScanReading = {
  kind: 'blocked',
  title: t('scan.blocked.title'),
  hint: t('scan.blocked.hint'),
};
const STORAGE_FAILED: ScanReading = {
  kind: 'unreadable',
  title: t('scan.storageFailed.title'),
  hint: t('scan.storageFailed.hint'),
  keep: t('scan.storageFailed.dismiss'),
};

/** The sheet, typing a new parcel or the number of an unread draft. */
type Typing = { fix: string | null; value: string };

function ScanPage() {
  const navigate = useNavigate();
  const session = useSession();
  const close = () => void navigate({ to: '/' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const finishing = useRef(false);
  const camera = useCameraState();
  const view = useBatch();
  const queue = decodeQueue();
  const [reading, setReading] = useState<ScanReading>({ kind: 'idle' });
  const [typing, setTyping] = useState<Typing | null>(null);
  const unread = useRef<string | null>(null);
  /** The draft the fields on screen belong to: a later text must not overwrite another's. */
  const shownDraft = useRef<string | null>(null);

  useEffect(() => holdUpdates(), []);

  useEffect(() => {
    void ocrReader()
      .warmup()
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, []);

  const batchId = view?.batch?.id;
  useEffect(() => {
    if (!batchId) return;
    void trackWork(
      recoverPending(db, photoFiles, queue, batchId, undefined, (id, blob) =>
        readText(db, id, blob),
      ),
    );
  }, [batchId, queue]);

  /** One tap, one parcel: the draft and its photo land before the reading. */
  const shoot = async (grab: () => Promise<ImageBitmap>) => {
    await queue.acquire();
    let bitmap: ImageBitmap | undefined;
    let clone: ImageBitmap | undefined;
    let handed = false;
    try {
      bitmap = await grab();
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
        setReading(failed ? failedReading(t) : toScanReading({ symbols }, t));
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
      setReading(toScanReading({ symbols }, t, text));
    }
  };

  const fire = (grab: () => Promise<ImageBitmap>) => {
    if (!finishing.current) void trackWork(shoot(grab));
  };

  const onShutter = () => {
    const video = videoRef.current;
    if (!video || !cameraStream.live) return;
    fire(() => grabFrame(video, cameraStream.track));
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    fire(() => createImageBitmap(file, { imageOrientation: 'from-image' }));
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
        : camera === 'blocked' || camera === 'denied'
          ? BLOCKED
          : camera !== 'live'
            ? STARTING
            : last
              ? { kind: 'read', fields: [], last }
              : reading;

  const entry = typing && typedEntry(typing.value, t);

  return (
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
        onClose={close}
        onShutter={onShutter}
        onUndo={onUndo}
        onDone={() => void onDone()}
        onImport={() => inputRef.current?.click()}
        onType={onType}
        onFix={onType}
        onKeep={onKeep}
        onRetry={() => void cameraStream.retry()}
      />
      {typing && entry && (
        <SaisieManuelleSheet
          fixed
          value={entry.grouped}
          hint={entry.hint ?? undefined}
          submitLabel={typing.fix ? t('scan.type.save') : undefined}
          onDigit={(key) =>
            setTyping((s) => s && { ...s, value: appendTyped(s.value, key) })
          }
          onLetter={(key) =>
            setTyping((s) => s && { ...s, value: appendTyped(s.value, key) })
          }
          onDelete={() =>
            setTyping((s) => s && { ...s, value: s.value.slice(0, -1) })
          }
          onSubmit={onSubmit}
          onDismiss={() => setTyping(null)}
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </>
  );
}

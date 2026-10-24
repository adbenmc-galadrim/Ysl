import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { ScanScreen, type ScanReading } from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import {
  addDraft,
  finishBatch,
  openBatch,
  undoLast,
} from '#/features/batch/store';
import { useBatch } from '#/features/batch/use-batch';
import { encodePhoto, grabFrame } from '#/features/camera/capture';
import { cameraStream, useCameraState } from '#/features/camera/stream';
import { db } from '#/features/db/database';
import { photoFiles, StorageUnavailableError } from '#/features/photos/opfs';
import { lastOf } from '#/features/scan/last';
import { readDraft, recoverPending } from '#/features/scan/reader';
import { failedReading, toScanReading } from '#/features/scan/reading';
import { decodeQueue } from '#/features/scan/decoder';
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
};

function ScanPage() {
  const navigate = useNavigate();
  const session = useSession();
  const close = () => void navigate({ to: '/' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const shots = useRef(new Set<Promise<void>>());
  const finishing = useRef(false);
  const camera = useCameraState();
  const view = useBatch();
  const queue = decodeQueue();
  const [reading, setReading] = useState<ScanReading>({ kind: 'idle' });

  useEffect(() => holdUpdates(), []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, []);

  /** Terminer waits for every reading still on its way. */
  const track = (work: Promise<void>) => {
    const shot = work.finally(() => shots.current.delete(shot));
    shots.current.add(shot);
  };

  const batchId = view?.batch?.id;
  useEffect(() => {
    if (batchId) track(recoverPending(db, photoFiles, queue, batchId));
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
        setReading(failed ? failedReading(t) : toScanReading({ symbols }, t));
      }
    } catch (error) {
      if (!handed) {
        queue.release();
        bitmap?.close();
        clone?.close();
      }
      setReading(
        error instanceof StorageUnavailableError
          ? STORAGE_FAILED
          : failedReading(t),
      );
    }
  };

  const fire = (grab: () => Promise<ImageBitmap>) => {
    if (!finishing.current) track(shoot(grab));
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
    setReading({ kind: 'idle' });
    void undoLast(db, photoFiles, view.batch.id);
  };

  const onDone = async () => {
    if (finishing.current) return;
    finishing.current = true;
    try {
      await Promise.allSettled([...shots.current]);
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
  const shown: ScanReading =
    reading.kind === 'read'
      ? { ...reading, last }
      : reading.kind !== 'idle'
        ? reading
        : camera === 'blocked'
          ? BLOCKED
          : camera !== 'live'
            ? STARTING
            : last
              ? { kind: 'read', fields: [], last }
              : reading;

  return (
    <>
      <ScanScreen
        count={view?.count ?? 0}
        reading={shown}
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
        onRetry={() => void cameraStream.retry()}
      />
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

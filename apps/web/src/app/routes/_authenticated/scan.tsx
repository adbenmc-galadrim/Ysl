import { DAMAGE_LABEL } from '@repo/contract/parcel-damage';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { env } from '@repo/shared/env/web';
import {
  CameraDeniedScreen,
  CameraPermissionScreen,
  SaisieManuelleSheet,
  ScanScreen,
  type ScanReading,
  usePageLock,
} from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { modelsReady, subscribeModels } from '#/features/offline/models-state';
import {
  dropHeld,
  findDuplicate,
  holdDraft,
  restoreDraft,
  type Duplicate,
} from '#/features/batch/duplicates';
import {
  attachPiece,
  findPieceGroup,
  type PieceRead,
} from '#/features/batch/pieces';
import { copyRecipient, previousNamed } from '#/features/batch/recipient';
import {
  addDraft,
  addTypedDraft,
  openBatch,
  setDraftDamage,
  typedDraft,
  undoLast,
  updateDraft,
} from '#/features/batch/store';
import {
  canUndo,
  undoWindow,
  type UndoWindow,
} from '#/features/batch/undo-window';
import { useBatch } from '#/features/batch/use-batch';
import { DamageForm } from '#/features/damage/components/damage-form';
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
import {
  cameraZoom,
  cropToZoom,
  listenPinch,
  useCameraZoom,
  zoomLabel,
} from '#/features/camera/zoom';
import { db } from '#/features/db/database';
import type { DraftParcel } from '#/features/db/schema';
import { photoFiles, StorageUnavailableError } from '#/features/photos/opfs';
import { readPhoto } from '#/features/photos/store';
import {
  duplicateReading,
  parcelFields,
  recipientOf,
} from '#/features/scan/duplicate';
import { recipientInCodes } from '#/features/scan/extract';
import { carrierMeta, lastOf, nameOf } from '#/features/scan/last';
import { pieceReading } from '#/features/scan/piece';
import {
  readDraft,
  recoverPending,
  settled,
  trackWork,
} from '#/features/scan/reader';
import { readImageFile } from '#/features/scan/read-file';
import {
  failedReading,
  type ShotHint,
  type ShownSymbol,
  toScanReading,
} from '#/features/scan/reading';
import { decodeQueue } from '#/features/scan/decoder';
import {
  confirmsReading,
  FLASH_MS,
  scanFeedback,
} from '#/features/scan/feedback';
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

/** The draft kept out of the batch while the duplicate alert is up, what it doubles, and who that is for. */
type Held = { draft: DraftParcel; found: Duplicate; recipient: string };

/** The name "Même destinataire que le précédent" would give the draft on screen. */
type SameRecipient = { draftId: string; name: string };

function ScanPage() {
  const navigate = useNavigate();
  const close = () => void navigate({ to: '/' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const finishing = useRef(false);
  const camera = useCameraState();
  const torch = useTorchState();
  const zoom = useCameraZoom();
  const sceneRef = useRef<HTMLDivElement>(null);
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
  const feedback = scanFeedback();
  const [reading, setReading] = useState<ScanReading>({ kind: 'idle' });
  /** When the last label was read, for the green corners and the flash; 0 once they are gone. */
  const [flashedAt, setFlashedAt] = useState(0);
  const [typing, setTyping] = useState<Typing | null>(null);
  const unread = useRef<string | null>(null);
  /** The draft the fields on screen belong to: a later text must not overwrite another's. */
  const shownDraft = useRef<string | null>(null);
  /** How that draft's shot looked, for the advice when nothing was read. */
  const shownShot = useRef<ShotHint | undefined>(undefined);
  const held = useRef<Held | null>(null);
  const [sameAs, setSameAs] = useState<SameRecipient | null>(null);
  /** The draft « Signaler un dommage » was opened on, over the viewfinder. */
  const [damaging, setDamaging] = useState<DraftParcel | null>(null);

  useEffect(() => holdUpdates(), []);

  /** iOS only lets a page make sound after a touch: the first one on this screen wakes the beep; leaving gives the audio session back. */
  useEffect(() => {
    const unlock = () => feedback.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      feedback.release();
    };
  }, [feedback]);

  useEffect(() => {
    if (flashedAt === 0) return;
    const timer = setTimeout(
      () => setFlashedAt(0),
      Math.max(0, flashedAt + FLASH_MS - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [flashedAt]);

  /** A label read and kept: the beep, the vibration and the flash, all at once. */
  const confirmReading = () => {
    feedback.confirm();
    setFlashedAt(Date.now());
  };

  /** Any way out of the alert but "Ajouter quand même" gives the draft up, photo included. */
  const dropHeldDraft = () => {
    const taken = held.current;
    held.current = null;
    if (taken) void dropHeld(db, photoFiles, taken.draft);
  };
  useEffect(() => dropHeldDraft, []);

  /**
   * A label already read (F10): the draft leaves the batch and the alert
   * says what it doubles. `take` hands the draft over: out of the database
   * for a photo, as it is for a typed number that was never written. False
   * when there was nothing to hold, or no duplicate: the draft stays where
   * it is.
   */
  const holdDuplicate = async (
    draft: Pick<DraftParcel, 'id' | 'batchId' | 'createdAt'>,
    trackingNorm: string | null,
    piece: PieceRead | null,
    take: () => Promise<DraftParcel | undefined>,
    found?: Duplicate | null,
  ): Promise<boolean> => {
    found ??= await findDuplicate(db, { ...draft, trackingNorm, piece });
    if (!found) return false;
    const recipient =
      found.kind === 'parcel' ? await recipientOf(db, found.parcel, t) : '';
    const taken = await take();
    if (!taken) return false;
    dropHeldDraft();
    held.current = { draft: taken, found, recipient };
    unread.current = null;
    shownDraft.current = null;
    setSameAs(null);
    setReading(duplicateReading(found, recipient, t));
    return true;
  };

  useEffect(() => {
    const warm = () => {
      if (!modelsReady()) return;
      void ocrReader()
        .warmup()
        .catch(() => undefined);
    };
    warm();
    return subscribeModels(warm);
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
  usePageLock(viewfinder);

  /** Each opening of the camera on this screen starts at ×1. */
  useEffect(() => {
    if (camera === 'live') cameraZoom.reset(cameraStream.track);
  }, [camera]);

  const pinchable = viewfinder && camera === 'live';
  /** A level left by an earlier visit means nothing until the camera is live again. */
  const shownZoom = pinchable ? zoom : 1;
  useEffect(() => {
    const scene = sceneRef.current;
    if (!pinchable || !scene) return;
    return listenPinch(scene);
  }, [pinchable]);
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
      const wasHeld = held.current !== null;
      if (wasHeld) dropHeldDraft();
      setSameAs(null);
      setReading((shown) =>
        wasHeld || shown.kind === 'piece' ? { kind: 'idle' } : shown,
      );
      const { symbols, kept, failed, trackingNorm, piece, sender } =
        await readDraft(db, queue, draft.id, bitmap, clone);
      if (kept && piece && (await joinPieces(draft, piece))) return;
      if (
        kept &&
        (await holdDuplicate(draft, trackingNorm, piece, () =>
          holdDraft(db, draft.id),
        ))
      ) {
        const taken = held.current;
        if (taken?.found.kind === 'batch' && !piece) {
          void trackWork(readHeldPiece(taken.draft, photo.blob));
        }
        return;
      }
      if (kept) {
        if (held.current) dropHeldDraft();
        unread.current = symbols.length === 0 ? draft.id : null;
        shownDraft.current = draft.id;
        shownShot.current = shot;
        setReading(
          failed
            ? failedReading(t)
            : toScanReading(
                { symbols },
                t,
                sender ? { ocrName: null, sender } : undefined,
                shot,
              ),
        );
        if (!failed && symbols.length > 0) {
          void offerSameRecipient(draft, symbols);
        }
        if (confirmsReading({ kept, failed, symbols })) confirmReading();
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
   * One box of a parcel in several (F20): a piece not read yet of a parcel
   * of the batch joins it, and the screen says where the pieces stand. False
   * when the label is the first piece seen, or one already read (then a
   * duplicate): the draft stays where it is.
   */
  const joinPieces = async (
    draft: DraftParcel,
    piece: PieceRead,
  ): Promise<boolean> => {
    const group = await findPieceGroup(db, draft, piece.key);
    if (!group?.pieces || group.pieces.read.includes(piece.index)) {
      return false;
    }
    const joined = await attachPiece(db, group.id, draft, piece.index);
    if (!joined?.pieces) return false;
    if (held.current) dropHeldDraft();
    unread.current = null;
    shownDraft.current = null;
    setSameAs(null);
    setReading(pieceReading(joined, joined.pieces, piece.index, t));
    return true;
  };

  /**
   * "Même destinataire que le précédent" (F11): offered under the fields
   * when no code of this label names anyone and the parcel scanned just
   * before does. Only for the draft still on screen when the batch answers.
   */
  const offerSameRecipient = async (
    draft: DraftParcel,
    symbols: readonly ShownSymbol[],
  ) => {
    if (recipientInCodes(symbols) !== null) return;
    const previous = await previousNamed(db, draft);
    if (previous && shownDraft.current === draft.id) {
      setSameAs({ draftId: draft.id, name: previous.name });
    }
  };

  /** The agent's word: the name lands on the draft and the field turns sure. */
  const onSameRecipient = async () => {
    const same = sameAs;
    if (!same) return;
    setSameAs(null);
    if (!(await copyRecipient(db, same.draftId, same.name))) return;
    const draft = await db.draftParcel.get(same.draftId);
    if (draft && shownDraft.current === draft.id) {
      setReading(
        toScanReading(
          { symbols: draft.symbols },
          t,
          {
            ocrName: draft.ocrName,
            readName: draft.readName,
            sender: draft.sender ?? null,
            annex: draft.annex ?? null,
          },
          shownShot.current,
        ),
      );
    }
  };

  /**
   * The text lands after the codes, whatever they gave, and outside the
   * batch's work: "Terminer" never waits for it. Without a code, only a
   * name is worth replacing what the screen says; a name the agent gave
   * meanwhile stays over the OCR's guess.
   */
  const showText = async (
    draftId: string,
    blob: Blob,
    symbols: readonly ShownSymbol[],
  ) => {
    const text = await readText(db, draftId, blob);
    const worth = symbols.length > 0 || text.ocrName !== null;
    if (text.kept && !text.failed && worth && shownDraft.current === draftId) {
      const draft = await db.draftParcel.get(draftId);
      setReading(
        toScanReading(
          { symbols },
          t,
          {
            ocrName: text.ocrName,
            readName: draft?.readName ?? null,
            sender: text.sender,
            annex: text.annex,
          },
          shownShot.current,
        ),
      );
    }
  };

  /**
   * The text of a draft held as « Déjà dans ce lot » (F20): the alert came
   * at once; if the printed text then says « 2 OF 3 » of a parcel of the
   * batch, the box was not a double but its next piece, and the alert gives
   * way to the pieces panel. Otherwise nothing is kept: « Ajouter quand
   * même » reads the text again as before. Nothing happens once the agent
   * has decided, and the hold is released before the piece moves, so a shot
   * landing meanwhile cannot drop the photo the parcel now owns.
   */
  const readHeldPiece = async (draft: DraftParcel, blob: Blob) => {
    const text = await readText(
      db,
      draft.id,
      blob,
      undefined,
      undefined,
      draft,
    );
    const taken = held.current;
    if (taken?.draft.id !== draft.id || text.failed || !text.piece) return;
    const group = await findPieceGroup(db, draft, text.piece.key);
    if (!group?.pieces || group.pieces.read.includes(text.piece.index)) return;
    if (held.current !== taken) return;
    held.current = null;
    const joined = await attachPiece(
      db,
      group.id,
      taken.draft,
      text.piece.index,
    );
    if (!joined?.pieces) {
      held.current ??= taken;
      return;
    }
    setReading(pieceReading(joined, joined.pieces, text.piece.index, t));
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
    const crop = cameraZoom.digital;
    fire(
      async () => cropToZoom(await grabFrame(video, cameraStream.track), crop),
      true,
    );
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
    dropHeldDraft();
    unread.current = null;
    shownDraft.current = null;
    setSameAs(null);
    setReading({ kind: 'idle' });
    void undoLast(db, photoFiles, view.batch.id);
  };

  const onKeep = () => {
    unread.current = null;
    setReading({ kind: 'idle' });
  };

  /** "Enregistrer 2 sur 3": the parcel already stands so; the panel goes. */
  const onSavePartial = () => setReading({ kind: 'idle' });

  /** While an unread label is on screen, any entry fills that draft. */
  const onType = () => setTyping({ fix: unread.current, value: '' });

  /** From the refusal screen: typing is the way to work, the camera stays off. */
  const onTypeInstead = () => {
    withoutCamera();
    onType();
  };

  /**
   * The number typed fills the unread draft it was asked for, else makes
   * one; either way it is checked against the batch and the parcels first,
   * and a duplicate is held before it lands. A number landing on an older
   * draft counts from now: a reading that came in between is its original.
   */
  const onTyped = async ({ fix, value }: Typing) => {
    const { carrier, tracking, trackingNorm } = typedEntry(value, t);
    const typed = { carrier, tracking, trackingNorm };
    dropHeldDraft();
    const fixing = fix !== null ? await db.draftParcel.get(fix) : undefined;
    if (fixing) {
      const fixed = { ...fixing, reading: 'typed' as const, ...typed };
      const taken = await holdDuplicate(
        { ...fixing, createdAt: new Date() },
        trackingNorm,
        null,
        async () => (await holdDraft(db, fixing.id)) && fixed,
      );
      if (taken) return;
      if (await updateDraft(db, fixing.id, { reading: 'typed', ...typed })) {
        return;
      }
    }
    const batch = await openBatch(db);
    const draft = typedDraft(batch.id, typed);
    if (
      await holdDuplicate(draft, trackingNorm, null, () =>
        Promise.resolve(draft),
      )
    ) {
      return;
    }
    await addTypedDraft(db, draft);
  };

  /**
   * "Voir le colis": the original's fields take the alert's place, in the
   * batch as it was read, received before as the list knows it. Looking is
   * deciding not to add: the double goes; scanning again offers it anew.
   */
  const onView = () => {
    const taken = held.current;
    if (!taken) return;
    dropHeldDraft();
    shownDraft.current = null;
    setSameAs(null);
    const { found } = taken;
    setReading(
      found.kind === 'batch'
        ? toScanReading({ symbols: found.draft.symbols }, t, {
            ocrName: found.draft.ocrName,
            readName: found.draft.readName,
            sender: found.draft.sender ?? null,
            annex: found.draft.annex ?? null,
          })
        : {
            kind: 'read',
            fields: parcelFields(found.parcel, taken.recipient, t),
          },
    );
  };

  /**
   * "Ajouter quand même": the draft rejoins the batch as it was, its codes
   * on screen as after any reading, and the text pass it missed while held
   * runs now.
   */
  const onAddAnyway = () => {
    const taken = held.current;
    if (!taken) return;
    held.current = null;
    const { draft } = taken;
    shownDraft.current = draft.id;
    shownShot.current = undefined;
    setReading(
      toScanReading(
        { symbols: draft.symbols },
        t,
        draft.sender ? { ocrName: null, sender: draft.sender } : undefined,
      ),
    );
    void trackWork(restoreDraft(db, draft)).then(() => {
      if (draft.photoId && draft.ocrState === 'pending') {
        void readHeldText(draft.id, draft.photoId, draft.symbols);
      }
    });
  };

  /** The text pass a held draft missed, outside the batch's work like any other. */
  const readHeldText = async (
    draftId: string,
    photoId: string,
    symbols: readonly ShownSymbol[],
  ) => {
    const photo = await db.photo.get(photoId);
    if (photo)
      await showText(draftId, await readPhoto(photoFiles, photo), symbols);
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

  /**
   * "Terminer": once every reading has landed, the parcels whose recipient
   * the scanner could not settle go through « Vérifier un colis » (F18),
   * which promotes the batch after the last one.
   */
  const onDone = async () => {
    if (finishing.current) return;
    finishing.current = true;
    dropHeldDraft();
    try {
      await settled();
      if (view?.batch) await navigate({ to: '/verifier' });
      else close();
    } finally {
      finishing.current = false;
    }
  };

  const last = view?.last && lastOf(view.last, t);
  /* The reserve is offered on the parcel just read, the one the band names. */
  const damageable =
    view?.last && view.last.id === shownDraft.current ? view.last : undefined;
  const action =
    sameAs && sameAs.draftId === shownDraft.current
      ? {
          label: t('scan.recipient.same'),
          onClick: () => void onSameRecipient(),
        }
      : damageable
        ? {
            label: damageable.damage
              ? t('scan.damage.set', {
                  reason: DAMAGE_LABEL[damageable.damage.reason].toLowerCase(),
                })
              : t('scan.damage.report'),
            onClick: () => setDamaging(damageable),
          }
        : undefined;
  const shown: ScanReading = typing
    ? { kind: 'idle' }
    : reading.kind === 'read'
      ? { ...reading, last, action }
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
          <div
            ref={sceneRef}
            className="fixed inset-0 touch-none overflow-hidden overscroll-none"
          >
            <ScanScreen
              count={view?.count ?? 0}
              reading={shown}
              controls={!typing}
              dim={typing ? 0.4 : undefined}
              flash={flashedAt !== 0}
              video={
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="size-full object-cover"
                  style={
                    cameraZoom.range.kind === 'digital' && shownZoom > 1
                      ? { transform: `scale(${shownZoom})` }
                      : undefined
                  }
                />
              }
              /* Under 1.05 the label already reads ×1,0: no pill. */
              zoom={
                Math.abs(shownZoom - 1) >= 0.05
                  ? {
                      label: zoomLabel(shownZoom),
                      onReset: () => cameraZoom.set(1),
                    }
                  : undefined
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
              onView={onView}
              onAddAnyway={onAddAnyway}
              onSavePartial={onSavePartial}
            />
          </div>
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
          {damaging && (
            <div className="fixed inset-0 z-50">
              <DamageForm
                parcel={{
                  recipient: nameOf(damaging, t),
                  carrier: carrierMeta(damaging.carrier, damaging.tracking, t),
                  last4: '',
                }}
                onClose={() => setDamaging(null)}
                onSave={async (input, photos) => {
                  await setDraftDamage(
                    db,
                    photoFiles,
                    damaging.id,
                    input,
                    photos,
                  );
                  setDamaging(null);
                }}
              />
            </div>
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

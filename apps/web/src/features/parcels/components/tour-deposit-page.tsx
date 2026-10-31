import { readDepartmentQr } from '@repo/contract/deposits';
import { departmentConfirmsDeposit } from '@repo/contract/operating-profile';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CameraPermissionScreen,
  DepositCountScreen,
  DepositOtherQrScreen,
  DepositScanScreen,
  TourStopScreen,
  usePageLock,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import {
  cameraEntry,
  markExplained,
  wasExplained,
} from '#/features/camera/entry';
import {
  cameraPermission,
  cameraStream,
  useCameraState,
  useTorchState,
} from '#/features/camera/stream';
import { db } from '#/features/db/database';
import {
  grabVideoFrame,
  QR_SCAN_INTERVAL_MS,
  readQrTexts,
} from '#/features/handover/qr-scan';
import { loadTour } from '#/features/parcels/api/use-tour';
import { pendingParcelIds, postDeposit } from '#/features/parcels/deposit';
import { departmentName, parcelsLabel } from '#/features/parcels/tour-view';
import { readOperatingProfile } from '#/features/settings/operating-profile';
import { decodeQueue } from '#/features/scan/decoder';

const t = createTranslator(DEFAULT_LOCALE);

type Step =
  | { kind: 'scan'; read?: string }
  | { kind: 'list' }
  | { kind: 'count'; departmentId: string; read: boolean };

/** Reads the poster as soon as it is in view; a text it cannot place keeps looking. */
function useQrReader(
  active: boolean,
  /** Changes when the `<video>` is rendered anew. */
  screen: string,
  onText: (text: string) => void,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCameraState();
  const torch = useTorchState();
  usePageLock(active);
  useEffect(() => {
    const video = videoRef.current;
    if (!active || !video) return;
    void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, [active, screen]);
  const live = active && camera === 'live';
  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastText = '';
    const queue = decodeQueue();
    const look = async () => {
      if (stopped) return;
      const texts =
        video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
          ? await readQrTexts(queue, () => grabVideoFrame(video)).catch(
              (): string[] => [],
            )
          : [];
      const text = texts[0];
      if (text === undefined) lastText = '';
      else if (!stopped && text !== lastText) {
        lastText = text;
        onText(text);
      }
      if (!stopped) timer = setTimeout(() => void look(), QR_SCAN_INTERVAL_MS);
    };
    void look();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [live, screen, onText]);
  return { videoRef, camera, torch };
}

/** The deposit itself (ME27): the poster or the list says where, the shuttle says it is down. */
export function TourDepositPage({ departmentId }: { departmentId: string }) {
  const navigate = useNavigate();
  const session = useSession();
  const [step, setStep] = useState<Step>({ kind: 'scan' });
  const [opening, setOpening] = useState<'pending' | 'explain' | 'scan'>(() =>
    wasExplained() ? 'scan' : 'pending',
  );
  const data = useLiveQuery(async () => {
    const { tour, departments, deposits } = await loadTour(db);
    const pending = pendingParcelIds(deposits);
    return {
      departments,
      confirms: departmentConfirmsDeposit(await readOperatingProfile(db)),
      stops: tour.stops
        .map((row) => ({
          id: row.departmentId,
          parcelIds: row.parcels
            .filter(({ id }) => !pending.has(id))
            .map(({ id }) => id),
        }))
        .filter(({ parcelIds }) => parcelIds.length > 0),
    };
  }, []);
  const posting = useRef(false);
  const [unknown, setUnknown] = useState(false);
  const scanning = opening === 'scan' && step.kind === 'scan';

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

  const onText = useRef((text: string) => {
    const read = readDepartmentQr(text);
    setUnknown(read === null);
    if (read === null) return;
    if (read === departmentId) {
      setStep({ kind: 'count', departmentId: read, read: true });
    } else {
      setStep({ kind: 'scan', read });
    }
  }).current;
  const { videoRef, camera, torch } = useQrReader(
    scanning && Boolean(data),
    step.kind === 'scan' && step.read ? 'other' : 'scan',
    onText,
  );
  const back = () =>
    void navigate({ to: '/tournee/$departmentId', params: { departmentId } });

  if (!data || opening === 'pending') return null;
  const nameOf = (id: string) => departmentName(data.departments.get(id), t);
  const stopOf = (id: string) => data.stops.find((row) => row.id === id);

  if (step.kind === 'list') {
    return (
      <TourStopScreen
        name={t('deposit.choose.title')}
        subtitle=""
        parcels={data.stops.map(({ id, parcelIds }) => ({
          id,
          title: nameOf(id),
          line: parcelsLabel(parcelIds.length, t),
        }))}
        onBack={() => setStep({ kind: 'scan' })}
        onParcel={(id) =>
          setStep({ kind: 'count', departmentId: id, read: false })
        }
      />
    );
  }

  if (step.kind === 'count') {
    const parcelIds = stopOf(step.departmentId)?.parcelIds ?? [];
    const name = nameOf(step.departmentId);
    return (
      <DepositCountScreen
        read={
          step.read ? t('deposit.count.read', { department: name }) : undefined
        }
        count={parcelIds.length}
        countLine={t('deposit.count.line', { department: name })}
        hint={t('deposit.count.hint')}
        listLabel={t('deposit.count.list')}
        actionLabel={t('deposit.count.action', {
          parcels: parcelsLabel(parcelIds.length, t),
        })}
        onAction={() => {
          if (posting.current || parcelIds.length === 0) return;
          posting.current = true;
          void postDeposit(db, {
            departmentId: step.departmentId,
            parcelIds,
            shuttleId: session.user.id,
            shuttleName: session.user.name,
          })
            .then(() =>
              data.confirms
                ? navigate({
                    to: '/tournee/$departmentId',
                    params: { departmentId: step.departmentId },
                    replace: true,
                  })
                : navigate({ to: '/', replace: true }),
            )
            .finally(() => {
              posting.current = false;
            });
        }}
        onClose={back}
        onList={() =>
          void navigate({
            to: '/tournee/$departmentId',
            params: { departmentId: step.departmentId },
          })
        }
      />
    );
  }

  if (opening === 'explain') {
    return (
      <CameraPermissionScreen
        onAllow={() => {
          markExplained();
          setOpening('scan');
        }}
        onImport={() => {
          markExplained();
          setStep({ kind: 'list' });
          setOpening('scan');
        }}
        importLabel={t('deposit.scan.list')}
      />
    );
  }

  const video = (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="size-full object-cover"
    />
  );
  const shared = {
    video,
    torch: torch !== 'none',
    onClose: back,
    onTorch: () => void cameraStream.toggleTorch(),
  };
  const refused = camera === 'denied' || camera === 'blocked';
  if (step.read) {
    const name = nameOf(step.read);
    const other = stopOf(step.read);
    const read = step.read;
    return (
      <div className="fixed inset-0 touch-none overflow-hidden overscroll-none">
        <DepositOtherQrScreen
          {...shared}
          title={t('deposit.scan.other.title', { department: name })}
          text={
            other
              ? t('deposit.scan.other.text', {
                  parcels: parcelsLabel(other.parcelIds.length, t),
                  department: name,
                })
              : t('deposit.scan.other.nothing')
          }
          action={
            other
              ? {
                  label: t('deposit.scan.other.action', { department: name }),
                  onClick: () =>
                    setStep({
                      kind: 'count',
                      departmentId: read,
                      read: true,
                    }),
                }
              : undefined
          }
        />
      </div>
    );
  }
  return (
    <div className="fixed inset-0 touch-none overflow-hidden overscroll-none">
      <DepositScanScreen
        {...shared}
        hint={
          refused
            ? t('deposit.scan.camera')
            : unknown
              ? t('deposit.scan.unknown')
              : t('deposit.scan.hint')
        }
        listLabel={t('deposit.scan.list')}
        onList={() => setStep({ kind: 'list' })}
      />
    </div>
  );
}

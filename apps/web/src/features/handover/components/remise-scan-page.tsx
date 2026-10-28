import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  CameraPermissionScreen,
  ScannerQrScreen,
  type ScannerQrNotice,
  usePageLock,
} from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
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
import { lookupPickupText } from '#/features/handover/pickup-lookup';
import {
  grabVideoFrame,
  QR_SCAN_INTERVAL_MS,
  readQrTexts,
} from '#/features/handover/qr-scan';
import {
  type RemiseColisSearch,
  searchForCode,
} from '#/features/handover/route';
import { decodeQueue } from '#/features/scan/decoder';

const t = createTranslator(DEFAULT_LOCALE);

type Refusal =
  | 'notPickup'
  | 'unknown'
  | 'expired'
  | 'used'
  | 'replaced'
  | 'ambiguous'
  | 'denied'
  | 'blocked';

const notice = (refusal: Refusal): ScannerQrNotice => ({
  title: t(`handover.qr.${refusal}`),
  description: t(`handover.qr.${refusal}.detail`),
});

export type RemiseScanPageProps = {
  onFound: (search: RemiseColisSearch) => void;
  onTypeCode: () => void;
  onSearchName: () => void;
  onClose: () => void;
};

/**
 * P4 step 1: the camera faces the employee's phone and reads the QR of the
 * pickup mail as soon as it is in view. The code and the name are a tap
 * away, always, and take over when the QR opens nothing.
 */
export function RemiseScanPage({
  onFound,
  onTypeCode,
  onSearchName,
  onClose,
}: RemiseScanPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCameraState();
  const torch = useTorchState();
  const [opening, setOpening] = useState<'pending' | 'explain' | 'scan'>(() =>
    wasExplained() ? 'scan' : 'pending',
  );
  const [refusal, setRefusal] = useState<Refusal>();
  const found = useRef(false);

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

  const viewfinder = opening === 'scan';
  usePageLock(viewfinder);

  useEffect(() => {
    const video = videoRef.current;
    if (!viewfinder || !video) return;
    void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, [viewfinder]);

  const live = viewfinder && camera === 'live';
  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastText = '';
    const queue = decodeQueue();
    const look = async () => {
      if (stopped || found.current) return;
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
        const match = await lookupPickupText(db, text).catch(() => null);
        if (stopped) return;
        if (!match) lastText = '';
        else if (match.status === 'active') {
          found.current = true;
          onFound(searchForCode(match.code, 'qr', Date.now()));
          return;
        } else setRefusal(match.status);
      }
      if (!stopped) timer = setTimeout(() => void look(), QR_SCAN_INTERVAL_MS);
    };
    void look();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [live, onFound]);

  if (opening === 'pending') return null;
  if (opening === 'explain') {
    return (
      <CameraPermissionScreen
        onAllow={() => {
          markExplained();
          setOpening('scan');
        }}
        onImport={() => {
          markExplained();
          onTypeCode();
        }}
        importLabel={t('handover.qr.typeCode')}
      />
    );
  }

  const cameraRefusal =
    camera === 'denied' || camera === 'blocked' ? camera : undefined;
  const shown = cameraRefusal ?? refusal;
  return (
    <div className="fixed inset-0 touch-none overflow-hidden overscroll-none">
      <ScannerQrScreen
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
        notice={shown ? notice(shown) : undefined}
        onClose={onClose}
        onTorch={() => void cameraStream.toggleTorch()}
        onTypeCode={onTypeCode}
        onSearchName={onSearchName}
      />
    </div>
  );
}

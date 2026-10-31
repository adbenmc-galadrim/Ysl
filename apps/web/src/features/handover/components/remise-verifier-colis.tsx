import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  Field,
  FieldInput,
  ScannerQrScreen,
  type ScannerQrNotice,
  Sheet,
  usePageLock,
} from '@repo/ui';
import { useEffect, useRef, useState } from 'react';
import {
  cameraStream,
  useCameraState,
  useTorchState,
} from '#/features/camera/stream';
import type { LocalParcel } from '#/features/db/schema';
import { parcelOfRead } from '#/features/handover/parcel-scan';
import {
  grabVideoFrame,
  QR_SCAN_INTERVAL_MS,
} from '#/features/handover/qr-scan';
import { decodeQueue } from '#/features/scan/decoder';

const t = createTranslator(DEFAULT_LOCALE);

export type RemiseVerifierColisProps = {
  parcels: readonly LocalParcel[];
  /** The parcels read so far, ticked or not. */
  progress: string;
  onRead: (parcelId: string) => void;
  onClose: () => void;
};

/**
 * « Scanner pour vérifier » (§3.7.4): each label read checks its parcel against
 * the list. A label that does not read, or a camera refused, takes the number
 * typed: a step the profile requires must not leave the parcel on the counter.
 */
export function RemiseVerifierColis({
  parcels,
  progress,
  onRead,
  onClose,
}: RemiseVerifierColisProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const camera = useCameraState();
  const torch = useTorchState();
  const [notice, setNotice] = useState<ScannerQrNotice>();
  const [typing, setTyping] = useState<string | null>(null);
  usePageLock(true);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    void cameraStream.attach(video);
    return () => cameraStream.detach(video);
  }, []);

  const read = (text: string): boolean => {
    const parcel = parcelOfRead(text, parcels);
    if (parcel) {
      setNotice(undefined);
      onRead(parcel.id);
      return true;
    }
    setNotice({
      title: t('handover.scan.other'),
      description: t('handover.scan.other.detail'),
    });
    return false;
  };
  const latest = useRef(read);
  latest.current = read;

  const live = camera === 'live';
  useEffect(() => {
    const video = videoRef.current;
    if (!live || !video) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastText = '';
    const queue = decodeQueue();
    const look = async () => {
      if (stopped) return;
      let texts: string[] = [];
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        await queue.acquire();
        try {
          const result = await queue.decode(await grabVideoFrame(video));
          texts = result.symbols.map((symbol) => symbol.text);
        } catch {
          texts = [];
        } finally {
          queue.release();
        }
      }
      const text = texts[0];
      if (text === undefined) lastText = '';
      else if (!stopped && text !== lastText) {
        lastText = text;
        latest.current(text);
      }
      if (!stopped) timer = setTimeout(() => void look(), QR_SCAN_INTERVAL_MS);
    };
    void look();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [live]);

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
        title={t('handover.scan.title')}
        hint={progress}
        typeLabel={t('handover.scan.type')}
        nameSearch={false}
        torch={torch !== 'none'}
        torchOn={torch === 'on'}
        notice={notice}
        onClose={onClose}
        onTorch={() => void cameraStream.toggleTorch()}
        onTypeCode={() => setTyping('')}
      />
      {typing !== null && (
        <Sheet
          fixed
          title={t('handover.scan.type')}
          onDismiss={() => setTyping(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              read(typing);
              setTyping(null);
            }}
          >
            <Field label={t('handover.scan.number')}>
              {(id) => (
                <FieldInput
                  id={id}
                  value={typing}
                  autoCapitalize="characters"
                  autoCorrect="off"
                  onChange={(event) => setTyping(event.currentTarget.value)}
                />
              )}
            </Field>
            <Button block type="submit" className="mt-4">
              {t('handover.scan.check')}
            </Button>
          </form>
        </Sheet>
      )}
    </div>
  );
}

import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CameraTopBar } from '#components/camera-controls';
import { CameraViewport } from '#components/camera-viewport';
import { Icon } from '#icons';

/** Why nothing opens: a QR unknown, expired or used, or a camera refused. */
export type ScannerQrNotice = { title: string; description?: string };

export type ScannerQrScreenProps = {
  /** The live `<video>` of the app, full bleed. */
  video?: ReactNode;
  /** What the camera films; a phone showing the pickup e-mail in the story. */
  subject?: ReactNode;
  /** Shows the torch square; `onTorch` toggles it. */
  torch?: boolean;
  torchOn?: boolean;
  /** Takes the place of the hint until the next QR is read. */
  notice?: ScannerQrNotice;
  onClose?: () => void;
  onTorch?: () => void;
  onTypeCode?: () => void;
  onSearchName?: () => void;
};

/**
 * Start of a handover: the camera opens on the QR of the pickup e-mail.
 * The two ways around it — the code read aloud, the name — are always on
 * screen, so a phone with a cracked screen or no battery costs one tap.
 */
export function ScannerQrScreen({
  video,
  subject,
  torch = true,
  torchOn = false,
  notice,
  onClose,
  onTorch,
  onTypeCode,
  onSearchName,
}: ScannerQrScreenProps) {
  return (
    <CameraViewport
      video={video}
      subject={subject}
      frame={false}
      floor={false}
      className="bg-scene-counter"
    >
      <CameraTopBar
        title="Remise"
        titleStyle="text"
        torch={torch}
        torchOn={torchOn}
        onClose={onClose}
        onTorch={onTorch}
      />
      {/* Anchored to the actions. On a short phone the gaps close up so the
          hint stays under the picture instead of over it. */}
      <div className="flex-1" />
      {notice ? (
        <div
          role="alert"
          className="mx-5 rounded-card bg-black/70 px-4 py-3.5 text-center"
        >
          <p className="text-17 font-semibold">{notice.title}</p>
          {notice.description && (
            <p className="mt-1 text-15 leading-5 text-white/70">
              {notice.description}
            </p>
          )}
        </div>
      ) : (
        <p className="px-5 text-center text-17 font-semibold">
          Scannez le QR code de l’e-mail du salarié
        </p>
      )}
      <div className="mt-[clamp(16px,calc(100dvh-764px),88px)] mb-[clamp(0px,calc(100dvh-784px),68px)] grid grid-cols-2 gap-3 px-5">
        <Button
          variant="night"
          onClick={onTypeCode}
          className="justify-start gap-2.5 px-4 text-15"
        >
          <Icon name="hash" size={20} className="shrink-0" />
          Taper le code
        </Button>
        <Button
          variant="night"
          onClick={onSearchName}
          className="justify-start gap-2.5 px-4 text-15"
        >
          <Icon name="search" size={20} className="shrink-0" />
          Chercher un nom
        </Button>
      </div>
    </CameraViewport>
  );
}

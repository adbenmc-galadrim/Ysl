import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { CameraTopBar } from '#components/camera-controls';
import { CameraViewport } from '#components/camera-viewport';
import { ScanCorners } from '#components/phone-parts';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** What the reading gave: a QR that opens nothing, a camera refused, a parcel checked. */
export type ScannerQrNotice = {
  title: string;
  description?: string;
  /** Before the title: what kind of news this is. */
  icon?: { name: IconName; className: string };
  /** The way forward, inside the notice: « Scanner un autre code ». */
  action?: { label: string; onClick: () => void };
};

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
  /** The square the QR goes in. */
  corners?: 'bg-white' | 'bg-ios-red';
  /** For another reading than the QR of the e-mail: a parcel's label. */
  title?: string;
  hint?: string;
  typeLabel?: string;
  /** The ways around the camera; the mockup of a scan in progress has none. */
  actions?: boolean;
  /** Without it, « Chercher un nom » is not offered. */
  nameSearch?: boolean;
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
  corners,
  title = 'Remise',
  hint = 'Scannez le QR de l’e-mail du salarié',
  typeLabel = 'Taper le code',
  actions = true,
  nameSearch = true,
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
        title={title}
        titleStyle="text"
        torch={torch}
        torchOn={torchOn}
        onClose={onClose}
        onTorch={onTorch}
      />
      {corners && <ScanCorners x={96} y={236} size={200} color={corners} />}
      {/* Anchored to the actions. On a short phone the gaps close up so the
          hint stays under the picture instead of over it. */}
      <div className="flex-1" />
      {notice ? (
        <div
          role="alert"
          className={cn(
            'relative mx-5 shrink-0 rounded-[18px] bg-night p-4',
            notice.icon && 'pl-[46px]',
          )}
        >
          {notice.icon && (
            <Icon
              name={notice.icon.name}
              size={20}
              className={cn(
                'absolute left-4',
                notice.action ? 'top-[18px]' : 'top-[26px]',
                notice.icon.className,
              )}
            />
          )}
          <p
            className={cn(
              'font-semibold',
              notice.action ? 'text-17' : 'text-15',
            )}
          >
            {notice.title}
          </p>
          {notice.description && (
            <p
              className={cn(
                'text-night-muted',
                notice.action ? 'mt-[5px]' : 'mt-1',
                notice.action ? 'text-14' : 'text-13',
              )}
            >
              {notice.description}
            </p>
          )}
          {notice.action && (
            <Button
              variant="light"
              size="md"
              block
              onClick={notice.action.onClick}
              className="mt-[22px] -ml-[30px] h-12 w-[calc(100%+30px)] rounded-[24px]"
            >
              {notice.action.label}
            </Button>
          )}
        </div>
      ) : (
        <p className="px-5 text-center text-17 font-semibold">{hint}</p>
      )}
      {!actions ? (
        <div className="h-[clamp(16px,calc(100dvh-724px),128px)] shrink-0" />
      ) : notice?.action ? (
        <div className="h-[clamp(16px,calc(100dvh-752px),100px)] shrink-0" />
      ) : (
        <div
          className={cn(
            'mt-[clamp(16px,calc(100dvh-672px),180px)] -mb-2 grid shrink-0 gap-3 px-5',
            nameSearch ? 'grid-cols-2' : 'grid-cols-1',
          )}
        >
          <Button
            variant="light"
            size="md"
            icon="hash"
            iconSize={20}
            onClick={onTypeCode}
            className="h-12 justify-start gap-2 rounded-[24px] pr-0 pl-[22.5px]"
          >
            {typeLabel}
          </Button>
          {nameSearch && (
            <Button
              variant="light"
              size="md"
              icon="search"
              iconSize={20}
              onClick={onSearchName}
              className="h-12 justify-start gap-2 rounded-[24px] pr-0 pl-[9px]"
            >
              Chercher un nom
            </Button>
          )}
        </div>
      )}
    </CameraViewport>
  );
}

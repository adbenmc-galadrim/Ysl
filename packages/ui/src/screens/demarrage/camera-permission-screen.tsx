import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { HeroTile } from '#components/hero-tile';
import { NumberedSteps } from '#components/numbered-steps';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';

export type CameraPermissionScreenProps = {
  onAllow?: () => void;
  onImport?: () => void;
  /** The link under the button, when the way around is not an import (the code at the handover). */
  importLabel?: string;
};

/**
 * Asked before iOS asks. The system prompt comes with no context; this
 * screen gives it — what the camera is for, that nothing leaves the phone,
 * that iOS may ask again — so the agent taps "Autoriser" without a doubt.
 */
export function CameraPermissionScreen({
  onAllow,
  onImport,
  importLabel = 'Importer une photo à la place',
}: CameraPermissionScreenProps) {
  return (
    <Screen
      // The link under the button makes the bar taller than the standard one.
      bottomInset={180}
      bottom={
        <BottomBar className="flex-col gap-0">
          <Button block onClick={onAllow}>
            Autoriser la caméra
          </Button>
          <Button
            variant="link"
            className="mt-[18px] mb-[15px] self-center text-16 font-semibold"
            onClick={onImport}
          >
            {importLabel}
          </Button>
        </BottomBar>
      }
    >
      <HeroTile icon="camera" className="mt-28 self-center" />
      <PageIntro
        size="lg"
        align="center"
        title="Autoriser la caméra"
        description="Elle sert à lire les étiquettes et les QR codes de retrait. iOS peut redemander l’accès à chaque ouverture de l’app : c’est normal, il suffit d’accepter."
        className="mt-9"
      />
      <Banner
        tone="grey"
        icon="check"
        title="Rien ne quitte le téléphone : la lecture se fait sur l’iPhone."
        className="mt-12"
        classNames={{
          root: 'pt-2.5 pb-1.5',
          icon: 'text-green',
          title: 'text-14 leading-[1.4] font-normal text-ink-2',
        }}
      />
    </Screen>
  );
}

/** Where to re-enable the camera for a home-screen web app on iOS. */
export const CAMERA_SETTINGS_STEPS: ReactNode[] = [
  'Ouvrez Réglages sur l’iPhone',
  'Touchez Safari, puis Caméra',
  'Choisissez « Autoriser »',
  'Revenez dans Courrier YSL',
];

export type CameraDeniedScreenProps = {
  steps?: ReactNode[];
  onPhoto?: () => void;
  onKeyboard?: () => void;
  onRetry?: () => void;
};

/**
 * The camera was refused. A web app cannot ask again, so the screen walks
 * through Réglages — and meanwhile offers the two ways to work without the
 * camera, so the morning's parcels are not blocked on a setting.
 */
export function CameraDeniedScreen({
  steps = CAMERA_SETTINGS_STEPS,
  onPhoto,
  onKeyboard,
  onRetry,
}: CameraDeniedScreenProps) {
  return (
    <Screen
      bottomInset={144}
      bottom={
        <BottomBar className="pb-[calc(var(--safe-bottom)+22px)]"
        >
          <Button block onClick={onRetry}>
            J’ai réautorisé, réessayer
          </Button>
        </BottomBar>
      }
    >
      <HeroTile
        icon="camera"
        tone="red"
        size="lg"
        crossed
        className="mt-[78px] self-center"
      />
      <PageIntro
        size="md"
        align="center"
        title="La caméra est bloquée"
        description="L’accès a été refusé. Pour scanner, réautorisez-le dans les réglages de l’iPhone."
        className="mt-[26px]"
      />
      <NumberedSteps steps={steps} className="mt-9" />
      <p className="mt-[38px] text-13 font-medium text-muted">En attendant</p>
      <div className="mt-2.5 grid grid-cols-2 gap-3">
        {(
          [
            ['image', 'Une photo', onPhoto],
            ['keyboard', 'Au clavier', onKeyboard],
          ] as const
        ).map(([icon, label, onClick]) => (
          <Button
            key={label}
            variant="secondary"
            size="md"
            icon={icon}
            iconSize={20}
            className="h-[52px]"
            onClick={onClick}
          >
            {label}
          </Button>
        ))}
      </div>
    </Screen>
  );
}

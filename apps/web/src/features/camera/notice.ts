import type { TranslateFn } from '@repo/shared/i18n';
import type { ScanReading } from '@repo/ui';
import type { CameraState } from '#/features/camera/stream';

/**
 * What the viewfinder says about the camera when nothing else is on
 * screen: nothing while it films, a notice for every other state. In
 * fallback the camera was never asked, so `idle` means "off", not "soon".
 */
export function cameraReading(
  camera: CameraState,
  fallback: boolean,
  t: TranslateFn,
): ScanReading | null {
  switch (camera) {
    case 'live':
      return null;
    case 'blocked':
      return {
        kind: 'blocked',
        title: t('scan.blocked.title'),
        hint: t('scan.blocked.hint'),
      };
    case 'denied':
      return {
        kind: 'blocked',
        title: t('scan.denied.title'),
        hint: t('scan.denied.hint'),
      };
    case 'idle':
      if (fallback) {
        return {
          kind: 'blocked',
          title: t('scan.off.title'),
          hint: t('scan.off.hint'),
          retry: t('scan.off.retry'),
        };
      }
      return { kind: 'starting', title: t('scan.starting') };
    case 'starting':
      return { kind: 'starting', title: t('scan.starting') };
  }
}

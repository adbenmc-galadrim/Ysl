import type { CameraPermission } from '#/features/camera/stream';

export const CAMERA_EXPLAINED_KEY = 'courrier.camera.explained';

type ExplainedStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether this device has already seen why the app wants the camera. */
export function wasExplained(
  storage: ExplainedStorage = localStorage,
): boolean {
  try {
    return storage.getItem(CAMERA_EXPLAINED_KEY) === '1';
  } catch {
    return false;
  }
}

export function markExplained(storage: ExplainedStorage = localStorage) {
  try {
    storage.setItem(CAMERA_EXPLAINED_KEY, '1');
  } catch {
    return;
  }
}

/**
 * What the Scan screen opens on. The explanation comes once, before the
 * first system prompt; a device that has read it goes straight to the
 * viewfinder — iOS may prompt again, the screen said it would. A camera
 * already granted needs no explanation; one already refused needs the
 * Réglages steps, which the viewfinder shows.
 */
export function cameraEntry(
  explained: boolean,
  permission: CameraPermission,
): 'explain' | 'scan' {
  if (explained || permission === 'granted' || permission === 'denied') {
    return 'scan';
  }
  return 'explain';
}

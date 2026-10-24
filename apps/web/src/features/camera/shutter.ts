import type { CameraState } from '#/features/camera/stream';

/**
 * What the shutter does: a frame of the stream while it films, the native
 * camera of the phone (`<input capture>`, S1) whenever the stream is not
 * coming — refused, failed, or left off in fallback — and nothing while it
 * is starting, so the system camera never opens over the one about to show.
 */
export type ShutterMode = 'grab' | 'native' | 'none';

export function shutterMode(
  camera: CameraState,
  fallback: boolean,
): ShutterMode {
  switch (camera) {
    case 'live':
      return 'grab';
    case 'denied':
    case 'blocked':
      return 'native';
    case 'idle':
      return fallback ? 'native' : 'none';
    case 'starting':
      return 'none';
  }
}

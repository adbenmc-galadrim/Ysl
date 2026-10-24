/**
 * The torch as the stream knows it: `none` when the camera has none (or
 * the browser will not say), else lit or not.
 */
export type TorchState = 'none' | 'off' | 'on';

/** `torch` is not in `lib.dom` yet; WebKit and Chromium both expose it. */
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean };
type TorchSettings = MediaTrackSettings & { torch?: boolean };
type TorchConstraints = MediaTrackConstraintSet & { torch?: boolean };

/**
 * What the track says of its torch: offered or not by `getCapabilities`,
 * lit or not by `getSettings`. Read again after a return to the foreground
 * (iOS puts the torch out behind the app) and after a reopened stream.
 */
export function torchCapability(
  track: Pick<MediaStreamTrack, 'getCapabilities' | 'getSettings'> | undefined,
): TorchState {
  if (!track || typeof track.getCapabilities !== 'function') return 'none';
  const capabilities = track.getCapabilities() as TorchCapabilities;
  if (capabilities.torch !== true) return 'none';
  const settings = track.getSettings() as TorchSettings;
  return settings.torch === true ? 'on' : 'off';
}

/**
 * Lights or puts out the torch. In `advanced`, as iOS takes it (rapport 04,
 * WebKit 280970): a flat `torch` constraint is ignored there.
 */
export function applyTorch(
  track: Pick<MediaStreamTrack, 'applyConstraints'>,
  on: boolean,
): Promise<void> {
  const constraints: TorchConstraints = { torch: on };
  return track.applyConstraints({ advanced: [constraints] });
}

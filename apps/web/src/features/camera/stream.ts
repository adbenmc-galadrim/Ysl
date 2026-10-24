import { useSyncExternalStore } from 'react';

/**
 * Where the camera stands: not asked yet, asked, filming, refused by the
 * agent or by iOS (`denied`), or failing for another reason (`blocked`).
 */
export type CameraState = 'idle' | 'starting' | 'live' | 'denied' | 'blocked';

/** What `navigator.permissions` knows of the camera, when it knows it. */
export type CameraPermission = 'prompt' | 'granted' | 'denied' | 'unknown';

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: 'environment' },
    width: { ideal: 4032 },
    height: { ideal: 3024 },
  },
};

export function hasCamera(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  );
}

/**
 * A refusal is not a failure: the agent (or iOS on their behalf) said no,
 * and the way out is Réglages, not a retry. Anything else is the camera
 * missing or busy.
 */
export function cameraFailure(error: unknown): 'denied' | 'blocked' {
  if (
    error instanceof DOMException &&
    (error.name === 'NotAllowedError' || error.name === 'SecurityError')
  ) {
    return 'denied';
  }
  return 'blocked';
}

/** Asks the browser without triggering any prompt; `unknown` where unsupported. */
export async function cameraPermission(): Promise<CameraPermission> {
  try {
    const status = await navigator.permissions.query({
      name: 'camera',
    });
    return status.state;
  } catch {
    return 'unknown';
  }
}

/**
 * The one camera stream of the app (S1, §6.4): opened once, kept for the
 * whole session — a new `getUserMedia` makes iOS ask again — and handed to
 * whichever `<video>` is on screen. Leaving the screen does not close it;
 * coming back to the foreground only replays the video, unless the track
 * really ended.
 */
class CameraStream {
  private stream: MediaStream | undefined;
  private opening: Promise<void> | undefined;
  private video: HTMLVideoElement | undefined;
  private listening = false;
  private readonly listeners = new Set<() => void>();
  state: CameraState = 'idle';

  get track(): MediaStreamTrack | undefined {
    return this.stream?.getVideoTracks()[0];
  }

  get live(): boolean {
    return this.track?.readyState === 'live';
  }

  /** Shows the stream in this element, opening the camera if needed. */
  async attach(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    this.listen();
    if (!this.live) {
      await this.open();
      return;
    }
    await this.play();
  }

  /** Forgets the element; the stream stays open for the next screen. */
  detach(video: HTMLVideoElement): void {
    if (this.video !== video) return;
    video.srcObject = null;
    this.video = undefined;
  }

  /** After a refusal or a failure: asks again. */
  retry(): Promise<void> {
    return this.open();
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: CameraState) {
    if (this.state === state) return;
    this.state = state;
    for (const listener of this.listeners) listener();
  }

  private open(): Promise<void> {
    this.opening ??= this.doOpen().finally(() => {
      this.opening = undefined;
    });
    return this.opening;
  }

  private async doOpen(): Promise<void> {
    if (!hasCamera()) {
      this.setState('blocked');
      return;
    }
    this.setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (document.visibilityState === 'visible') void this.open();
      });
      await this.play();
      this.setState('live');
    } catch (error) {
      this.setState(cameraFailure(error));
    }
  }

  private async play(): Promise<void> {
    const { video, stream } = this;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (video.paused) await video.play().catch(() => undefined);
  }

  private resume = () => {
    if (document.visibilityState !== 'visible' || !this.stream) return;
    if (this.live) void this.play();
    else void this.open();
  };

  private listen() {
    if (this.listening || typeof document === 'undefined') return;
    this.listening = true;
    document.addEventListener('visibilitychange', this.resume);
    window.addEventListener('pageshow', this.resume);
  }
}

export const cameraStream = new CameraStream();

export function useCameraState(): CameraState {
  return useSyncExternalStore(
    cameraStream.subscribe,
    () => cameraStream.state,
    () => cameraStream.state,
  );
}

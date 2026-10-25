import { useSyncExternalStore } from 'react';
import {
  applyTorch,
  torchCapability,
  type TorchState,
} from '#/features/camera/torch';

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
 * The one camera stream of the app, handed to whichever
 * `<video>` is on screen. It films only while a viewfinder shows it: leaving
 * the screen or unloading the page stops the tracks, so the camera light
 * goes out, and coming back opens it again. The close waits for the end of
 * the current task, so a viewfinder that remounts at once keeps its stream.
 * Going to the background keeps it: iOS pauses it there, and a stream opened
 * again on return makes it ask for the camera once more.
 */
export class CameraStream {
  private stream: MediaStream | undefined;
  private opening: Promise<void> | undefined;
  private video: HTMLVideoElement | undefined;
  private closing: ReturnType<typeof setTimeout> | undefined;
  /** Bumped by every close: an opening that started before it is dropped. */
  private generation = 0;
  private listening = false;
  private readonly listeners = new Set<() => void>();
  state: CameraState = 'idle';
  /** Offered by the track or not, lit or not (F07). */
  torch: TorchState = 'none';

  get track(): MediaStreamTrack | undefined {
    return this.stream?.getVideoTracks()[0];
  }

  get live(): boolean {
    return this.track?.readyState === 'live';
  }

  /** Shows the stream in this element, opening the camera if needed. */
  async attach(video: HTMLVideoElement): Promise<void> {
    this.cancelClose();
    this.video = video;
    this.listen();
    if (!this.live) {
      await this.open();
      return;
    }
    await this.play();
  }

  /** Forgets the element and closes the camera, unless another takes it. */
  detach(video: HTMLVideoElement): void {
    if (this.video !== video) return;
    video.srcObject = null;
    this.video = undefined;
    this.cancelClose();
    this.closing = setTimeout(() => {
      this.closing = undefined;
      if (!this.video) this.close();
    }, 0);
  }

  /** After a refusal or a failure: asks again. */
  retry(): Promise<void> {
    return this.open();
  }

  /**
   * Lights the torch, or puts it out. A refusal from the track (busy,
   * ended) leaves it as the track says: the square never lies.
   */
  async toggleTorch(): Promise<void> {
    const { track } = this;
    if (!track || this.torch === 'none') return;
    const on = this.torch !== 'on';
    try {
      await applyTorch(track, on);
      this.setTorch(on ? 'on' : 'off');
    } catch {
      this.setTorch(torchCapability(track));
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private setState(state: CameraState) {
    if (this.state === state) return;
    this.state = state;
    this.notify();
  }

  private setTorch(torch: TorchState) {
    if (this.torch === torch) return;
    this.torch = torch;
    this.notify();
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }

  private cancelClose() {
    clearTimeout(this.closing);
    this.closing = undefined;
  }

  /** Stops the tracks; a refusal or a failure stays as it was. */
  private close() {
    this.generation += 1;
    this.opening = undefined;
    const { stream } = this;
    this.stream = undefined;
    stream?.getTracks().forEach((track) => track.stop());
    this.setTorch('none');
    if (this.state === 'live' || this.state === 'starting') {
      this.setState('idle');
    }
  }

  private open(): Promise<void> {
    if (this.opening) return this.opening;
    const opening = this.doOpen().finally(() => {
      if (this.opening === opening) this.opening = undefined;
    });
    this.opening = opening;
    return opening;
  }

  private async doOpen(): Promise<void> {
    if (!hasCamera()) {
      this.setState('blocked');
      return;
    }
    const generation = this.generation;
    this.setState('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia(CONSTRAINTS);
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream?.getTracks().forEach((track) => track.stop());
      this.stream = stream;
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        if (document.visibilityState === 'visible' && this.video) {
          void this.open();
        }
      });
      await this.play();
      if (generation !== this.generation) return;
      this.setTorch(torchCapability(this.track));
      this.setState('live');
    } catch (error) {
      if (generation !== this.generation) return;
      this.setTorch('none');
      this.setState(cameraFailure(error));
    }
  }

  private async play(): Promise<void> {
    const { video, stream } = this;
    if (!video || !stream) return;
    if (video.srcObject !== stream) video.srcObject = stream;
    if (video.paused) await video.play().catch(() => undefined);
  }

  /** Back in the foreground with a viewfinder on screen: films again. */
  private resume = () => {
    if (document.visibilityState !== 'visible' || !this.video) return;
    if (this.live) {
      this.setTorch(torchCapability(this.track));
      void this.play();
    } else {
      void this.open();
    }
  };

  private onPageHide = () => {
    this.close();
  };

  private listen() {
    if (this.listening || typeof document === 'undefined') return;
    this.listening = true;
    document.addEventListener('visibilitychange', this.resume);
    window.addEventListener('pagehide', this.onPageHide);
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

export function useTorchState(): TorchState {
  return useSyncExternalStore(
    cameraStream.subscribe,
    () => cameraStream.torch,
    () => cameraStream.torch,
  );
}

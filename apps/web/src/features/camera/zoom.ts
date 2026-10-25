import { useSyncExternalStore } from 'react';

/**
 * How the picture zooms: the camera's own zoom when the track offers one
 * (Safari iOS 17+, optical then digital), else a digital zoom of ours —
 * the video scaled on screen and the frame cropped to match before it is
 * read.
 */
export type ZoomRange =
  | { kind: 'track'; min: number; max: number; step: number }
  | { kind: 'digital'; min: 1; max: number; step: number };

/** Past this, a label is enlarged noise for the reader. */
export const ZOOM_MAX = 8;
/** Our digital zoom only enlarges pixels: it stops sooner. */
export const DIGITAL_ZOOM_MAX = 4;
const DIGITAL_STEP = 0.1;

/** `zoom` is not in `lib.dom` yet; WebKit and Chromium both expose it. */
type Range = { min?: number; max?: number; step?: number };
type ZoomCapabilities = MediaTrackCapabilities & { zoom?: Range };
type ZoomConstraints = MediaTrackConstraintSet & { zoom?: number };

/** What the track offers, capped; the digital zoom where it offers nothing. */
export function zoomRange(
  track: Pick<MediaStreamTrack, 'getCapabilities'> | undefined,
): ZoomRange {
  const digital: ZoomRange = {
    kind: 'digital',
    min: 1,
    max: DIGITAL_ZOOM_MAX,
    step: DIGITAL_STEP,
  };
  if (!track || typeof track.getCapabilities !== 'function') return digital;
  const zoom = (track.getCapabilities() as ZoomCapabilities).zoom;
  if (
    !zoom ||
    typeof zoom.min !== 'number' ||
    typeof zoom.max !== 'number' ||
    zoom.max <= zoom.min
  ) {
    return digital;
  }
  return {
    kind: 'track',
    min: zoom.min,
    max: Math.max(zoom.min, Math.min(zoom.max, ZOOM_MAX)),
    step: zoom.step && zoom.step > 0 ? zoom.step : 0,
  };
}

/** Where a pinch puts the zoom: in proportion to the fingers' spread, within the range, on its steps. */
export function pinchZoom(
  start: number,
  startSpread: number,
  spread: number,
  range: Pick<ZoomRange, 'min' | 'max' | 'step'>,
): number {
  if (startSpread <= 0) return clampZoom(start, range);
  return clampZoom((start * spread) / startSpread, range);
}

export function clampZoom(
  zoom: number,
  { min, max, step }: Pick<ZoomRange, 'min' | 'max' | 'step'>,
): number {
  const clamped = Math.min(max, Math.max(min, zoom));
  if (!step) return clamped;
  const stepped = min + Math.round((clamped - min) / step) * step;
  return Math.min(max, Math.max(min, Number(stepped.toFixed(6))));
}

/** The level shown on the picture: « ×1,0 », « ×2,5 ». */
export function zoomLabel(zoom: number): string {
  return `×${zoom.toFixed(1).replace('.', ',')}`;
}

/** The middle of the frame at this zoom: what the agent sees, enlarged. */
export function zoomCrop(
  width: number,
  height: number,
  zoom: number,
): { x: number; y: number; width: number; height: number } {
  const z = Math.max(1, zoom);
  const w = Math.max(1, Math.round(width / z));
  const h = Math.max(1, Math.round(height / z));
  return {
    x: Math.round((width - w) / 2),
    y: Math.round((height - h) / 2),
    width: w,
    height: h,
  };
}

/** The camera's zoom, in `advanced` as iOS takes constraints (see `applyTorch`). */
export function applyTrackZoom(
  track: Pick<MediaStreamTrack, 'applyConstraints'>,
  zoom: number,
): Promise<void> {
  const constraints: ZoomConstraints = { zoom };
  return track.applyConstraints({ advanced: [constraints] });
}

type Track = Pick<MediaStreamTrack, 'getCapabilities' | 'applyConstraints'>;

/**
 * The zoom of the viewfinder. A pinch asks for levels faster than the
 * camera applies them: only the last one asked waits, the others are
 * dropped.
 */
class CameraZoom {
  level = 1;
  range: ZoomRange = zoomRange(undefined);
  private track: Track | undefined;
  private applying = false;
  private wanted: number | undefined;
  private readonly listeners = new Set<() => void>();

  /** Back to ×1 on this track: the screen opens unzoomed. */
  reset(track: Track | undefined): void {
    this.track = track;
    this.range = zoomRange(track);
    this.set(clampZoom(1, this.range));
  }

  set(level: number): void {
    const next = clampZoom(level, this.range);
    if (next !== this.level) {
      this.level = next;
      this.notify();
    }
    if (this.range.kind === 'track' && this.track) {
      this.wanted = next;
      void this.flush();
    }
  }

  /** How much the frame must be cropped to match the screen: the level in digital zoom, 1 otherwise. */
  get digital(): number {
    return this.range.kind === 'digital' ? this.level : 1;
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private async flush(): Promise<void> {
    if (this.applying) return;
    this.applying = true;
    try {
      while (this.wanted !== undefined && this.track) {
        const level = this.wanted;
        this.wanted = undefined;
        await applyTrackZoom(this.track, level).catch(() => undefined);
      }
    } finally {
      this.applying = false;
    }
  }

  private notify() {
    for (const listener of this.listeners) listener();
  }
}

export const cameraZoom = new CameraZoom();

export function useCameraZoom(): number {
  return useSyncExternalStore(
    cameraZoom.subscribe,
    () => cameraZoom.level,
    () => cameraZoom.level,
  );
}

/** The frame cropped to the digital zoom; the original is closed. Unchanged at ×1. */
export async function cropToZoom(
  bitmap: ImageBitmap,
  zoom: number,
): Promise<ImageBitmap> {
  if (zoom <= 1) return bitmap;
  const { x, y, width, height } = zoomCrop(bitmap.width, bitmap.height, zoom);
  let cropped: ImageBitmap;
  try {
    cropped = await createImageBitmap(bitmap, x, y, width, height);
  } catch {
    return bitmap;
  }
  bitmap.close();
  return cropped;
}

/** How far apart two fingers are, in CSS pixels. */
export function spread(
  a: Pick<Touch, 'clientX' | 'clientY'>,
  b: Pick<Touch, 'clientX' | 'clientY'>,
): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/**
 * Two fingers on the viewfinder zoom the camera, not the page: the pinch
 * starts from the level on screen and follows the fingers' spread.
 */
export function listenPinch(element: HTMLElement): () => void {
  let start: { level: number; spread: number } | undefined;
  const onStart = (event: TouchEvent) => {
    const [a, b] = event.touches;
    if (event.touches.length !== 2 || !a || !b) return;
    start = { level: cameraZoom.level, spread: spread(a, b) };
  };
  const onMove = (event: TouchEvent) => {
    const [a, b] = event.touches;
    if (!start || event.touches.length !== 2 || !a || !b) return;
    event.preventDefault();
    cameraZoom.set(
      pinchZoom(start.level, start.spread, spread(a, b), cameraZoom.range),
    );
  };
  const onEnd = (event: TouchEvent) => {
    if (event.touches.length < 2) start = undefined;
  };
  const options = { passive: false } as const;
  element.addEventListener('touchstart', onStart, options);
  element.addEventListener('touchmove', onMove, options);
  element.addEventListener('touchend', onEnd);
  element.addEventListener('touchcancel', onEnd);
  return () => {
    element.removeEventListener('touchstart', onStart);
    element.removeEventListener('touchmove', onMove);
    element.removeEventListener('touchend', onEnd);
    element.removeEventListener('touchcancel', onEnd);
  };
}

import type { ReactNode } from 'react';

import { cn } from '#lib/tv';

/**
 * What the viewfinder says: `idle` while it looks, `warning` for a reading
 * that needs a look (a duplicate), `error` when nothing could be read.
 */
export type ViewfinderTone = 'idle' | 'warning' | 'error';

const CORNER_TONE: Record<ViewfinderTone, string> = {
  idle: 'bg-white',
  warning: 'bg-ios-yellow',
  error: 'bg-ios-red',
};

/**
 * Two 30 × 4 bars per corner rather than a bordered box: Penpot draws each
 * arm as its own rounded bar, and a CSS border would round the elbow instead.
 */
function Corner({ tone, className }: { tone: string; className: string }) {
  return (
    <span className={cn('absolute size-[30px]', className)}>
      <span className={cn('absolute inset-x-0 top-0 h-1 rounded-[2px]', tone)} />
      <span className={cn('absolute inset-y-0 left-0 w-1 rounded-[2px]', tone)} />
    </span>
  );
}

export type ViewfinderProps = {
  tone?: ViewfinderTone;
  className?: string;
};

/** The four corners of the frame the parcel or the QR code goes in. */
export function Viewfinder({ tone = 'idle', className }: ViewfinderProps) {
  const color = CORNER_TONE[tone];
  return (
    <span
      aria-hidden="true"
      className={cn('relative block h-[336px] w-[272px]', className)}
    >
      <Corner tone={color} className="top-0 left-0" />
      <Corner tone={color} className="top-0 right-0 rotate-90" />
      <Corner tone={color} className="right-0 bottom-0 rotate-180" />
      <Corner tone={color} className="bottom-0 left-0 -rotate-90" />
    </span>
  );
}

export type CameraViewportProps = {
  /**
   * What the camera films, centred under the viewfinder: a `ParcelBox` with
   * its `ParcelLabel`, a phone showing a QR code.
   */
  subject?: ReactNode;
  /** Viewfinder colour; `false` hides it. */
  frame?: ViewfinderTone | false;
  /**
   * A black veil over the picture, under the viewfinder, from 0 to 1: 0.25
   * dims a shot that could not be read, 0.4 sits behind a sheet.
   */
  dim?: number;
  /**
   * Draws the lighter desk under the picture. Off for the handover, where
   * the camera faces the employee across the counter and sees only a wall.
   */
  floor?: boolean;
  /**
   * The controls over the picture, stacked top to bottom between the safe
   * areas: top bar, panels, a spacer, the shutter row.
   */
  children?: ReactNode;
  className?: string;
};

/**
 * The live camera, full bleed. The picture is a still — a wall, a desk and
 * the subject — because a Storybook cannot film; in the app the same box
 * holds the `<video>` and the overlays do not change.
 *
 * The subject and the viewfinder hang from the top safe area, not from the
 * centre: the panels under the top bar are what they must clear, and those
 * do not move with the screen height.
 */
export function CameraViewport({
  subject,
  frame = 'idle',
  dim,
  floor = true,
  children,
  className,
}: CameraViewportProps) {
  return (
    <div
      className={cn(
        'relative h-full min-h-dvh w-full overflow-hidden bg-scene text-white',
        className,
      )}
    >
      {/* The desk: the parcel is held over it, so it starts at 58 %. */}
      {floor && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[58%] bottom-0 bg-scene-floor"
        />
      )}
      {subject && (
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-[calc(var(--safe-top)+140px)] flex justify-center"
        >
          {subject}
        </div>
      )}
      {dim !== undefined && (
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-black"
          style={{ opacity: dim }}
        />
      )}
      {frame && (
        <div className="absolute inset-x-0 top-[calc(var(--safe-top)+146px)] flex justify-center">
          <Viewfinder tone={frame} />
        </div>
      )}
      <div className="relative mx-auto flex h-full min-h-dvh w-full max-w-[480px] flex-col pt-[calc(var(--safe-top)+6px)] pb-[calc(var(--safe-bottom)+18px)]">
        {children}
      </div>
    </div>
  );
}

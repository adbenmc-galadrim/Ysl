import { useRef, useState, type PointerEvent } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

type Point = [x: number, y: number];

/** Closer points than this add nothing a finger can see, and weigh the path. */
const MIN_STEP = 1.5;

const round = (value: number) => Math.round(value * 10) / 10;

/**
 * A stroke as smooth path data: each point becomes the control of a
 * quadratic curve ending halfway to the next, so the line bends through
 * the finger's path instead of breaking at every sampled point.
 */
export function smoothStroke(points: readonly Point[]): string {
  const [first, ...rest] = points;
  if (!first) return '';
  const at = ([x, y]: Point) => `${round(x)},${round(y)}`;
  if (!rest.length) return `M${at(first)}L${at(first)}`;
  let d = `M${at(first)}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const [x, y] = rest[i]!;
    const [nx, ny] = rest[i + 1]!;
    d += `Q${at([x, y])} ${at([(x + nx) / 2, (y + ny) / 2])}`;
  }
  return `${d}L${at(rest[rest.length - 1]!)}`;
}

export type SignaturePadProps = {
  /**
   * Strokes as SVG path data, in the pad's pixels from its bottom-left
   * corner — where the baseline hangs — so a signature keeps its place on
   * the line whatever the pad's height. Pass them to control the
   * pad (to restore or clear a signature); leave undefined to let it keep
   * its own.
   */
  strokes?: string[];
  onChange?: (strokes: string[]) => void;
  hint?: string;
  className?: string;
};

/**
 * Where the recipient signs with a finger. It draws on an SVG rather than a
 * canvas: the strokes stay vector data, smoothed as they are drawn, that the
 * app turns into an image once signed, and a story can show a signature
 * without simulating a gesture. `touch-action: none` keeps the page still
 * under the finger.
 *
 * The baseline and its cross sit low in the pad, at the height a hand
 * naturally lands on a phone held in the other hand.
 */
export function SignaturePad({
  strokes,
  onChange,
  hint = 'Signez avec le doigt',
  className,
}: SignaturePadProps) {
  const [own, setOwn] = useState<string[]>([]);
  const current = strokes ?? own;
  /** The finger drawing, and the points of its stroke so far. */
  const active = useRef<{ pointerId: number; points: Point[] } | null>(null);
  const svg = useRef<SVGSVGElement>(null);

  const update = (next: string[]) => {
    if (strokes === undefined) setOwn(next);
    onChange?.(next);
  };
  const pointOf = (e: { clientX: number; clientY: number }): Point => {
    const box = svg.current!.getBoundingClientRect();
    return [e.clientX - box.left, e.clientY - box.bottom];
  };
  const end = (e: PointerEvent) => {
    if (active.current?.pointerId === e.pointerId) active.current = null;
  };

  return (
    <div
      className={cn(
        'relative flex touch-none flex-col justify-end overflow-hidden rounded-[calc(var(--radius-sheet)-4px)] bg-fill px-8 pb-[63px]',
        className,
      )}
    >
      <div className="flex flex-col">
        <Icon
          name="x"
          size={14}
          strokeWidth={2.4}
          className="ml-px text-muted-2"
        />
        <div className="mt-[13px] h-[1.5px] bg-faint" />
        <p className="mt-[18.5px] text-center text-14 text-muted">{hint}</p>
      </div>
      <svg
        ref={svg}
        role="img"
        aria-label={current.length ? 'Signature' : hint}
        className="absolute inset-0 size-full touch-none"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        onPointerDown={(e) => {
          // A second finger on the pad is a palm or a slip: one line at a time.
          if (active.current) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          const points = [pointOf(e)];
          active.current = { pointerId: e.pointerId, points };
          update([...current, smoothStroke(points)]);
        }}
        onPointerMove={(e) => {
          const stroke = active.current;
          if (stroke?.pointerId !== e.pointerId) return;
          // Safari hands over the samples between two frames together.
          const samples = e.nativeEvent.getCoalescedEvents?.() ?? [];
          let moved = false;
          for (const sample of samples.length ? samples : [e]) {
            const point = pointOf(sample);
            const last = stroke.points[stroke.points.length - 1]!;
            if (Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_STEP)
              continue;
            stroke.points.push(point);
            moved = true;
          }
          if (!moved) return;
          update([...current.slice(0, -1), smoothStroke(stroke.points)]);
        }}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* Moves the origin to the bottom-left corner. */}
        <svg y="100%" overflow="visible">
          {current.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </svg>
      </svg>
    </div>
  );
}

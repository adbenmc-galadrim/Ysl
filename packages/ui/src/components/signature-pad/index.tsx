import { useRef, useState, type PointerEvent } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

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
 * canvas: the strokes stay vector data, so the proof sent to the server is
 * small and renders sharp at any size, and a story can show a signature
 * without simulating a gesture.
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
  const drawing = useRef(false);
  const svg = useRef<SVGSVGElement>(null);

  const update = (next: string[]) => {
    if (strokes === undefined) setOwn(next);
    onChange?.(next);
  };
  const point = (e: PointerEvent) => {
    const box = svg.current!.getBoundingClientRect();
    return `${Math.round(e.clientX - box.left)},${Math.round(e.clientY - box.bottom)}`;
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
        className="absolute inset-0 size-full"
        fill="none"
        stroke="currentColor"
        strokeWidth={3.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          update([...current, `M${point(e)}`]);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const last = current[current.length - 1];
          update([...current.slice(0, -1), `${last}L${point(e)}`]);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
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

import { cn } from '#lib/tv';

/** The board behind the label: photos of a batch differ a little in tone. */
const TONE = {
  kraft: 'fill-kraft',
  mid: 'fill-kraft-mid',
  light: 'fill-kraft-light',
  deep: 'fill-kraft-deep',
} as const;

/**
 * Barcode bars as `[x, width]` from the first one, in px. They are not
 * scaled with the thumbnail — print does not get thicker on a bigger photo —
 * so a wider label simply shows more of them.
 */
const BARS: [number, number][] = [
  [0, 2], [5.3, 1], [11.5, 1], [16, 2], [21.3, 3], [27.5, 1], [32, 1],
  [36.2, 3], [43.5, 1], [48, 1], [52.2, 2], [59.5, 1],
];

export type LabelThumbProps = {
  /** Rendered box, in px; the drawing scales with it. */
  size?: number;
  /**
   * Draw at this exact box instead of scaling the 36 px drawing, for a
   * non-square photo (52 × 64 on a resumed batch) or a large one (104).
   */
  width?: number;
  height?: number;
  /** Corner radius of the board, in px of the drawing. */
  radius?: number;
  tone?: keyof typeof TONE;
  /**
   * Room kept between the last bar and the paper's right edge, in px. The
   * 44 px thumbnail of the batch review prints one more bar: 4.
   */
  barMargin?: number;
  className?: string;
};

/**
 * A thumbnail of the photo taken at reception: a label on kraft board. It
 * stands in for the real photo wherever a story has none, and tells the
 * employee "this is the parcel we saw" better than a generic box icon.
 */
export function LabelThumb({
  size = 36,
  width,
  height,
  radius = 6,
  tone = 'kraft',
  barMargin = 6,
  className,
}: LabelThumbProps) {
  const exact = width !== undefined || height !== undefined;
  // The drawing's own box: 36 × 36 scaled to `size`, or the exact box.
  const w = exact ? (width ?? size) : 36;
  const h = exact ? (height ?? size) : 36;
  // Proportions read off the 36 px drawing; strokes keep a 2 / 1 px floor.
  const left = (6.8 / 36) * w;
  const paperRight = ((4.7 + 26.6) / 36) * w;
  const thick = Math.max(2, h / 31);
  const thin = Math.max(1, h / 49);
  const lines = [
    { y: 5.6, w: 10.7, h: thick, fill: 'fill-label-ink-2' },
    { y: 7.9, w: 16, h: thin, fill: 'fill-label-line-2' },
    { y: 13.1, w: 13.3, h: thick, fill: 'fill-label-ink-2' },
    { y: 15.4, w: 18.6, h: thin, fill: 'fill-label-line' },
  ];
  return (
    <svg
      aria-hidden="true"
      width={exact ? w : size}
      height={exact ? h : size}
      viewBox={`0 0 ${w} ${h}`}
      className={cn('shrink-0', className)}
    >
      <rect width={w} height={h} rx={radius} className={TONE[tone]} />
      <rect
        x={(4.7 / 36) * w}
        y={(3.6 / 36) * h}
        width={(26.6 / 36) * w}
        height={(28.8 / 36) * h}
        rx="1"
        className="fill-paper"
      />
      {lines.map((line) => (
        <rect
          key={line.y}
          x={left}
          y={(line.y / 36) * h}
          width={(line.w / 36) * w}
          height={line.h}
          className={line.fill}
        />
      ))}
      {BARS.filter(([x, bw]) => left + x + bw <= paperRight - barMargin).map(
        ([x, bw]) => (
          <rect
            key={x}
            x={left + x}
            y={(20.3 / 36) * h}
            width={bw}
            height={(8.1 / 36) * h}
            className="fill-label-ink"
          />
        ),
      )}
    </svg>
  );
}

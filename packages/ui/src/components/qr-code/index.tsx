import { cn } from '#lib/tv';

export type QrCodeProps = {
  /** Rows of modules, `#` for dark and `.` for light, all the same length. */
  matrix: string[];
  /** Size of one module, in px. */
  module?: number;
  /** Accessible text: the code the QR carries. */
  label?: string;
  className?: string;
};

/**
 * A QR code drawn from its module matrix, on a white board with a quiet
 * zone. Rendering stays out of the component: the matrix comes from the
 * encoder (or a fixture), so the picture in a story is the real one.
 */
export function QrCode({ matrix, module = 9, label, className }: QrCodeProps) {
  const size = matrix.length;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 rounded-[calc(var(--radius-card)/2)] bg-white pt-2.5 pr-[9px] pb-[9px] pl-2.5',
        className,
      )}
    >
      <svg
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        width={size * module}
        height={size * module}
        viewBox={`0 0 ${size} ${size}`}
        shapeRendering="crispEdges"
        className="fill-black"
      >
        {matrix.flatMap((row, y) =>
          [...row].map((cell, x) =>
            cell === '#' ? (
              <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} />
            ) : null,
          ),
        )}
      </svg>
    </span>
  );
}

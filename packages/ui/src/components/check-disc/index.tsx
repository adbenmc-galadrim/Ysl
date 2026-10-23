import { cn } from '#lib/tv';

/** The check in a green disc, used on the read card and the photos. */
export function CheckDisc({
  size,
  d,
  stroke,
  className,
}: {
  size: number;
  d: string;
  stroke: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    >
      <circle cx={size / 2} cy={size / 2} r={size / 2} className="fill-ios-green" />
      <path
        d={d}
        className="fill-none stroke-white"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

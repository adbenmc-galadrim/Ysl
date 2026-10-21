import { cn } from '#lib/tv';

export type SkeletonProps = {
  /** Width in px, or any CSS length; bars follow the text they stand for. */
  width?: number | string;
  height?: number;
  /** Bars are rounded to half their height, as in the mockups, unless set. */
  /** A length, or a radius token such as `var(--radius-tile)`. */
  radius?: number | string;
  className?: string;
};

/**
 * A grey placeholder bar. It is drawn at the size of the text it replaces,
 * so the list does not jump when the rows arrive.
 */
export function Skeleton({
  width = '100%',
  height = 14,
  radius,
  className,
}: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn('block shrink-0 bg-fill-2', className)}
      style={{ width, height, borderRadius: radius ?? height / 2 }}
    />
  );
}

export type SkeletonRowProps = {
  /** Draws the hairline a `ListRow` would have, keeping the 78 px pitch. */
  separator?: boolean;
  className?: string;
};

/** A `ListRow` still loading: the tile and its three lines. */
export function SkeletonRow({ separator = true, className }: SkeletonRowProps) {
  return (
    <div className={cn('flex gap-3', className)}>
      <Skeleton
        width={40}
        height={40}
        radius="var(--radius-tile)"
        className="mt-[7px]"
      />
      <span
        className={cn(
          'flex min-w-0 flex-1 flex-col pt-2',
          // The 20 px under the last bar is the separator block of a list
          // row, so skeleton and real rows share one pitch.
          separator && 'pb-5',
        )}
      >
        <Skeleton width={160} height={14} radius={2} className="max-w-full" />
        <Skeleton width={110} height={12} className="mt-2 max-w-full" />
        <Skeleton width={190} height={10} className="mt-1.5 max-w-full" />
      </span>
    </div>
  );
}

export type SkeletonSectionProps = {
  rows?: number;
  className?: string;
};

/** A whole list section still loading: its title bar and a few rows. */
export function SkeletonSection({ rows = 3, className }: SkeletonSectionProps) {
  return (
    <section
      aria-busy="true"
      aria-label="Chargement"
      className={cn('flex flex-col', className)}
    >
      <span className="flex h-6 items-center">
        <Skeleton width={200} height={20} radius={4} className="max-w-full" />
      </span>
      <div className="mt-6">
        {Array.from({ length: rows }, (_, i) => (
          <SkeletonRow key={i} separator={i < rows - 1} />
        ))}
      </div>
    </section>
  );
}

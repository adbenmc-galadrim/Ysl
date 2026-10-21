import { cn } from '#lib/tv';

export type BarChartProps = {
  /** One value per bar, oldest first. */
  values: number[];
  /** The bar drawn in ink, today by default (the last one). */
  highlight?: number;
  /** Top of the scale; the largest value when left out. */
  max?: number;
  /** Height of the tallest bar, in px. */
  height?: number;
  /** Accessible summary, since the bars themselves are not read out. */
  label: string;
  className?: string;
};

/**
 * Parcels per day, as plain bars on a baseline: no axis, no numbers. The
 * point is the shape of the month and where today sits in it; the totals
 * are in the tiles above.
 *
 * Each bar owns an equal column, so the chart follows the screen width while
 * the bars keep the mockup's 11 px.
 */
export function BarChart({
  values,
  highlight = values.length - 1,
  max = Math.max(...values),
  height = 123,
  label,
  className,
}: BarChartProps) {
  return (
    <figure aria-label={label} className={cn('flex flex-col', className)}>
      <div
        className="grid items-end"
        style={{
          height,
          gridTemplateColumns: `repeat(${values.length}, minmax(0, 1fr))`,
        }}
      >
        {values.map((value, i) => (
          <span
            key={i}
            className={cn(
              'w-[11px] rounded-[3px]',
              i === highlight ? 'bg-ink' : 'bg-faint',
            )}
            style={{ height: `${(value / max) * 100}%` }}
          />
        ))}
      </div>
      <span className="h-px bg-separator" />
    </figure>
  );
}

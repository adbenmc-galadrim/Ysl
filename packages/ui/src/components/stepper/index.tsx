import { cn } from '#lib/tv';

export type StepperProps = {
  value: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  /** Accessible name of the count, e.g. "Nombre de colis". */
  label: string;
  className?: string;
};

/**
 * − 1 +. Counts are small and corrected by one, so two big targets beat a
 * number keyboard covering half the form.
 */
export function Stepper({
  value,
  onValueChange,
  min = 1,
  max = 99,
  label,
  className,
}: StepperProps) {
  const step = (by: number) =>
    onValueChange?.(Math.min(max, Math.max(min, value + by)));
  const button =
    'h-full w-[30px] cursor-pointer text-22 font-medium outline-none focus-visible:ring-2 focus-visible:ring-blue disabled:cursor-default disabled:opacity-30';
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex h-11 shrink-0 items-center gap-px rounded-chip bg-fill px-[7px] text-ink',
        className,
      )}
    >
      <button
        type="button"
        aria-label="Moins"
        disabled={value <= min}
        onClick={() => step(-1)}
        className={button}
      >
        −
      </button>
      <output
        aria-live="polite"
        className="w-[30px] text-center text-18 font-semibold"
      >
        {value}
      </output>
      <button
        type="button"
        aria-label="Plus"
        disabled={value >= max}
        onClick={() => step(1)}
        className={button}
      >
        +
      </button>
    </div>
  );
}

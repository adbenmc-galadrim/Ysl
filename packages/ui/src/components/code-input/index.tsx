import { cn } from '#lib/tv';

export type CodeInputProps = {
  /** The digits typed so far. */
  value: string;
  /** Number of boxes. */
  length?: number;
  /** Whether the next empty box shows the focus frame. */
  focused?: boolean;
  /** Red frames, after a wrong code. */
  invalid?: boolean;
  /** On each box: another mockup's size. */
  boxClassName?: string;
  className?: string;
};

/**
 * One box per digit of a short code. It only displays: typing goes through
 * the `Keypad`, so there is no `<input>` here for the system keyboard to
 * attach to. The next box to fill wears the focus frame, which is how the
 * agent sees where the following digit will land.
 */
export function CodeInput({
  value,
  length = 4,
  focused = true,
  invalid = false,
  boxClassName,
  className,
}: CodeInputProps) {
  return (
    <div
      role="group"
      aria-label={`Code à ${length} chiffres`}
      className={cn('flex justify-center gap-3', className)}
    >
      {Array.from({ length }, (_, i) => {
        const current = focused && i === value.length;
        return (
          <span
            key={i}
            className={cn(
              'flex h-[68px] w-14 items-center justify-center rounded-control font-mono text-30 font-semibold',
              current
                ? 'border-2 border-ink bg-fill'
                : 'border border-border bg-surface',
              invalid && 'border-red text-red',
              boxClassName,
            )}
          >
            {value[i] ?? ''}
          </span>
        );
      })}
    </div>
  );
}

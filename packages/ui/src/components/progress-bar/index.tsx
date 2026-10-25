import { tv, type VariantProps } from '#lib/tv';

/**
 * A 6 px bar on a grey track. Its colour is the state, not decoration:
 * ink while running, green once done, orange when paused.
 */
export const progressBarVariants = tv({
  slots: {
    track: 'h-1.5 w-full overflow-hidden rounded-[3px] bg-separator',
    bar: 'h-full rounded-[3px]',
  },
  variants: {
    tone: {
      ink: { bar: 'bg-ink' },
      green: { bar: 'bg-green' },
      orange: { bar: 'bg-orange' },
      blue: { bar: 'bg-blue' },
    },
  },
  defaultVariants: { tone: 'ink' },
});

export type ProgressBarProps = VariantProps<typeof progressBarVariants> & {
  /** From 0 to 1. */
  value: number;
  /** Accessible name, e.g. what is being downloaded. */
  label?: string;
  className?: string;
};

export function ProgressBar({ value, tone, label, className }: ProgressBarProps) {
  const styles = progressBarVariants({ tone });
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={styles.track({ class: className })}
    >
      <div className={styles.bar()} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

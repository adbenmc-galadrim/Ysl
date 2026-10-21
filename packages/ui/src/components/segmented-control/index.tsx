import { cn, tv, type VariantProps } from '#lib/tv';

export const segmentedControlVariants = tv({
  slots: {
    root: 'grid auto-cols-fr grid-flow-col gap-1 rounded-chip p-1',
    segment: [
      'h-8 cursor-pointer truncate rounded-chip px-0.5 text-14 font-semibold outline-none',
      'focus-visible:ring-2 focus-visible:ring-blue',
    ],
  },
  variants: {
    tone: {
      /** Over the camera: dark track, the chosen segment white. */
      night: { root: 'bg-night', segment: 'text-white aria-checked:bg-white aria-checked:text-black' },
      /** On a white screen: grey track, the chosen segment black. */
      light: { root: 'bg-fill', segment: 'text-ink aria-checked:bg-black aria-checked:text-white' },
    },
  },
  defaultVariants: { tone: 'light' },
});

export type SegmentedControlProps<T extends string> = VariantProps<
  typeof segmentedControlVariants
> & {
  options: readonly T[];
  value: T;
  onChange?: (value: T) => void;
  /** Accessible name: "Type d’envoi". */
  label: string;
  className?: string;
};

/**
 * A few exclusive modes side by side, all always visible: what the camera
 * is reading (parcel, registered letter, letter). Unlike chips it is a
 * single control of equal segments, so it reads as "one of these".
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  tone,
  className,
}: SegmentedControlProps<T>) {
  const s = segmentedControlVariants({ tone });
  return (
    <div role="radiogroup" aria-label={label} className={s.root({ class: className })}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange?.(option)}
          className={cn(s.segment())}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

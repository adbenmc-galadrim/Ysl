import type { ReactNode } from 'react';

import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * A state as a coloured dot and a word, for a table cell where a tile would
 * be too heavy. The colours are the ones of the phone's state tiles, so a
 * parcel reads the same on the desk computer and on the iPhone.
 */
export const statusDotVariants = tv({
  base: 'shrink-0 rounded-full',
  variants: {
    tone: {
      ink: 'bg-ink',
      red: 'bg-red',
      orange: 'bg-orange',
      blue: 'bg-blue',
      green: 'bg-green',
      grey: 'bg-faint',
    },
    size: {
      md: 'size-2.5',
      /** 8 px beside regular 13 px text, in a `DeskTable` cell, whose text sits above centre. */
      sm: 'mt-[2.5px] size-2',
    },
  },
  defaultVariants: { tone: 'ink', size: 'md' },
});

export type StatusDotProps = VariantProps<typeof statusDotVariants> & {
  label: ReactNode;
  className?: string;
};

export function StatusDot({ tone, size, label, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-flex min-w-0 items-center',
        size === 'sm' ? 'gap-1.5' : 'gap-2',
        className,
      )}
    >
      <span className={statusDotVariants({ tone, size })} />
      <span
        className={cn(
          'truncate',
          size === 'sm' ? 'text-13' : 'text-14 font-medium',
        )}
      >
        {label}
      </span>
    </span>
  );
}

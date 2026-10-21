import type { ReactNode } from 'react';

import { cn, tv, type VariantProps } from '#lib/tv';

/**
 * A state as a coloured dot and a word, for a table cell where a tile would
 * be too heavy. The colours are the ones of the phone's state tiles, so a
 * parcel reads the same on the desk computer and on the iPhone.
 */
export const statusDotVariants = tv({
  base: 'size-2.5 shrink-0 rounded-full',
  variants: {
    tone: {
      ink: 'bg-ink',
      red: 'bg-red',
      orange: 'bg-orange',
      blue: 'bg-blue',
      green: 'bg-green',
      grey: 'bg-faint',
    },
  },
  defaultVariants: { tone: 'ink' },
});

export type StatusDotProps = VariantProps<typeof statusDotVariants> & {
  label: ReactNode;
  className?: string;
};

export function StatusDot({ tone, label, className }: StatusDotProps) {
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2', className)}>
      <span className={statusDotVariants({ tone })} />
      <span className="truncate text-14 font-medium">{label}</span>
    </span>
  );
}

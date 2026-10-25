import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn, tv, type VariantProps } from '#lib/tv';

const tileVariants = tv({
  base: 'flex size-[100px] items-center justify-center rounded-tile-lg text-white',
  variants: {
    tone: {
      green: 'bg-green-solid',
      red: 'bg-red-solid',
      orange: 'bg-orange-solid',
      blue: 'bg-blue-solid',
      black: 'bg-ink text-on-ink',
    },
  },
  defaultVariants: { tone: 'green' },
});

export type ResultHeroProps = VariantProps<typeof tileVariants> & {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
};

/**
 * The outcome of a flow, drawn big: a solid tile, a large title, one line
 * of context. It closes a task ("3 colis remis"), so unlike `EmptyState` the
 * tile is filled with the colour of the result, readable at a glance by the
 * person on the other side of the desk too.
 */
export function ResultHero({
  icon = 'tick',
  tone,
  title,
  description,
  className,
}: ResultHeroProps) {
  return (
    <div className={cn('flex flex-col items-center text-center', className)}>
      <span className={tileVariants({ tone })}>
        <Icon name={icon} size={50} strokeWidth={3} />
      </span>
      <h2 className="mt-[30px] text-30 font-bold">{title}</h2>
      {description && (
        <p className="mt-2 text-17 text-muted">{description}</p>
      )}
    </div>
  );
}

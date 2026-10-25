import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

/**
 * The 40 px square that opens a list row. Its tone is the parcel's state, so
 * the column of tiles reads as a status column before any text is read.
 * The background is the tone at 12 %, not a separate soft colour: that is how
 * the mockups draw it and it keeps every tint in step with its hue.
 */
export const iconTileVariants = tv({
  base: 'relative inline-flex size-10 shrink-0 items-center justify-center rounded-tile',
  variants: {
    tone: {
      neutral: 'bg-ink/12 text-ink',
      red: 'bg-red/12 text-red',
      orange: 'bg-orange/12 text-orange',
      blue: 'bg-blue/12 text-blue',
      green: 'bg-green/12 text-green',
      grey: 'bg-muted/12 text-muted',
      fill: 'bg-fill text-ink',
      /** Solid ink: the mailroom's own mark, e.g. as an e-mail sender. */
      ink: 'bg-ink text-on-ink',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export type IconTileProps = VariantProps<typeof iconTileVariants> & {
  icon: IconName;
  className?: string;
};

export function IconTile({ icon, tone, className }: IconTileProps) {
  return (
    <span className={iconTileVariants({ tone, class: className })}>
      <Icon name={icon} size={20} />
    </span>
  );
}

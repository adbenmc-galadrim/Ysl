import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

/**
 * The big rounded square that opens a start-up or permission screen. It is
 * the one picture of the screen, so it says in a glance what is asked
 * (the camera) or what went wrong (the camera, struck out in red).
 */
export const heroTileVariants = tv({
  base: 'relative inline-flex shrink-0 items-center justify-center',
  variants: {
    tone: {
      fill: 'bg-fill text-black',
      ink: 'bg-black text-white',
      red: 'bg-red-soft text-red',
    },
    size: {
      /** 120: a permission request, alone in the middle of the screen. */
      xl: 'size-[120px] rounded-tile-lg',
      /** 100: the same screen when something went wrong. */
      lg: 'size-[100px] rounded-tile-lg',
      /** 64: the app mark above a sign-in form. */
      md: 'size-16 rounded-tile',
    },
  },
  defaultVariants: { tone: 'fill', size: 'xl' },
});

/** Icon box and stroke per tile size, as drawn in Penpot. */
const ICON = {
  xl: { size: 52, stroke: 1.6 },
  lg: { size: 44, stroke: 1.6 },
  md: { size: 32, stroke: 1.8 },
} as const;

export type HeroTileProps = VariantProps<typeof heroTileVariants> & {
  icon: IconName;
  /** Strikes the icon out: a permission refused, a feature off. */
  crossed?: boolean;
  className?: string;
};

export function HeroTile({
  icon,
  tone,
  size = 'xl',
  crossed = false,
  className,
}: HeroTileProps) {
  const glyph = ICON[size];
  return (
    <span
      aria-hidden="true"
      className={heroTileVariants({ tone, size, class: className })}
    >
      <Icon name={icon} size={glyph.size} strokeWidth={glyph.stroke} />
      {crossed && (
        // A bar rather than a "-off" icon: the mockup strikes the very icon
        // the healthy screen shows, so both screens read as the same thing.
        <span className="absolute h-[3px] w-[72%] -rotate-45 rounded-[2px] bg-current" />
      )}
    </span>
  );
}

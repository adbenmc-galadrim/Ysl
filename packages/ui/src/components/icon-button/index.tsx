import type { ComponentProps } from 'react';

import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

export const iconButtonVariants = tv({
  base: [
    'inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-tile',
    'outline-none focus-visible:ring-2 focus-visible:ring-blue',
    'transition-[filter] active:brightness-90',
  ],
  variants: {
    variant: {
      /** Grey square on white screens: back, edit, menu. */
      fill: 'bg-fill text-ink',
      /** Dark square over the camera: close, torch. */
      night: 'bg-night text-white',
      /** No background, for a trailing icon in a navigation bar. */
      ghost: 'bg-transparent text-ink',
    },
    size: {
      md: 'size-10',
      lg: 'size-11',
    },
  },
  defaultVariants: { variant: 'fill', size: 'md' },
});

export type IconButtonProps = ComponentProps<'button'> &
  VariantProps<typeof iconButtonVariants> & {
    icon: IconName;
    /** Required: an icon alone has no accessible name. */
    label: string;
    iconSize?: number;
  };

export function IconButton({
  icon,
  label,
  variant,
  size,
  iconSize = 20,
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={iconButtonVariants({ variant, size, class: className })}
      {...props}
    >
      <Icon name={icon} size={iconSize} />
    </button>
  );
}

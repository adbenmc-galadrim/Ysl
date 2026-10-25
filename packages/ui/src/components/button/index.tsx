import type { ComponentProps } from 'react';

import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

export const buttonVariants = tv({
  base: [
    'inline-flex shrink-0 cursor-pointer items-center justify-center whitespace-nowrap',
    'font-semibold outline-none select-none',
    'focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-40',
    'transition-[filter,background-color] active:brightness-90',
  ],
  variants: {
    variant: {
      /** The one ink-filled action of a screen: black, white in the dark. */
      primary: 'bg-ink text-on-ink',
      /** Grey fill, for the action next to the primary one. */
      secondary: 'bg-fill text-ink',
      /** Surface with a hairline, on grey or dark surfaces. */
      outline: 'border border-border bg-surface text-ink',
      danger: 'bg-red-soft text-red',
      /** Solid red: the one action of a screen that undoes something. */
      destructive: 'bg-red-solid text-white',
      warning: 'bg-orange-soft text-orange',
      success: 'bg-green-soft text-green',
      info: 'bg-blue-soft text-blue',
      /** Text only, in the link blue of iOS navigation bars. */
      link: 'bg-transparent font-normal text-blue',
      /** Inverted, on the camera screens. */
      light: 'bg-white text-black',
      night: 'bg-night text-white',
      /**
       * Greyed out while a step is not done yet ("Continuer" during a
       * download): flat grey rather than a faded black, as in the mockups.
       */
      inactive: 'bg-separator text-muted-2 disabled:opacity-100',
    },
    size: {
      /** 52 px: the bottom bar actions. */
      lg: 'h-[52px] gap-[9px] rounded-button px-5 text-17',
      /** 44 px: actions inside a sheet or a card. */
      md: 'h-[44px] gap-2 rounded-button px-4 text-16',
      /** 36 px: filters and segmented choices. */
      sm: 'h-[36px] gap-1.5 rounded-chip px-3.5 text-15',
      /** 32 px: the inline action on a list row or a section header. */
      xs: 'h-[32px] gap-1.5 rounded-chip px-3 text-14',
    },
    block: { true: 'w-full' },
  },
  compoundVariants: [{ variant: 'link', class: 'h-auto px-0' }],
  defaultVariants: { variant: 'primary', size: 'lg' },
});

export type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Leading icon. Its size follows the button: 22 on `lg`, 18 below. */
    icon?: IconName;
    /** Overrides the icon size, e.g. 20 on a 52 px button set in 16 px. */
    iconSize?: number;
  };

/**
 * A plain `<button>`; anything that is not a button wears `buttonVariants()`
 * on its own `className` instead, as in Emis.
 *
 * `type` defaults to `button` because the HTML default is `submit`.
 */
export function Button({
  variant,
  size,
  block,
  icon,
  iconSize: iconSizeProp,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const iconSize =
    iconSizeProp ?? (size === undefined || size === 'lg' ? 22 : 18);
  return (
    <button
      type={type}
      className={buttonVariants({ variant, size, block, class: className })}
      {...props}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
    </button>
  );
}

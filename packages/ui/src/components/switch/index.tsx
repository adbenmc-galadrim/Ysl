import type { ComponentProps } from 'react';

import { cn } from '#lib/tv';

export type SwitchProps = Omit<
  ComponentProps<'button'>,
  'onChange' | 'role' | 'aria-checked'
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Required unless the row label is wired with `aria-labelledby`. */
  label?: string;
};

/**
 * The iOS toggle, at its native 51 × 31 size so it sits in a 52 px row like
 * the system one — but squared off to the 6 px chip radius of the app's
 * "less rounded" pass, knob included.
 */
export function Switch({
  checked,
  onCheckedChange,
  label,
  disabled,
  className,
  type = 'button',
  ...props
}: SwitchProps) {
  return (
    <button
      type={type}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'relative inline-flex h-[31px] w-[51px] shrink-0 cursor-pointer items-center rounded-chip p-0.5',
        'transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        'disabled:cursor-default disabled:opacity-40',
        checked ? 'bg-ios-green' : 'bg-separator',
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          'size-[27px] rounded-chip bg-white transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

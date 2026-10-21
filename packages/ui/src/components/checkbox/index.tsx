import type { ComponentProps } from 'react';

import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type CheckboxProps = Omit<
  ComponentProps<'button'>,
  'onChange' | 'children'
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  /** Required: the circle alone has no accessible name. */
  label: string;
  /**
   * `checkbox` for multi-selection in a list, `radio` when the circle marks
   * the one chosen option of a group.
   */
  role?: 'checkbox' | 'radio';
};

/**
 * The round iOS selection mark: a grey ring, or a black disc with a white
 * tick. Round rather than square because it lives in lists and option
 * cards, where iOS never shows a square box.
 */
export function Checkbox({
  checked,
  onCheckedChange,
  label,
  role = 'checkbox',
  className,
  type = 'button',
  ...props
}: CheckboxProps) {
  return (
    <button
      type={type}
      role={role}
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange?.(!checked)}
      className={cn(
        'flex shrink-0 cursor-pointer rounded-full outline-none',
        'focus-visible:ring-2 focus-visible:ring-blue focus-visible:ring-offset-2',
        className,
      )}
      {...props}
    >
      <CheckCircle checked={checked} />
    </button>
  );
}

/**
 * The circle alone, for a control that is itself the button — an option
 * card — where a nested button would be invalid.
 */
export function CheckCircle({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-full',
        checked ? 'bg-black text-white' : 'bg-white ring-2 ring-faint ring-inset',
        className,
      )}
    >
      {checked && <Icon name="tick" size={14} strokeWidth={3} />}
    </span>
  );
}

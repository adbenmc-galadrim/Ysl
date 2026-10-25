import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type KeypadFieldProps = {
  /** What was typed, grouped as printed: "8779 7487 33". */
  value: string;
  /** Grey text while nothing is typed. */
  placeholder?: string;
  /** Draws the caret after the value. */
  focused?: boolean;
  /** Names the field for VoiceOver: "Numéro de suivi". */
  label?: string;
  className?: string;
};

/**
 * A long number typed on the `Keypad`: a tracking number the scanner could
 * not read. One wide box rather than `CodeInput`'s one box per digit, since
 * its length depends on the carrier. Like `CodeInput` it only displays, so
 * the system keyboard never opens over the keypad.
 */
export function KeypadField({
  value,
  placeholder,
  focused = true,
  label = 'Numéro de suivi',
  className,
}: KeypadFieldProps) {
  return (
    <div
      role="textbox"
      aria-label={label}
      aria-readonly="true"
      className={cn(
        'flex h-[60px] min-w-0 items-center rounded-control bg-fill px-4 font-mono text-20 font-medium text-ink ring-2 ring-ink ring-inset',
        className,
      )}
    >
      {value ? (
        <span className="truncate whitespace-pre">{value}</span>
      ) : (
        placeholder && <span className="truncate text-muted">{placeholder}</span>
      )}
      {focused && (
        <span
          aria-hidden="true"
          className={cn('h-[26px] w-0.5 shrink-0 bg-ink', value && 'ml-4')}
        />
      )}
    </div>
  );
}

const HINT_TONE = {
  green: 'text-green',
  orange: 'text-orange',
  red: 'text-red',
  muted: 'text-muted',
} as const;

export type KeypadFieldHintProps = {
  tone?: keyof typeof HINT_TONE;
  icon?: IconName;
  children: ReactNode;
  className?: string;
};

/**
 * The verdict under the field, live as the digits come: "Format FedEx
 * reconnu". It names the carrier the number belongs to, which is the check
 * the agent cares about.
 */
export function KeypadFieldHint({
  tone = 'green',
  icon = 'check',
  children,
  className,
}: KeypadFieldHintProps) {
  return (
    <p
      role="status"
      className={cn(
        'flex items-center gap-[9px] pl-[11px] text-14 font-medium',
        HINT_TONE[tone],
        className,
      )}
    >
      <Icon name={icon} size={18} className="shrink-0" />
      {children}
    </p>
  );
}

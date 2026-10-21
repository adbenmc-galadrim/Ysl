import { useId, type ReactNode } from 'react';

import { Switch } from '#components/switch';
import { cn } from '#lib/tv';

export type SwitchRowProps = {
  label: ReactNode;
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
};

/**
 * An on/off option of a form, as its own grey card: a consequence of the
 * form ("warn the employee", "file a reserve") rather than a setting, so it
 * sits among the fields instead of in a grouped settings list. The whole
 * card toggles, not just the switch: a 60 px target for a thumb.
 */
export function SwitchRow({
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
}: SwitchRowProps) {
  const labelId = useId();
  return (
    <div
      onClick={() => !disabled && onCheckedChange?.(!checked)}
      className={cn(
        // `pb-px`: Penpot centres the label half a pixel high.
        'flex h-[60px] cursor-pointer items-center gap-3 rounded-control bg-fill pr-4 pb-px pl-4',
        disabled && 'cursor-default',
        className,
      )}
    >
      <span id={labelId} className="min-w-0 flex-1 text-16">
        {label}
      </span>
      <Switch
        checked={checked}
        disabled={disabled}
        aria-labelledby={labelId}
        // No handler of its own: its click, keyboard included, bubbles to
        // the card, which toggles once.
      />
    </div>
  );
}

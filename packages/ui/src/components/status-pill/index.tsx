import { Icon, type IconName } from '#icons';
import { tv, type VariantProps } from '#lib/tv';

/**
 * A short state with an icon, at the top of a screen: "À jour",
 * "Synchronisation", "Hors ligne". It is information, not a control, so it
 * renders as a `<span>` with a live region for the sync state.
 */
export const statusPillVariants = tv({
  base: 'inline-flex h-8 shrink-0 items-center gap-2 rounded-chip pr-4 pl-2.5 text-13 font-semibold whitespace-nowrap',
  variants: {
    tone: {
      green: 'bg-green-soft text-green',
      grey: 'bg-fill text-ink-2',
      orange: 'bg-orange-soft text-orange-strong',
      red: 'bg-red-soft text-red',
      blue: 'bg-blue-soft text-blue',
    },
  },
  defaultVariants: { tone: 'grey' },
});

export type StatusPillProps = VariantProps<typeof statusPillVariants> & {
  icon: IconName;
  label: string;
  className?: string;
};

export function StatusPill({ icon, label, tone, className }: StatusPillProps) {
  return (
    <span
      role="status"
      className={statusPillVariants({ tone, class: className })}
    >
      <Icon name={icon} size={16} strokeWidth={2.2} />
      {label}
    </span>
  );
}

/** The three sync states the home screen can be in. */
export const SYNC_PILL = {
  synced: { icon: 'check', label: 'À jour', tone: 'green' },
  syncing: { icon: 'refresh', label: 'Synchronisation', tone: 'grey' },
  offline: { icon: 'wifiOff', label: 'Hors ligne', tone: 'orange' },
} as const satisfies Record<string, StatusPillProps>;

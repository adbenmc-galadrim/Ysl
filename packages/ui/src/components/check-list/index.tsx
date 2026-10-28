import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type CheckListItem = {
  icon: IconName;
  label: ReactNode;
  /** A green tick when done; nothing while the step is pending. */
  done?: boolean;
  /**
   * A step the app cannot take yet, said on the right ("bientôt"): the line
   * is greyed, nothing to tap.
   */
  soon?: string;
  /** A step the agent can still take here: the line opens it. */
  onClick?: () => void;
};

export type CheckListProps = {
  items: CheckListItem[];
  className?: string;
};

/**
 * What a flow has secured, one line per proof: "QR code vérifié",
 * "Signature enregistrée", "Envoyé au serveur". The ticks sit in a column on
 * the right so a missing one stands out without reading the labels.
 */
export function CheckList({ items, className }: CheckListProps) {
  return (
    <ul
      className={cn(
        'flex flex-col gap-2.5 rounded-panel border border-separator pt-[17px] pr-[15px] pb-[23px] pl-5',
        className,
      )}
    >
      {items.map((item, i) => {
        const content = (
          <>
            <Icon name={item.icon} size={18} className="shrink-0 text-ink-2" />
            <span
              className={cn(
                'min-w-0 flex-1 truncate',
                item.soon && 'text-muted',
                item.onClick && 'text-blue',
              )}
            >
              {item.label}
            </span>
            {item.soon && (
              <span className="shrink-0 text-13 text-muted">{item.soon}</span>
            )}
            {item.done && (
              <Icon
                name="tick"
                size={16}
                strokeWidth={2.6}
                aria-label="Fait"
                className="shrink-0 text-green"
              />
            )}
            {item.onClick && (
              <Icon
                name="chevron"
                size={16}
                strokeWidth={2.2}
                className="shrink-0 text-faint"
              />
            )}
          </>
        );
        return (
          <li key={i} className="flex items-center gap-[11px] text-15">
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                className="-my-2 flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-[11px] text-left outline-none focus-visible:underline"
              >
                {content}
              </button>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

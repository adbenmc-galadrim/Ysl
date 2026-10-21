import type { ReactNode } from 'react';

import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type DesktopNavItem = {
  id: string;
  label: string;
  icon: IconName;
};

export type DesktopShellProps = {
  /** Name of the service in the sidebar: "Service courrier". */
  brand: string;
  nav: DesktopNavItem[];
  /** `id` of the current section. */
  active: string;
  onNavigate?: (id: string) => void;
  children: ReactNode;
  className?: string;
};

/**
 * The desk computer layout: a fixed 220 px sidebar with the same sections
 * as the phone, and the page beside it taking the rest of the width. On a
 * computer the agent has a keyboard and a large screen, so the lists become
 * tables instead of stretched phone rows.
 */
export function DesktopShell({
  brand,
  nav,
  active,
  onNavigate,
  children,
  className,
}: DesktopShellProps) {
  return (
    <div className={cn('flex h-full min-h-0 w-full bg-white text-ink', className)}>
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-separator bg-sidebar px-3 pt-5">
        <div className="flex items-center gap-2.5 px-2">
          <span className="inline-flex size-8 items-center justify-center rounded-chip bg-ink text-white">
            <Icon name="package" size={18} />
          </span>
          <span className="truncate text-15 font-semibold">{brand}</span>
        </div>
        <nav aria-label="Sections" className="mt-6 flex flex-col gap-1.5">
          {nav.map((item) => {
            const current = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => onNavigate?.(item.id)}
                className={cn(
                  'flex h-[34px] cursor-pointer items-center gap-[11px] rounded-chip pl-[13px] text-left text-14 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-blue',
                  current
                    ? 'bg-sidebar-active font-semibold'
                    : 'font-medium hover:bg-sidebar-active/60',
                )}
              >
                <Icon
                  name={item.icon}
                  size={18}
                  className={current ? 'text-ink' : 'text-ink-2'}
                />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {children}
      </main>
    </div>
  );
}

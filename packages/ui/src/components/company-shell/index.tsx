import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type CompanyShellCompany = {
  /** "Atelier Lumen", or "Courrier" for the platform. */
  name: string;
  /** The role in that company: "Département Studio", "Administrateur". */
  subtitle: string;
  initials: string;
  /** `ink` is a company's own logo, `fill` the neutral one. */
  logoTone?: 'ink' | 'fill';
};

export type CompanyShellAccount = {
  initials: string;
  name: string;
  role: string;
};

export type CompanyShellNavItem = {
  id: string;
  label: string;
  icon: IconName;
  count?: number;
  /** `muted` counts; `orange` and `red` ask for action. */
  countTone?: 'muted' | 'orange' | 'red';
};

export type CompanyShellNavSection = {
  /** Small capitals over the entries: "STUDIO", "RÉGLAGES". */
  title?: string;
  items: CompanyShellNavItem[];
};

/** `width` holds the next separator where the mockup put it. */
export type CompanyShellCrumb = string | { label: string; width?: number };

export type CompanyShellProps = {
  company: CompanyShellCompany;
  nav: CompanyShellNavSection[];
  /** `id` of the current entry. */
  active?: string;
  account: CompanyShellAccount;
  /** From the root to the current page, which is drawn in bold. */
  breadcrumb: CompanyShellCrumb[];
  searchPlaceholder?: string;
  onNavigate?: (id: string) => void;
  /** Drawn over the whole window, sidebar included: a dialog and its scrim. */
  overlay?: ReactNode;
  children: ReactNode;
  className?: string;
};

const COUNT_TONE = {
  muted: 'text-muted',
  orange: 'text-orange',
  red: 'text-red',
} as const;

function CompanyShellNav({
  nav,
  active,
  onNavigate,
}: Pick<CompanyShellProps, 'nav' | 'active' | 'onNavigate'>) {
  return (
    <nav aria-label="Sections" className="mt-[11px] flex flex-col pr-2 pl-2">
      {nav.map((section, i) => (
        <div key={section.title ?? i} className="flex flex-col gap-0.5">
          {section.title && (
            <p className="mt-3.5 mb-[7px] pl-3 text-11 font-semibold tracking-[0.4px] text-muted">
              {section.title}
            </p>
          )}
          {section.items.map((item) => {
            const current = item.id === active;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={current ? 'page' : undefined}
                onClick={() => onNavigate?.(item.id)}
                className={cn(
                  'flex h-8 cursor-pointer items-center gap-2.5 rounded-[6px] px-2.5 text-left text-14 outline-none',
                  'focus-visible:ring-2 focus-visible:ring-blue',
                  current
                    ? 'bg-sidebar-active font-semibold'
                    : 'hover:bg-sidebar-active/60',
                )}
              >
                <Icon
                  name={item.icon}
                  size={16}
                  className={current ? 'text-ink' : 'text-ink-2'}
                />
                <span className="-mt-0.5 min-w-0 flex-1 truncate">
                  {item.label}
                </span>
                {item.count !== undefined && (
                  <span
                    className={cn(
                      '-mt-0.5 text-12 font-semibold',
                      COUNT_TONE[item.countTone ?? 'muted'],
                    )}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function CompanyShellBar({
  breadcrumb,
  searchPlaceholder,
}: Pick<CompanyShellProps, 'breadcrumb' | 'searchPlaceholder'>) {
  return (
    <header className="flex h-[52px] shrink-0 items-start border-b border-separator pt-[10px] pr-6 pl-6">
      <ol className="mr-auto flex min-w-0 pt-1.5 text-13">
        {breadcrumb.map((crumb, i) => {
          const { label, width } =
            typeof crumb === 'string'
              ? { label: crumb, width: undefined }
              : crumb;
          const last = i === breadcrumb.length - 1;
          return (
            <li key={`${i}-${label}`} className="flex whitespace-nowrap">
              <span
                aria-current={last ? 'page' : undefined}
                className={last ? 'font-semibold' : 'text-muted'}
                style={last ? undefined : { minWidth: width }}
              >
                {label}
              </span>
              {!last && (
                <span aria-hidden="true" className="mr-[9px] ml-3 w-[5px] text-faint">
                  /
                </span>
              )}
            </li>
          );
        })}
      </ol>
      <div
        role="search"
        className="flex h-8 w-[280px] shrink-0 items-center gap-2 rounded-[6px] bg-fill pr-2.5 pl-2.5 text-13 text-muted"
      >
        <Icon name="search" size={14} className="shrink-0" />
        <span className="-mt-0.5 min-w-0 flex-1 truncate">
          {searchPlaceholder}
        </span>
        <kbd className="flex h-[18px] w-[30px] shrink-0 items-center justify-center rounded-[4px] bg-surface pb-px font-sans text-11 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]">
          ⌘K
        </kbd>
      </div>
    </header>
  );
}

/**
 * The computer layout of the multi-company model, for the three roles that
 * use one: a 224 px sidebar that names the company and the role, entries with
 * their counters, the account at the bottom; over the page, a breadcrumb and
 * the ⌘K search. The page gets the gutters of the mockups.
 */
export function CompanyShell({
  company,
  nav,
  active,
  account,
  breadcrumb,
  searchPlaceholder = 'Rechercher',
  onNavigate,
  overlay,
  children,
  className,
}: CompanyShellProps) {
  return (
    <div
      className={cn(
        'relative flex h-dvh w-full overflow-hidden bg-surface text-ink',
        className,
      )}
    >
      <aside className="flex w-[224px] shrink-0 flex-col border-r border-separator bg-sidebar">
        <div className="flex h-[57px] shrink-0 items-start border-b border-separator pt-3.5 pr-[13px] pl-4">
          <span
            className={cn(
              'flex size-7 shrink-0 items-center justify-center rounded-[6px] text-11 font-bold',
              company.logoTone === 'fill'
                ? 'bg-fill-2 text-ink'
                : 'bg-ink text-on-ink',
            )}
          >
            {company.initials}
          </span>
          <span className="ml-2 flex min-w-0 flex-1 flex-col">
            <span className="-mt-px truncate text-14 font-semibold">
              {company.name}
            </span>
            <span className="mt-px truncate text-12 text-muted">
              {company.subtitle}
            </span>
          </span>
          <Icon
            name="chevron"
            size={14}
            className="mt-1.5 shrink-0 text-muted"
          />
        </div>
        <CompanyShellNav nav={nav} active={active} onNavigate={onNavigate} />
        <div className="mt-auto mr-2 mb-3 ml-2 flex h-10 shrink-0 items-start gap-2 rounded-[6px] px-2">
          <Avatar
            initials={account.initials}
            size="sm"
            tone="fill"
            className="mt-1.5 rounded-full bg-fill-2"
          />
          <span className="mt-[3px] flex min-w-0 flex-col">
            <span className="truncate text-13 font-semibold">
              {account.name}
            </span>
            <span className="mt-0.5 truncate text-12 text-muted">
              {account.role}
            </span>
          </span>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <CompanyShellBar
          breadcrumb={breadcrumb}
          searchPlaceholder={searchPlaceholder}
        />
        <main className="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-8 pt-6 pb-8">
          {children}
        </main>
      </div>
      {overlay}
    </div>
  );
}

export type DeskPageHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Buttons at the right end, on the line of the title. */
  actions?: ReactNode;
  className?: string;
};

/** The 22 px title of a desktop page, its grey line and its actions. */
export function DeskPageHeader({
  title,
  subtitle,
  actions,
  className,
}: DeskPageHeaderProps) {
  return (
    <header className={cn('flex items-start justify-between', className)}>
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-22 font-bold tracking-[-0.3px]">{title}</h1>
        {subtitle && (
          <p className="relative -top-px text-13 text-muted">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

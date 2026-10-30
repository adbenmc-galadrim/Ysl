import type { ComponentProps, ReactNode } from 'react';

import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTabs } from '#components/desk-tabs';
import { GroupedList } from '#components/grouped-list';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
} from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type EntrepriseTab = 'identite' | 'fonctionnement' | 'conservation';

const ENTREPRISE_TAB = {
  identite: { crumb: 'Identité et e-mails', widths: [113, 98] },
  fonctionnement: { crumb: 'Fonctionnement', widths: [108, 104] },
  conservation: { crumb: 'Conservation', widths: [108, 98] },
} as const;

/** The company's settings on the computer: the shell, the title, the three tabs. */
export function EntrepriseDesk({
  tab,
  company = COMPANY.admin,
  overlay,
  children,
}: {
  tab: EntrepriseTab;
  company?: ComponentProps<typeof CompanyShell>['company'];
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const { crumb, widths } = ENTREPRISE_TAB[tab];
  return (
    <CompanyShell
      company={company}
      nav={COMPANY_ADMIN_NAV}
      active="entreprise"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Entreprise', crumb)}
      overlay={overlay}
    >
      <DeskPageHeader
        title="Entreprise"
        subtitle="Réglages communs à tous les départements"
        className="-mt-1"
      />
      <DeskTabs
        label="Réglages de l’entreprise"
        active={tab}
        className="mt-[16.4px] shrink-0"
        tabs={[
          { id: 'identite', label: 'Identité et e-mails', width: widths[0] },
          { id: 'fonctionnement', label: 'Fonctionnement', width: widths[1] },
          { id: 'conservation', label: 'Conservation' },
        ]}
      />
      {children}
    </CompanyShell>
  );
}

/** The 15 px heading of a form section, with its optional grey line. */
export function DeskSectionTitle({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <h2 className="text-15 font-semibold">{title}</h2>
      {description && (
        <p className="relative -top-px mt-1 h-4 text-13 text-muted">{description}</p>
      )}
    </div>
  );
}

/** A form line: the label and its hint on the left, the control 280 px further. */
export function DeskFormRow({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start', className)}>
      <div className="w-[280px] shrink-0 pt-[7px]">
        <p className="relative -top-px h-4 text-13 font-semibold">{label}</p>
        {hint && <p className="mt-1 text-12 text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The 32 px text field of a desktop form. */
export function DeskInput({
  label,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'aria-label'> & { label: string }) {
  return (
    <input
      aria-label={label}
      className={cn(
        'h-8 w-[360px] rounded-[6px] bg-surface px-2.5 pb-[3px] text-13 text-ink outline-none shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
        'focus-visible:ring-2 focus-visible:ring-blue',
        className,
      )}
      {...props}
    />
  );
}

/** A bordered panel of the desktop settings, its stroke inside its box. */
export function DeskBlock({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'relative shrink-0 rounded-desk bg-surface',
        'after:pointer-events-none after:absolute after:inset-0 after:rounded-desk after:border after:border-separator',
        className,
      )}
    >
      <header
        className={cn(
          'border-b border-separator px-4 pt-3.5',
          subtitle ? 'h-[59px]' : 'h-[45px]',
        )}
      >
        <h2 className="relative -top-px text-14 font-semibold">{title}</h2>
        {subtitle && <p className="mt-[3px] text-12 text-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

/** A settings screen of the phone: the grey page and its centred title. */
export function PhoneSettings({
  title,
  trailing,
  tone = 'fill',
  bottom,
  children,
}: {
  title: string;
  trailing?: ReactNode;
  tone?: 'fill' | 'white';
  bottom?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Screen tone={tone} bottom={bottom} bottomInset={0}>
      <NavBar title={title} trailing={trailing} />
      {children}
    </Screen>
  );
}

/** The round 44 px action at the right of the bar. */
export function PhoneBarButton({ icon, label }: { icon: IconName; label: string }) {
  return (
    <IconButton
      icon={icon}
      label={label}
      size="lg"
      iconSize={22}
      className="-mr-0.5"
    />
  );
}

/** The small grey heading over a card. */
export function PhoneGroupTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <h2
      className={cn(
        'relative -top-px px-4 text-13 font-medium text-muted',
        className,
      )}
    >
      {children}
    </h2>
  );
}

/** A surface card of the phone settings. Its rows draw their own hairlines. */
export function PhoneGroup({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <GroupedList className={cn('rounded-[14px]', className)}>
      {children}
    </GroupedList>
  );
}

export const PHONE_ICON_TONE = {
  ink: 'bg-ink text-on-ink',
  grey: 'bg-muted text-white',
  orange: 'bg-ios-orange-light text-white',
  red: 'bg-ios-red-light text-white',
  green: 'bg-green text-white',
} as const;

export type PhoneRowProps = {
  icon?: { name: IconName; tone: keyof typeof PHONE_ICON_TONE };
  title: ReactNode;
  /** Grey on the right, or a pill. */
  value?: ReactNode;
  chevron?: boolean;
  separator?: boolean;
  /** Penpot set a few of these labels 1 px higher than their neighbours. */
  raised?: boolean;
};

/** A 52 px row of a phone settings card, on the mockups' grid. */
export function PhoneRow({
  icon,
  title,
  value,
  chevron = true,
  separator = false,
  raised = false,
}: PhoneRowProps) {
  return (
    <div
      className={cn(
        'relative flex h-[52px] items-start pr-3.5',
        raised ? 'pt-4' : 'pt-[17px]',
        icon ? 'pl-14' : 'pl-4',
      )}
    >
      {icon && (
        <span
          className={cn(
            'absolute top-3 left-3.5 flex size-7 items-center justify-center rounded-[7px]',
            PHONE_ICON_TONE[icon.tone],
          )}
        >
          <Icon name={icon.name} size={16} strokeWidth={2.2} />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-16">{title}</span>
      {typeof value === 'string' ? (
        <span className="shrink-0 text-16 text-muted">{value}</span>
      ) : (
        value
      )}
      {chevron && (
        <Icon
          name="chevron"
          size={16}
          strokeWidth={2.2}
          className="absolute top-[18px] right-3.5 text-faint"
        />
      )}
      {chevron && <span className="w-[22px] shrink-0" />}
      {separator && (
        <span
          className={cn(
            'absolute right-0 bottom-0 h-px bg-separator',
            icon ? 'left-14' : 'left-4',
          )}
        />
      )}
    </div>
  );
}

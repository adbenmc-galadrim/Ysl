import type { ComponentProps, ReactNode } from 'react';

import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskTabs } from '#components/desk-tabs';
import { cn } from '#lib/tv';

const LOGO_SIZE = {
  24: 'size-6 rounded-[5px] text-[10px]',
  40: 'size-10 rounded-[10px] text-16',
  'desk-40': 'size-10 rounded-[8px] text-16',
  56: 'size-14 rounded-[14px] text-22',
} as const;

/**
 * A client's square: ink once it is active, grey while it is not. Other
 * measures than the usual `size` go in `className`.
 */
export function CompanyLogo({
  initials,
  muted = false,
  size,
  className,
}: {
  /** Two letters, or the icon of a product that has no company yet. */
  initials: ReactNode;
  muted?: boolean;
  size?: keyof typeof LOGO_SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center font-bold',
        size && LOGO_SIZE[size],
        muted ? 'bg-fill-2 text-ink' : 'bg-ink text-on-ink',
        className,
      )}
    >
      {initials}
    </span>
  );
}

const PILL_TONE = {
  green: { root: 'bg-green-soft text-green', dot: 'bg-green' },
  blue: { root: 'bg-fill text-ink', dot: 'bg-blue' },
  orange: { root: 'bg-orange-soft text-orange-strong', dot: 'bg-orange' },
} as const;

/** A company's state on the phone: a dot and a word in a 24 px pill. */
export function CompanyPill({
  tone,
  label,
  className,
}: {
  tone: keyof typeof PILL_TONE;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full pr-2.5 pl-[9px] text-13 font-semibold whitespace-nowrap',
        PILL_TONE[tone].root,
        className,
      )}
    >
      <span className={cn('size-2 rounded-full', PILL_TONE[tone].dot)} />
      <span className="-mt-px">{label}</span>
    </span>
  );
}

export type CompanySettingsTab = 'identity' | 'operation' | 'retention';

const COMPANY_SETTINGS_TAB_WIDTHS = {
  identity: [113, 98],
  operation: [108, 104],
  retention: [108, 98],
} as const;

/** The company's settings on the computer: the shell, the title, the three tabs. */
export function CompanySettingsDesk({
  tab,
  shell,
  overlay,
  children,
}: {
  tab: CompanySettingsTab;
  shell: Omit<ComponentProps<typeof CompanyShell>, 'active' | 'overlay' | 'children'>;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  const widths = COMPANY_SETTINGS_TAB_WIDTHS[tab];
  return (
    <CompanyShell {...shell} active="entreprise" overlay={overlay}>
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
          { id: 'identity', label: 'Identité et e-mails', width: widths[0] },
          { id: 'operation', label: 'Fonctionnement', width: widths[1] },
          { id: 'retention', label: 'Conservation' },
        ]}
      />
      {children}
    </CompanyShell>
  );
}

/** The computer sign-in page: brand at the top left, a 400 px form, a footer. */
export function DeskAuthPage({
  logo,
  logoClass,
  brand,
  product,
  footer,
  fluid = false,
  children,
}: {
  /** Centres the form in any window; the mockup places it for 1440 × 900. */
  fluid?: boolean;
  logo: string;
  logoClass?: string;
  brand: string;
  product?: string;
  footer: string;
  children: ReactNode;
}) {
  return (
    <div className="relative h-dvh w-full overflow-hidden bg-surface text-ink">
      <header className="absolute top-7 left-8 flex h-7 items-center">
        <CompanyLogo
          initials={logo}
          className={cn('size-7 rounded-[6px] text-11', logoClass)}
        />
        <span className="relative -top-0.5 ml-2.5 text-14 font-semibold">{brand}</span>
        {product && <span className="relative -top-0.5 ml-1.5 text-14 text-muted">{product}</span>}
      </header>
      <main
        className={cn(
          'absolute w-[400px]',
          fluid
            ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2'
            : 'top-[216px] left-[520px]',
        )}
      >
        {children}
      </main>
      <footer
        className={cn(
          'absolute inset-x-0 border-t border-separator pt-[15px] pb-[15px] text-center text-12 text-muted',
          fluid ? 'bottom-0' : 'top-[852px]',
        )}
      >
        {footer}
      </footer>
    </div>
  );
}

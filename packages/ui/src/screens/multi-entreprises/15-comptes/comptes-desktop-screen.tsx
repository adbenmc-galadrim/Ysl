import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Button } from '#components/button';
import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import { DeskSidePanel } from '#components/desk-panel';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { DetailsList } from '#components/details-list';
import { StatusDot } from '#components/status-dot';
import { ACCOUNT, COMPANY, COMPANY_ADMIN_NAV, crumbs } from '#fixtures/multi-entreprises';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

type Role = 'navette' | 'departement' | 'admin';

type Account = {
  name: string;
  email: string;
  role: Role;
  department: string;
  state: 'Actif' | 'Invitation envoyée' | 'Suspendu';
  lastLogin: string;
};

const ACCOUNTS: Account[] = [
  {
    name: 'Karim Daoud',
    email: 'karim.daoud@atelier-lumen.fr',
    role: 'navette',
    department: 'Service courrier',
    state: 'Actif',
    lastLogin: 'Aujourd’hui, 8:02',
  },
  {
    name: 'Sophie Lambert',
    email: 'sophie.lambert@atelier-lumen.fr',
    role: 'navette',
    department: 'Service courrier',
    state: 'Actif',
    lastLogin: 'Hier, 17:40',
  },
  {
    name: 'Julie Perrin',
    email: 'julie.perrin@atelier-lumen.fr',
    role: 'departement',
    department: 'Studio',
    state: 'Actif',
    lastLogin: 'Aujourd’hui, 10:51',
  },
  {
    name: 'Thomas Moreau',
    email: 'thomas.moreau@atelier-lumen.fr',
    role: 'departement',
    department: 'Studio',
    state: 'Actif',
    lastLogin: 'Lun., 9:15',
  },
  {
    name: 'Nadia Kessler',
    email: 'nadia.kessler@atelier-lumen.fr',
    role: 'departement',
    department: 'Finance',
    state: 'Invitation envoyée',
    lastLogin: '—',
  },
  {
    name: 'Bruno Vidal',
    email: 'bruno.vidal@atelier-lumen.fr',
    role: 'departement',
    department: 'Juridique',
    state: 'Actif',
    lastLogin: 'Aujourd’hui, 9:30',
  },
  {
    name: 'Élise Garnier',
    email: 'elise.garnier@atelier-lumen.fr',
    role: 'departement',
    department: 'Finance',
    state: 'Suspendu',
    lastLogin: 'Il y a 3 semaines',
  },
  {
    name: 'Claire Bonnet',
    email: 'claire.bonnet@atelier-lumen.fr',
    role: 'admin',
    department: '—',
    state: 'Actif',
    lastLogin: 'Maintenant',
  },
];

const ROLE_TAG: Record<Role, { icon: IconName; label: string; width: number }> = {
  navette: { icon: 'truck', label: 'Navette', width: 76.2 },
  departement: { icon: 'building', label: 'Département', width: 102.6 },
  admin: { icon: 'key', label: 'Administrateur', width: 122.4 },
};

const STATE_TONE = {
  Actif: 'green',
  'Invitation envoyée': 'blue',
  Suspendu: 'orange',
} as const;

function RoleTag({ role }: { role: Role }) {
  const { icon, label, width } = ROLE_TAG[role];
  return (
    <span
      className={cn(
        'mt-[3.5px] flex h-[22px] items-center gap-1 rounded-[4px] bg-fill pl-1.5 text-12 font-medium',
        role !== 'admin' && 'text-ink-2',
      )}
      style={{ width }}
    >
      <Icon
        name={icon}
        size={14}
        className={role === 'admin' ? 'text-blue-strong' : 'text-ink-2'}
      />
      <span className="relative -top-px">{label}</span>
    </span>
  );
}

const NAME: DeskTableColumn<Account> = {
  key: 'name',
  header: 'Nom',
  width: 190,
  cell: (a) => <span className="font-semibold">{a.name}</span>,
};
const ROLE: Omit<DeskTableColumn<Account>, 'width'> = {
  key: 'role',
  header: 'Rôle',
  cell: (a) => <RoleTag role={a.role} />,
};
const DEPARTMENT: DeskTableColumn<Account> = {
  key: 'department',
  header: 'Département',
  width: 150,
  cell: (a) => a.department,
};
const STATE: Omit<DeskTableColumn<Account>, 'width'> = {
  key: 'state',
  header: 'État',
  cell: (a) => <StatusDot size="sm" tone={STATE_TONE[a.state]} label={a.state} />,
};

const FULL_COLUMNS: DeskTableColumn<Account>[] = [
  NAME,
  {
    key: 'email',
    header: 'E-mail',
    width: 260,
    cell: (a) => <span className="text-ink-2">{a.email}</span>,
  },
  { ...ROLE, width: 170 },
  DEPARTMENT,
  { ...STATE, width: 170 },
  {
    key: 'last',
    header: 'Dernière connexion',
    cell: (a) => <span className="text-muted">{a.lastLogin}</span>,
  },
];

const NARROW_COLUMNS: DeskTableColumn<Account>[] = [
  NAME,
  { ...ROLE, width: 170 },
  DEPARTMENT,
  STATE,
];

const TABS = [
  { label: 'Tous', count: 48, textWidth: 31, countWidth: 26 },
  { label: 'Navettes', count: 3, textWidth: 56, countWidth: 20 },
  { label: 'Départements', count: 43, textWidth: 89, countWidth: 26 },
  { label: 'Administrateurs', count: 2, textWidth: 98, countWidth: 20 },
];

function AccountTabs() {
  return (
    <div role="tablist" aria-label="Rôles" className="mt-5 flex h-[29px] shrink-0 gap-6 border-b border-separator">
      {TABS.map((tab, i) => (
        <button
          key={tab.label}
          type="button"
          role="tab"
          aria-selected={i === 0}
          className={cn(
            'relative flex h-7 cursor-pointer items-start gap-1.5 text-14',
            i === 0 ? 'font-semibold' : 'font-medium text-muted',
          )}
        >
          <span className="relative -top-px text-left" style={{ width: tab.textWidth }}>
            {tab.label}
          </span>
          <span
            className={cn(
              'flex h-[18px] items-center justify-center rounded-[9px] pb-[3px] text-11 font-semibold',
              i === 0 ? 'bg-ink text-on-ink' : 'bg-fill',
            )}
            style={{ width: tab.countWidth }}
          >
            {tab.count}
          </span>
          {i === 0 && (
            <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />
          )}
        </button>
      ))}
    </div>
  );
}

function AccountFilter({
  icon,
  label,
  labelWidth,
  className,
}: {
  icon: IconName;
  label: string;
  labelWidth: number;
  className: string;
}) {
  return (
    <button
      type="button"
      className={cn(
        'relative flex h-8 cursor-pointer items-center rounded-[6px] border border-border pb-[2.5px] pl-[9px] text-13',
        className,
      )}
    >
      <Icon name={icon} size={14} className="mt-[2.5px] mr-1.5 text-muted" />
      <span className="text-left text-muted" style={{ width: labelWidth }}>
        {label}
      </span>
      <span className="ml-1.5 font-semibold">Tous</span>
      <Icon
        name="chevron"
        size={10}
        className="absolute top-2.5 right-[9px] rotate-90 text-muted"
      />
    </button>
  );
}

function AccountsLayout({
  subtitle = '48 comptes · 2 invitations en attente',
  children,
}: {
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="comptes"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Comptes')}
      searchPlaceholder="Nom ou e-mail"
    >
      <DeskPageHeader
        title="Comptes"
        subtitle={subtitle}
        actions={
          subtitle.startsWith('48') ? (
            <>
              <Button
                variant="outline"
                size="desk"
                icon="download"
                className="w-[103.6px] justify-start"
              >
                Exporter
              </Button>
              <Button
                size="desk"
                icon="userPlus"
                className="w-[168.4px] justify-start"
              >
                Inviter un compte
              </Button>
            </>
          ) : undefined
        }
      />
      {children}
    </CompanyShell>
  );
}

function AccountsToolbar() {
  return (
    <>
      <AccountTabs />
      <div className="mt-[19px] flex shrink-0 gap-2">
        <AccountFilter icon="building" label="Département" labelWidth={75} className="w-[170px]" />
        <AccountFilter icon="filter" label="État" labelWidth={23} className="w-[118px]" />
      </div>
    </>
  );
}

/** Every account of the company, in the full-width table. */
export function AdminComptesDesktop() {
  return (
    <AccountsLayout>
      <AccountsToolbar />
      <DeskTable
        label="Comptes"
        className="mt-4 w-[1152px] shrink-0"
        columns={FULL_COLUMNS}
        rows={ACCOUNTS}
        rowKey={(a) => a.email}
        rowHeight={44}
        selectable
        footer={<DeskTablePagination range="1–8 sur 48" />}
      />
    </AccountsLayout>
  );
}

function SplitTable({ activeRow }: { activeRow?: string }) {
  return (
    <DeskTable
      label="Comptes"
      className="w-[760px] shrink-0"
      columns={NARROW_COLUMNS}
      rows={ACCOUNTS}
      rowKey={(a) => a.email}
      rowHeight={44}
      selectable
      activeRow={activeRow}
      footer={<DeskTablePagination range="1–8 sur 48" />}
    />
  );
}

function PanelClose() {
  return (
    <Icon
      name="x"
      size={16}
      className="absolute top-[17px] right-[17px] text-muted"
    />
  );
}

function PanelRule({ top }: { top: number }) {
  return <div className="absolute inset-x-0 h-px bg-separator" style={{ top }} />;
}

/** The table with one account's record open beside it. */
export function AdminCompteDetailDesktop() {
  return (
    <AccountsLayout>
      <AccountsToolbar />
      <div className="mt-4 flex items-start gap-4">
        <SplitTable activeRow="julie.perrin@atelier-lumen.fr" />
        <DeskSidePanel className="h-[580px] w-[376px]">
          <PanelClose />
          <Avatar
            initials="JP"
            tone="fill"
            className="absolute top-[15px] left-[15px] rounded-full bg-fill-2 pb-px text-14"
          />
          <p className="absolute top-[15px] left-[67px] text-16 font-bold">
            Julie Perrin
          </p>
          <p className="absolute top-[37px] left-[67px] text-12 text-muted">
            julie.perrin@atelier-lumen.fr
          </p>
          <PanelRule top={71} />
          <div className="absolute inset-x-[15px] top-[86px]">
            <DetailsList
              variant="desk"
              labelWidth={140}
              items={[
                { label: 'Rôle', value: 'Département' },
                { label: 'État', value: 'Actif' },
                { label: 'Invité par', value: 'Claire Bonnet' },
                { label: 'Dernière connexion', value: 'Aujourd’hui, 10:51' },
                { label: 'Appareils', value: 'iPhone, ordinateur' },
              ]}
            />
          </div>
          <PanelRule top={243} />
          <p className="absolute top-[258px] left-[15px] text-13 font-semibold">
            Département
          </p>
          <div className="absolute inset-x-[15px] top-[283px]">
            <PanelSelect value="Studio" />
          </div>
          <p className="absolute top-[325px] left-[15px] text-12 text-muted">
            Ses colis et son annuaire suivent ce département.
          </p>
          <PanelRule top={363} />
          <Button
            variant="outline"
            size="desk"
            icon="key"
            className="absolute inset-x-[15px] top-[379px] h-9 justify-start"
          >
            Renvoyer un lien de mot de passe
          </Button>
          <Button
            variant="outline"
            size="desk"
            icon="pause"
            className="absolute inset-x-[15px] top-[527px] h-9 justify-start text-red"
          >
            Suspendre le compte
          </Button>
        </DeskSidePanel>
      </div>
    </AccountsLayout>
  );
}

function PanelSelect({ value }: { value: string }) {
  return (
    <div className="relative flex h-9 items-center rounded-[6px] pb-0.5 pl-3 text-14 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]">
      {value}
      <Icon
        name="chevron"
        size={12}
        className="absolute top-3 right-3 rotate-90 text-muted"
      />
    </div>
  );
}

const ROLE_OPTIONS = [
  { icon: 'truck', title: 'Navette', text: 'Scanne, tourne, dépose' },
  { icon: 'building', title: 'Département', text: 'Confirme les dépôts et remet', chosen: true },
  { icon: 'key', title: 'Administrateur', text: 'Gère tout, voit tout' },
] as const satisfies readonly {
  icon: IconName;
  title: string;
  text: string;
  chosen?: boolean;
}[];

function InvitePanel({ taken }: { taken: boolean }) {
  return (
    <DeskSidePanel className="h-[580px] w-[376px]">
      <PanelClose />
      <h2 className="absolute top-4 left-[15px] text-15 font-semibold">
        Inviter un compte
      </h2>
      <PanelRule top={51} />
      <p className="absolute top-[66px] left-[15px] text-13 font-semibold">Rôle</p>
      <div className="absolute inset-x-[15px] top-[91px] flex flex-col gap-2">
        {ROLE_OPTIONS.map((option) => {
          const chosen = 'chosen' in option;
          return (
            <div
              key={option.title}
              className={cn(
                'relative h-12 rounded-[6px]',
                chosen
                  ? 'bg-fill shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]'
                  : 'shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
              )}
            >
              <span
                className={cn(
                  'absolute top-[15px] left-3 flex size-[18px] items-center justify-center rounded-full',
                  chosen
                    ? 'bg-ink'
                    : 'shadow-[0_0_0_0.75px_var(--color-border),inset_0_0_0_0.75px_var(--color-border)]',
                )}
              >
                {chosen && <span className="size-1.5 rounded-full bg-on-ink" />}
              </span>
              <Icon
                name={option.icon}
                size={16}
                className={cn(
                  'absolute top-4 left-[42px]',
                )}
              />
              <p
                className={cn(
                  'absolute top-1.5 left-[68px] text-13 font-semibold',
                )}
              >
                {option.title}
              </p>
              <p
                className={cn(
                  'absolute top-[25px] left-[68px] text-12 text-muted',
                )}
              >
                {option.text}
              </p>
            </div>
          );
        })}
      </div>
      <p className="absolute top-[266px] left-[15px] text-13 font-semibold">
        Département
      </p>
      <div className="absolute inset-x-[15px] top-[291px]">
        <PanelSelect value="Finance" />
      </div>
      <p className="absolute top-[334px] left-[15px] text-13 font-semibold">
        Prénom et nom
      </p>
      <div className="absolute inset-x-[15px] top-[359px] flex h-9 items-center rounded-[6px] pb-0.5 pl-3 text-14 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]">
        Nadia Kessler
      </div>
      <p className="absolute top-[402px] left-[15px] text-13 font-semibold">
        E-mail professionnel
      </p>
      <div
        className={cn(
          'absolute inset-x-[15px] top-[427px] flex h-9 items-center rounded-[6px] pb-0.5 pl-3 text-14',
          taken
            ? 'shadow-[0_0_0_0.75px_var(--color-red),inset_0_0_0_0.75px_var(--color-red)]'
            : 'shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]',
        )}
      >
        nadia.kessler@atelier-lumen.fr
      </div>
      <p
        className={cn(
          'absolute top-[469px] left-[15px] text-12',
          taken ? 'text-red' : 'text-muted',
        )}
      >
        {taken
          ? 'Cette adresse a déjà un compte ou une invitation en attente.'
          : 'Elle recevra un lien valable 7 jours.'}
      </p>
      <PanelRule top={511} />
      <div className="absolute inset-x-[15px] top-[527px] flex gap-2">
        <Button variant="outline" size="desk" className="h-9 w-[100px] pt-px">
          Annuler
        </Button>
        <Button
          size="desk"
          icon="send"
          className="h-9 w-[236px] justify-start pt-px [&>svg]:-mt-px"
        >
          Envoyer l’invitation
        </Button>
      </div>
    </DeskSidePanel>
  );
}

/** The invitation form beside the table; `taken` is the address already known. */
export function AdminInviterDesktop({ taken = false }: { taken?: boolean }) {
  return (
    <AccountsLayout>
      <AccountsToolbar />
      <div className="mt-4 flex items-start gap-4">
        <SplitTable />
        <InvitePanel taken={taken} />
      </div>
    </AccountsLayout>
  );
}

/** The list could not be loaded: nothing was changed, try again. */
export function AdminComptesErreurDesktop() {
  return (
    <AccountsLayout subtitle="Liste non chargée">
      <div className="mt-[176px] flex flex-col items-center">
        <span className="flex size-[88px] items-center justify-center rounded-full bg-red-soft text-red">
          <Icon name="wifiOff" size={44} />
        </span>
        <h2 className="mt-5 text-22 font-bold">Impossible de charger</h2>
        <p className="mt-[9px] w-80 text-center text-15 leading-5 text-muted">
          <span className="relative -left-[1.5px]">
            Le serveur ne répond pas. Vérifiez la connexion
          </span>
          <br />
          puis réessayez. Rien n’a été modifié.
        </p>
        <Button
          size="md"
          icon="refresh"
          iconSize={20}
          className="mt-[25px] h-12 w-[180px] rounded-[24px] font-semibold"
        >
          Réessayer
        </Button>
      </div>
    </AccountsLayout>
  );
}

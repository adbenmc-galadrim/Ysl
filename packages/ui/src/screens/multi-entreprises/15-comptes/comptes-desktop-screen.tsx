import type { ChangeEvent, ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Button } from '#components/button';
import {
  CompanyShell,
  type CompanyShellCrumb,
  type CompanyShellProps,
  DeskPageHeader,
} from '#components/company-shell';
import { DeskSidePanel } from '#components/desk-panel';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { DetailsList } from '#components/details-list';
import { StatusDot } from '#components/status-dot';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export type CompteRole = 'navette' | 'departement' | 'admin';

export type CompteState = 'Actif' | 'Invitation envoyée' | 'Suspendu' | 'Révoqué';

/** Someone in the table. `id` is what comes back on a click. */
export type CompteRow = {
  id: string;
  name: string;
  email: string;
  role: CompteRole | null;
  department: string;
  state: CompteState;
  lastLogin: string;
};

export type ComptesOption = { id: string; label: string };

/** A real select laid over a drawn one: the mockup's look, the system's list. */
export type ComptesSelect = {
  value: string;
  label: string;
  options: readonly ComptesOption[];
  onChange?: (id: string) => void;
  disabled?: boolean;
};

function SelectOverlay({
  select,
  name,
}: {
  select: ComptesSelect;
  name: string;
}) {
  return (
    <select
      aria-label={name}
      value={select.value}
      disabled={select.disabled}
      onChange={(event) => select.onChange?.(event.target.value)}
      className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-default"
    >
      {select.options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

const ROLE_TAG: Record<CompteRole, { icon: IconName; label: string; width: number }> = {
  navette: { icon: 'truck', label: 'Navette', width: 76.2 },
  departement: { icon: 'building', label: 'Département', width: 102.6 },
  admin: { icon: 'key', label: 'Administrateur', width: 122.4 },
};

const STATE_TONE = {
  Actif: 'green',
  'Invitation envoyée': 'blue',
  Suspendu: 'orange',
  Révoqué: 'red',
} as const;

function RoleTag({ role }: { role: CompteRole | null }) {
  if (!role) return <span className="text-muted">—</span>;
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

const NAME: DeskTableColumn<CompteRow> = {
  key: 'name',
  header: 'Nom',
  width: 190,
  cell: (a) => <span className="font-semibold">{a.name}</span>,
};
const ROLE: Omit<DeskTableColumn<CompteRow>, 'width'> = {
  key: 'role',
  header: 'Rôle',
  cell: (a) => <RoleTag role={a.role} />,
};
const DEPARTMENT: DeskTableColumn<CompteRow> = {
  key: 'department',
  header: 'Département',
  width: 150,
  cell: (a) => a.department,
};
const STATE: Omit<DeskTableColumn<CompteRow>, 'width'> = {
  key: 'state',
  header: 'État',
  cell: (a) => <StatusDot size="sm" tone={STATE_TONE[a.state]} label={a.state} />,
};

const FULL_COLUMNS: DeskTableColumn<CompteRow>[] = [
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

const NARROW_COLUMNS: DeskTableColumn<CompteRow>[] = [
  NAME,
  { ...ROLE, width: 170 },
  DEPARTMENT,
  { ...STATE, minWidth: 110 },
];

const TAB_TEXT_WIDTH: Record<string, number> = {
  Tous: 31,
  Navettes: 56,
  Départements: 89,
  Administrateurs: 98,
};

export type ComptesTab = { id: string; label: string; count: number };

function AccountTabs({
  tabs,
  active,
  onTab,
}: {
  tabs: readonly ComptesTab[];
  active: string;
  onTab?: (id: string) => void;
}) {
  return (
    <div role="tablist" aria-label="Rôles" className="mt-5 flex h-[29px] shrink-0 gap-6 border-b border-separator">
      {tabs.map((tab) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onTab?.(tab.id)}
            className={cn(
              'relative flex h-7 cursor-pointer items-start gap-1.5 text-14',
              selected ? 'font-semibold' : 'font-medium text-muted',
            )}
          >
            <span
              className="relative -top-px text-left"
              style={{ width: TAB_TEXT_WIDTH[tab.label] }}
            >
              {tab.label}
            </span>
            <span
              className={cn(
                'flex h-[18px] items-center justify-center rounded-[9px] pb-[3px] text-11 font-semibold',
                selected ? 'bg-ink text-on-ink' : 'bg-fill',
              )}
              style={{ minWidth: tab.count < 10 ? 20 : 26 }}
            >
              {tab.count}
            </span>
            {selected && (
              <span className="absolute inset-x-0 bottom-0 h-0.5 bg-ink" />
            )}
          </button>
        );
      })}
    </div>
  );
}

function AccountFilter({
  icon,
  label,
  labelWidth,
  className,
  select,
}: {
  icon: IconName;
  label: string;
  labelWidth: number;
  className: string;
  select: ComptesSelect;
}) {
  return (
    <span
      className={cn(
        'relative flex h-8 items-center rounded-[6px] border border-border pb-[2.5px] pl-[9px] text-13',
        className,
      )}
    >
      <Icon name={icon} size={14} className="mt-[2.5px] mr-1.5 shrink-0 text-muted" />
      <span className="shrink-0 text-left text-muted" style={{ width: labelWidth }}>
        {label}
      </span>
      <span className="ml-1.5 truncate pr-6 font-semibold">{select.label}</span>
      <Icon
        name="chevron"
        size={10}
        className="absolute top-2.5 right-[9px] rotate-90 text-muted"
      />
      <SelectOverlay select={select} name={label} />
    </span>
  );
}

/** Sidebar and bar of the page, the part the app knows and a story invents. */
export type ComptesShell = Pick<
  CompanyShellProps,
  'company' | 'nav' | 'account' | 'onNavigate' | 'search'
> & { companyCrumb: CompanyShellCrumb };

function AccountsLayout({
  company,
  nav,
  account,
  onNavigate,
  search,
  companyCrumb,
  title,
  subtitle,
  actions,
  children,
}: ComptesShell & {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <CompanyShell
      company={company}
      nav={nav}
      active="comptes"
      account={account}
      onNavigate={onNavigate}
      breadcrumb={[companyCrumb, title]}
      search={search}
      searchPlaceholder="Nom ou e-mail"
    >
      <DeskPageHeader title={title} subtitle={subtitle} actions={actions} />
      {children}
    </CompanyShell>
  );
}

export type ComptesDesktopProps = ComptesShell & {
  title: string;
  subtitle: string;
  tabs: readonly ComptesTab[];
  activeTab: string;
  onTab?: (id: string) => void;
  departmentFilter: ComptesSelect;
  stateFilter: ComptesSelect;
  rows: readonly CompteRow[];
  activeRow?: string;
  onSelect?: (id: string) => void;
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Drawn in the mockup; left out until the export exists. */
  onExport?: () => void;
  addLabel: string;
  onAdd?: () => void;
  /** The record or the form opened beside the table, which then narrows. */
  panel?: ReactNode;
};

/** Every account of the company in the table; a record or a form may open beside it. */
export function ComptesDesktop({
  title,
  subtitle,
  tabs,
  activeTab,
  onTab,
  departmentFilter,
  stateFilter,
  rows,
  activeRow,
  onSelect,
  range,
  onPrevious,
  onNext,
  onExport,
  addLabel,
  onAdd,
  panel,
  ...shell
}: ComptesDesktopProps) {
  const table = {
    label: 'Comptes',
    rows: [...rows],
    rowKey: (row: CompteRow) => row.id,
    rowHeight: 44,
    selectable: true,
    activeRow,
    onRowClick: onSelect && ((row: CompteRow) => onSelect(row.id)),
    footer: (
      <DeskTablePagination
        range={range}
        onPrevious={onPrevious}
        onNext={onNext}
      />
    ),
  };
  return (
    <AccountsLayout
      {...shell}
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {onExport && (
            <Button
              variant="outline"
              size="desk"
              icon="download"
              className="w-[103.6px] justify-start"
              onClick={onExport}
            >
              Exporter
            </Button>
          )}
          <Button
            size="desk"
            icon="userPlus"
            className="w-[168.4px] justify-start"
            onClick={onAdd}
          >
            {addLabel}
          </Button>
        </>
      }
    >
      <AccountTabs tabs={tabs} active={activeTab} onTab={onTab} />
      <div className="mt-[19px] flex shrink-0 gap-2">
        <AccountFilter icon="building" label="Département" labelWidth={75} className="w-[170px]" select={departmentFilter} />
        <AccountFilter icon="filter" label="État" labelWidth={23} className="w-[118px]" select={stateFilter} />
      </div>
      {panel ? (
        <div className="mt-4 flex items-start gap-4">
          <DeskTable {...table} shrink className="max-w-[760px] min-w-0 flex-1" columns={NARROW_COLUMNS} />
          {panel}
        </div>
      ) : (
        <DeskTable {...table} shrink className="mt-4 w-full max-w-[1152px] shrink-0" columns={FULL_COLUMNS} />
      )}
    </AccountsLayout>
  );
}

function PanelClose({ onClose }: { onClose?: () => void }) {
  return (
    <button
      type="button"
      aria-label="Fermer"
      onClick={onClose}
      className="absolute top-[17px] right-[17px] cursor-pointer text-muted"
    >
      <Icon name="x" size={16} />
    </button>
  );
}

function PanelRule({ top }: { top: number }) {
  return <div className="absolute inset-x-0 h-px bg-separator" style={{ top }} />;
}

export type CompteRecordPanelProps = {
  initials: string;
  name: string;
  email: string;
  details: readonly { label: string; value: ReactNode }[];
  /** No section for a role that sits in no department. */
  department?: ComptesSelect;
  departmentHint?: string;
  message?: string;
  passwordLabel: string;
  onPassword?: () => void;
  /** The red button at the foot: suspend, or bring back. */
  stateAction?: { label: string; danger: boolean; icon: IconName; onClick?: () => void };
  /** Above it, once the record can be revoked. */
  revoke?: { label: string; onClick?: () => void };
  onClose?: () => void;
};

/** One account's record, opened beside the table. */
export function CompteRecordPanel({
  initials,
  name,
  email,
  details,
  department,
  departmentHint,
  message,
  passwordLabel,
  onPassword,
  stateAction,
  revoke,
  onClose,
}: CompteRecordPanelProps) {
  return (
    <DeskSidePanel className="h-[580px] w-[376px]">
      <PanelClose onClose={onClose} />
      <Avatar
        initials={initials}
        tone="fill"
        className="absolute top-[15px] left-[15px] rounded-full bg-fill-2 pb-px text-14"
      />
      <p className="absolute top-[15px] left-[67px] w-[270px] truncate text-16 font-bold">
        {name}
      </p>
      <p className="absolute top-[37px] left-[67px] w-[270px] truncate text-12 text-muted">
        {email}
      </p>
      <PanelRule top={71} />
      <div className="absolute inset-x-[15px] top-[86px]">
        <DetailsList variant="desk" labelWidth={140} items={[...details]} />
      </div>
      <PanelRule top={243} />
      {department && (
        <>
          <p className="absolute top-[258px] left-[15px] text-13 font-semibold">
            Département
          </p>
          <div className="absolute inset-x-[15px] top-[283px]">
            <PanelSelect select={department} name="Département" />
          </div>
          {departmentHint && (
            <p className="absolute top-[325px] left-[15px] text-12 text-muted">
              {departmentHint}
            </p>
          )}
          <PanelRule top={363} />
        </>
      )}
      <Button
        variant="outline"
        size="desk"
        icon="key"
        className="absolute inset-x-[15px] top-[379px] h-9 justify-start"
        onClick={onPassword}
      >
        {passwordLabel}
      </Button>
      {message && (
        <p role="alert" className="absolute inset-x-[15px] top-[421px] text-12 text-red">
          {message}
        </p>
      )}
      {revoke && (
        <Button
          variant="outline"
          size="desk"
          icon="x"
          className="absolute inset-x-[15px] top-[483px] h-9 justify-start text-red"
          onClick={revoke.onClick}
        >
          {revoke.label}
        </Button>
      )}
      {stateAction && (
        <Button
          variant="outline"
          size="desk"
          icon={stateAction.icon}
          className={cn(
            'absolute inset-x-[15px] top-[527px] h-9 justify-start',
            stateAction.danger && 'text-red',
          )}
          onClick={stateAction.onClick}
        >
          {stateAction.label}
        </Button>
      )}
    </DeskSidePanel>
  );
}

function PanelSelect({ select, name }: { select: ComptesSelect; name: string }) {
  return (
    <div
      className={cn(
        'relative flex h-9 items-center rounded-[6px] pb-0.5 pl-3 text-14 shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]',
        select.disabled && 'text-muted',
      )}
    >
      {select.label}
      <Icon
        name="chevron"
        size={12}
        className="absolute top-3 right-3 rotate-90 text-muted"
      />
      <SelectOverlay select={select} name={name} />
    </div>
  );
}

/** A role that can change, shown like the record's other values. */
export function CompteInlineSelect({
  select,
  name,
}: {
  select: ComptesSelect;
  name: string;
}) {
  return (
    <span className="relative inline-flex items-center gap-1.5">
      {select.label}
      <Icon name="chevron" size={10} className="rotate-90 text-muted" />
      <SelectOverlay select={select} name={name} />
    </span>
  );
}

export type CompteFormRole = {
  id: string;
  icon: IconName;
  title: string;
  text: string;
};

export const COMPTE_ROLE_OPTIONS: readonly CompteFormRole[] = [
  { id: 'shuttle', icon: 'truck', title: 'Navette', text: 'Scanne, tourne, dépose' },
  { id: 'department', icon: 'building', title: 'Département', text: 'Confirme les dépôts et remet' },
  { id: 'company_admin', icon: 'key', title: 'Administrateur', text: 'Gère tout, voit tout' },
];

export type CompteFormValue = {
  role: string;
  departmentId: string;
  name: string;
  email: string;
  password: string;
};

export type CompteFormPanelProps = {
  title: string;
  value: CompteFormValue;
  onChange?: (value: CompteFormValue) => void;
  department: ComptesSelect;
  /** Left out, the form is the mockup's invitation: no password to give. */
  passwordLabel?: string;
  hint: string;
  taken?: boolean;
  submitLabel: string;
  submitIcon: IconName;
  saving?: boolean;
  onSubmit?: () => void;
  onClose?: () => void;
};

const INPUT_BOX =
  'absolute inset-x-[15px] flex h-9 items-center rounded-[6px] pb-0.5 pl-3 text-14';

/** Creating an account, beside the table. */
export function CompteFormPanel({
  title,
  value,
  onChange,
  department,
  passwordLabel,
  hint,
  taken = false,
  submitLabel,
  submitIcon,
  saving = false,
  onSubmit,
  onClose,
}: CompteFormPanelProps) {
  const extra = passwordLabel ? 68 : 0;
  const set =
    (key: 'name' | 'email' | 'password') =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onChange?.({ ...value, [key]: event.target.value });
  return (
    <DeskSidePanel className="w-[376px]" >
      <div className="relative" style={{ height: 578 + extra }}>
      <PanelClose onClose={onClose} />
      <h2 className="absolute top-4 left-[15px] text-15 font-semibold">{title}</h2>
      <PanelRule top={51} />
      <p className="absolute top-[66px] left-[15px] text-13 font-semibold">Rôle</p>
      <div role="radiogroup" aria-label="Rôle" className="absolute inset-x-[15px] top-[91px] flex flex-col gap-2">
        {COMPTE_ROLE_OPTIONS.map((option) => {
          const chosen = option.id === value.role;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={chosen}
              onClick={() => onChange?.({ ...value, role: option.id })}
              className={cn(
                'relative h-12 cursor-pointer rounded-[6px] text-left',
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
              <Icon name={option.icon} size={16} className="absolute top-4 left-[42px]" />
              <span className="absolute top-1.5 left-[68px] text-13 font-semibold">
                {option.title}
              </span>
              <span className="absolute top-[25px] left-[68px] text-12 text-muted">
                {option.text}
              </span>
            </button>
          );
        })}
      </div>
      <p className="absolute top-[266px] left-[15px] text-13 font-semibold">
        Département
      </p>
      <div className="absolute inset-x-[15px] top-[291px]">
        <PanelSelect select={department} name="Département" />
      </div>
      <label htmlFor="compte-name" className="absolute top-[334px] left-[15px] text-13 font-semibold">
        Prénom et nom
      </label>
      <input
        id="compte-name"
        value={value.name}
        onChange={set('name')}
        className={cn(INPUT_BOX, 'top-[359px] w-[344px] shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]')}
      />
      <label htmlFor="compte-email" className="absolute top-[402px] left-[15px] text-13 font-semibold">
        E-mail professionnel
      </label>
      <input
        id="compte-email"
        type="email"
        value={value.email}
        onChange={set('email')}
        aria-invalid={taken}
        className={cn(
          INPUT_BOX,
          'top-[427px] w-[344px]',
          taken
            ? 'shadow-[0_0_0_0.75px_var(--color-red),inset_0_0_0_0.75px_var(--color-red)]'
            : 'shadow-[0_0_0_0.75px_var(--color-ink),inset_0_0_0_0.75px_var(--color-ink)]',
        )}
      />
      <p className={cn('absolute top-[469px] left-[15px] text-12', taken ? 'text-red' : 'text-muted')}>
        {hint}
      </p>
      {passwordLabel && (
        <>
          <label htmlFor="compte-password" className="absolute top-[495px] left-[15px] text-13 font-semibold">
            {passwordLabel}
          </label>
          <input
            id="compte-password"
            type="password"
            autoComplete="new-password"
            value={value.password}
            onChange={set('password')}
            className={cn(INPUT_BOX, 'top-[520px] w-[344px] shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)]')}
          />
        </>
      )}
      <PanelRule top={511 + extra} />
      <div className="absolute inset-x-[15px] flex gap-2" style={{ top: 527 + extra }}>
        <Button variant="outline" size="desk" className="h-9 w-[100px] pt-px" onClick={onClose}>
          Annuler
        </Button>
        <Button
          size="desk"
          icon={submitIcon}
          disabled={saving}
          className="h-9 w-[236px] justify-start pt-px [&>svg]:-mt-px"
          onClick={onSubmit}
        >
          {submitLabel}
        </Button>
      </div>
      </div>
    </DeskSidePanel>
  );
}

/** The list could not be loaded: nothing was changed, try again. */
export function ComptesErreurDesktop({
  onRetry,
  ...shell
}: ComptesShell & { onRetry?: () => void }) {
  return (
    <AccountsLayout {...shell} title="Comptes" subtitle="Liste non chargée">
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
          onClick={onRetry}
        >
          Réessayer
        </Button>
      </div>
    </AccountsLayout>
  );
}

import type { ChangeEvent, FormEvent, ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { Button } from '#components/button';
import {
  CompanyShell,
  type CompanyShellCrumb,
  type CompanyShellProps,
  DeskPageHeader,
} from '#components/company-shell';
import { DeskInput } from '#components/desk-form';
import { DeskSidePanel } from '#components/desk-panel';
import {
  DeskTable,
  type DeskTableColumn,
  DeskTablePagination,
} from '#components/desk-table';
import { DeskTabs, type DeskTab } from '#components/desk-tabs';
import { DetailsList } from '#components/details-list';
import { Icon, type IconName } from '#icons';

/** Sidebar and bar of the page, the part the app knows and a story invents. */
export type AnnuaireShell = Pick<
  CompanyShellProps,
  'company' | 'nav' | 'account' | 'onNavigate' | 'search'
> & { companyCrumb: CompanyShellCrumb };

/** Someone in the table. `id` is what comes back on a click. */
export type AnnuairePerson = {
  id: string;
  name: string;
  email: string;
  department?: string;
  place: string;
  open: number;
};

const NAME_COLUMN: Pick<DeskTableColumn<AnnuairePerson>, 'key' | 'header' | 'cell'> = {
  key: 'name',
  header: 'Nom',
  cell: (e) => <span className="truncate font-semibold">{e.name}</span>,
};

const EMAIL_COLUMN: Pick<DeskTableColumn<AnnuairePerson>, 'key' | 'header' | 'cell'> = {
  key: 'email',
  header: 'E-mail',
  cell: (e) => <span className="truncate text-ink-2">{e.email}</span>,
};

const PLACE_COLUMN: Pick<DeskTableColumn<AnnuairePerson>, 'key' | 'header' | 'cell'> = {
  key: 'place',
  header: 'Lieu',
  cell: (e) => <span className="truncate text-ink-2">{e.place}</span>,
};

const DEPARTMENT_COLUMNS: DeskTableColumn<AnnuairePerson>[] = [
  { ...NAME_COLUMN, width: 190 },
  { ...EMAIL_COLUMN, width: 250 },
  { ...PLACE_COLUMN, width: 140 },
  {
    key: 'open',
    header: 'Colis en cours',
    minWidth: 104,
    cell: (e) => <span className="w-24 text-right">{e.open}</span>,
  },
];

const COMPANY_COLUMNS: DeskTableColumn<AnnuairePerson>[] = [
  { ...NAME_COLUMN, width: 170 },
  { ...EMAIL_COLUMN, width: 230 },
  {
    key: 'department',
    header: 'Département',
    width: 130,
    cell: (e) => <span className="truncate">{e.department}</span>,
  },
  { ...PLACE_COLUMN, width: 110 },
  {
    key: 'open',
    header: 'En cours',
    minWidth: 64,
    cell: (e) => <span className="w-14 text-right">{e.open}</span>,
  },
];

export type AnnuaireDesktopProps = AnnuaireShell & {
  /** `company` draws every department, under tabs; `department` a single one. */
  variant: 'company' | 'department';
  title: string;
  subtitle: string;
  tabs?: DeskTab[];
  activeTab?: string;
  onTab?: (id: string) => void;
  people: AnnuairePerson[];
  activePerson?: string;
  onSelect?: (id: string) => void;
  /** "1–10 sur 312". */
  range: string;
  onPrevious?: () => void;
  onNext?: () => void;
  onAdd?: () => void;
  onImport?: () => void;
  /** The record or the form open beside the table. */
  panel?: ReactNode;
  /** Drawn when nobody matches, in place of the table. */
  empty?: ReactNode;
};

/** The directory of the company or of one department, a record open beside it. */
export function AnnuaireDesktop({
  company,
  nav,
  account,
  onNavigate,
  search,
  companyCrumb,
  variant,
  title,
  subtitle,
  tabs,
  activeTab,
  onTab,
  people,
  activePerson,
  onSelect,
  range,
  onPrevious,
  onNext,
  onAdd,
  onImport,
  panel,
  empty,
}: AnnuaireDesktopProps) {
  const wholeCompany = variant === 'company';
  return (
    <CompanyShell
      company={company}
      nav={nav}
      active="annuaire"
      account={account}
      onNavigate={onNavigate}
      search={search}
      breadcrumb={[companyCrumb, 'Annuaire']}
      searchPlaceholder="Nom ou e-mail"
    >
      <DeskPageHeader
        title={title}
        subtitle={subtitle}
        actions={
          wholeCompany ? (
            <>
              <Button
                variant="outline"
                size="desk"
                icon="upload"
                className="w-[146px] justify-start"
                onClick={onImport}
              >
                Importer un CSV
              </Button>
              <Button
                icon="plus"
                size="desk"
                className="w-24 justify-start"
                onClick={onAdd}
              >
                Ajouter
              </Button>
            </>
          ) : (
            <Button
              icon="userPlus"
              size="desk"
              className="w-[158px] justify-start"
              onClick={onAdd}
            >
              Ajouter un salarié
            </Button>
          )
        }
      />
      {wholeCompany && tabs && (
        <DeskTabs
          label="Départements"
          active={activeTab ?? 'tous'}
          onChange={onTab}
          className="mt-3"
          tabs={tabs}
        />
      )}
      <div
        className={`flex items-start gap-4 ${wholeCompany ? 'mt-[19px]' : 'mt-2'}`}
      >
        {empty ?? (
          <DeskTable
            label={wholeCompany ? 'Salariés' : title}
            className="min-w-0 flex-1"
            columns={wholeCompany ? COMPANY_COLUMNS : DEPARTMENT_COLUMNS}
            rows={people}
            rowKey={(e) => e.id}
            selectable={wholeCompany}
            shrink
            activeRow={activePerson}
            onRowClick={onSelect && ((e) => onSelect(e.id))}
            footer={
              <DeskTablePagination
                range={range}
                onPrevious={onPrevious}
                onNext={onNext}
              />
            }
          />
        )}
        {panel}
      </div>
    </CompanyShell>
  );
}

function PanelField({
  label,
  invalid,
  error,
  ...input
}: {
  label: string;
  invalid?: boolean;
  error?: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <p className="h-4 text-13 font-semibold">{label}</p>
      <DeskInput
        label={label}
        invalid={invalid || Boolean(error)}
        className="mt-1 block w-full"
        {...input}
      />
      {error && <p className="mt-1 text-12 text-red">{error}</p>}
    </div>
  );
}

function SelectBox({
  label,
  value,
  options,
  onChange,
  className = '',
}: {
  label: string;
  value: string;
  options: readonly { id: string; label: string }[];
  onChange?: (id: string) => void;
  className?: string;
}) {
  const shown = options.find((option) => option.id === value)?.label ?? '';
  return (
    <div
      className={`relative flex h-8 items-center justify-between rounded-[6px] pr-2.5 pb-[3px] pl-2.5 text-13 font-medium shadow-[0_0_0_0.5px_var(--color-ink-2),inset_0_0_0_0.5px_var(--color-ink-2)] ${className}`}
    >
      {shown}
      <Icon name="chevron" size={12} className="mt-[3px] rotate-90 text-muted" />
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export type PersonFormValue = {
  name: string;
  email: string;
  site: string;
  departmentId: string;
};

export type PersonFormErrors = Partial<Record<keyof PersonFormValue, string>>;

/** The address is already someone's: "Cette adresse est déjà à Finance". */
export type PersonFormConflict = {
  title: string;
  description?: string;
  action?: { label: string; icon?: IconName; onClick?: () => void };
};

export type PersonFormPanelProps = {
  title: string;
  value: PersonFormValue;
  onChange?: (value: PersonFormValue) => void;
  errors?: PersonFormErrors;
  conflict?: PersonFormConflict | null;
  /** The departments to choose from; left out where the department is implied. */
  departments?: readonly { id: string; label: string }[];
  submitLabel: string;
  saving?: boolean;
  message?: string;
  /** Under the fields of an existing record: "Demander le déplacement". */
  footerAction?: { label: string; onClick?: () => void };
  onSubmit?: () => void;
  onCancel?: () => void;
};

/** Adds or edits someone, beside the table. */
export function PersonFormPanel({
  title,
  value,
  onChange,
  errors = {},
  conflict,
  departments,
  submitLabel,
  saving = false,
  message,
  footerAction,
  onSubmit,
  onCancel,
}: PersonFormPanelProps) {
  const set =
    (key: keyof PersonFormValue) => (event: ChangeEvent<HTMLInputElement>) =>
      onChange?.({ ...value, [key]: event.target.value });
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!saving) onSubmit?.();
  };
  return (
    <DeskSidePanel className="min-h-[520px] w-[360px]">
      <form noValidate onSubmit={submit}>
        <h2 className="mt-3 ml-[15px] text-14 font-semibold">{title}</h2>
        <div className="mt-3.5 h-px bg-separator" />
        <div className="mt-[15px] flex flex-col gap-3 px-[15px]">
          <PanelField
            label="Prénom et nom"
            value={value.name}
            onChange={set('name')}
            error={errors.name}
            autoComplete="off"
          />
          <PanelField
            label="E-mail"
            type="email"
            value={value.email}
            onChange={set('email')}
            invalid={Boolean(conflict)}
            error={errors.email}
            autoComplete="off"
          />
          <PanelField
            label="Lieu"
            value={value.site}
            onChange={set('site')}
            autoComplete="off"
          />
          {departments && (
            <div>
              <p className="h-4 text-13 font-semibold">Département</p>
              <SelectBox
                label="Département"
                value={value.departmentId}
                options={departments}
                onChange={(departmentId) =>
                  onChange?.({ ...value, departmentId })
                }
                className="mt-1"
              />
            </div>
          )}
        </div>
        <div className="px-[15px]">
          {conflict && (
            <Banner
              tone="orange"
              icon="alert"
              iconSize={16}
              title={conflict.title}
              description={conflict.description}
              className="mt-6 h-[108px] items-start gap-2 rounded-[6px] py-0 pr-3 pl-3"
              classNames={{
                icon: 'mt-3',
                title: 'mt-[10px] text-13',
                description: 'mt-[5px] text-12 leading-[14px]',
              }}
            />
          )}
          {conflict?.action && (
            <Button
              variant="outline"
              size="desk"
              icon={conflict.action.icon}
              className="mt-4 w-full justify-start"
              onClick={conflict.action.onClick}
            >
              {conflict.action.label}
            </Button>
          )}
          {message && <p className="mt-3 text-12 text-red">{message}</p>}
          {footerAction && (
            <Button
              variant="outline"
              size="desk"
              className="mt-4 w-full"
              onClick={footerAction.onClick}
            >
              {footerAction.label}
            </Button>
          )}
          <div className={`flex gap-2 ${conflict ? 'mt-12' : 'mt-6 pb-4'}`}>
            <Button
              variant="outline"
              size="desk"
              className="w-[100px]"
              onClick={onCancel}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="desk"
              className="w-[220px]"
              disabled={saving}
            >
              {submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </DeskSidePanel>
  );
}

export type MoveEffectLine = { icon: IconName; text: string };

export type PersonRecordPanelProps = {
  name: string;
  email: string;
  initials: string;
  departments: readonly { id: string; label: string }[];
  /** Where the record says "Déplacer vers"; the current one until changed. */
  target: string;
  onTarget?: (id: string) => void;
  /** What the move changes; left out until a department is chosen. */
  effects?: readonly MoveEffectLine[];
  details: readonly { label: string; value: string }[];
  moving?: boolean;
  /** Why the move cannot be done now: offline, refused. */
  message?: string;
  canMove?: boolean;
  onMove?: () => void;
  onCancelMove?: () => void;
  onEdit?: () => void;
  /** A department's request on this record: closed without moving anyone. */
  onDismissRequest?: () => void;
  onClose?: () => void;
};

/** A record beside the table: where to move them, what that changes, what is known. */
export function PersonRecordPanel({
  name,
  email,
  initials,
  departments,
  target,
  onTarget,
  effects,
  details,
  moving = false,
  message,
  canMove = true,
  onMove,
  onCancelMove,
  onEdit,
  onDismissRequest,
  onClose,
}: PersonRecordPanelProps) {
  // The figures of the mockup: the block of effects takes 148 px, the actions 48.
  const lower = effects ? (message ? 379 : 355) : message ? 183 : 159;
  return (
    <DeskSidePanel
      className={`w-[360px] ${onDismissRequest ? 'h-[760px]' : 'h-[640px]'}`}
    >
      <Avatar
        initials={initials}
        tone="fill"
        className="absolute top-[15px] left-[15px] rounded-full bg-fill-2 pb-px text-14"
      />
      <p className="absolute top-[15px] left-[67px] w-[230px] truncate text-16 font-bold">
        {name}
      </p>
      <p className="absolute top-[37px] left-[67px] w-[275px] truncate text-12 text-muted">
        {email}
      </p>
      <button
        type="button"
        aria-label="Fermer"
        onClick={onClose}
        className="absolute top-[15px] right-[15px] cursor-pointer text-muted"
      >
        <Icon name="x" size={16} />
      </button>
      <div className="absolute inset-x-0 top-[71px] h-px bg-separator" />
      <div className="absolute inset-x-[15px] top-[87px]">
        <p className="relative -top-px h-4 text-13 font-semibold">Déplacer vers</p>
        <SelectBox
          label="Déplacer vers"
          value={target}
          options={departments}
          onChange={onTarget}
          className="mt-2"
        />
        {effects && (
          <div className="mt-4 h-[132px] rounded-[6px] bg-orange-soft px-3 pt-2.5 text-13 text-orange-strong">
            <p className="relative -top-px h-4 font-semibold">
              Ce qui change pour ses colis
            </p>
            <ul className="mt-2 flex flex-col gap-3.5">
              {effects.map(({ icon, text }) => (
                <li key={text} className="flex h-4 gap-2">
                  <Icon name={icon} size={16} className="mt-px shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        )}
        {message && <p className="mt-2 text-12 text-red">{message}</p>}
        {effects && (
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              size="desk"
              className="w-[100px]"
              onClick={onCancelMove}
            >
              Annuler
            </Button>
            <Button
              size="desk"
              className="w-[220px]"
              disabled={moving || !canMove}
              onClick={onMove}
            >
              Déplacer
            </Button>
          </div>
        )}
      </div>
      <div
        className="absolute inset-x-0 h-px bg-separator"
        style={{ top: lower }}
      />
      <div className="absolute inset-x-[15px]" style={{ top: lower + 15 }}>
        <DetailsList variant="desk" labelWidth={130} items={[...details]} />
        {onEdit && (
          <Button
            variant="outline"
            size="desk"
            className="mt-4 w-full"
            onClick={onEdit}
          >
            Modifier la fiche
          </Button>
        )}
        {onDismissRequest && (
          <Button
            variant="outline"
            size="desk"
            className="mt-2 w-full"
            onClick={onDismissRequest}
          >
            Classer la demande
          </Button>
        )}
      </div>
    </DeskSidePanel>
  );
}

/** What a department tells the admin about one of its people. */
export type MoveRequestFormProps = {
  name: string;
  /** "Demandé le 31 oct. 2026": the request already sent, still open. */
  sent?: string;
  note: string;
  onNote?: (note: string) => void;
  saving?: boolean;
  message?: string;
  onSubmit?: () => void;
  onWithdraw?: () => void;
  onCancel?: () => void;
};

const MOVE_REQUEST_HELP =
  'L’administrateur le verra dans son annuaire : lui seul déplace un salarié.';

/** Asks the admin to move someone, beside the table. */
export function MoveRequestPanel({
  name,
  sent,
  note,
  onNote,
  saving = false,
  message,
  onSubmit,
  onWithdraw,
  onCancel,
}: MoveRequestFormProps) {
  return (
    <DeskSidePanel className="min-h-[320px] w-[360px]">
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving) onSubmit?.();
        }}
      >
        <h2 className="mt-3 ml-[15px] text-14 font-semibold">
          Demander le déplacement
        </h2>
        <div className="mt-3.5 h-px bg-separator" />
        <div className="mt-[15px] flex flex-col gap-3 px-[15px] pb-4">
          <p className="text-13 font-semibold">{name}</p>
          <p className="text-12 text-muted">{sent ?? MOVE_REQUEST_HELP}</p>
          <PanelField
            label="Où va ce salarié ? (facultatif)"
            value={note}
            onChange={(event) => onNote?.(event.target.value)}
            autoComplete="off"
          />
          {message && <p className="text-12 text-red">{message}</p>}
          {sent && (
            <Button
              variant="outline"
              size="desk"
              className="w-full"
              disabled={saving}
              onClick={onWithdraw}
            >
              Retirer la demande
            </Button>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="desk"
              className="w-[100px]"
              onClick={onCancel}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              size="desk"
              className="w-[220px]"
              disabled={saving}
            >
              {sent ? 'Mettre à jour' : 'Envoyer la demande'}
            </Button>
          </div>
        </div>
      </form>
    </DeskSidePanel>
  );
}

export type ImportErrorRow = {
  line: string;
  name: string;
  email: string;
  emailBad?: boolean;
  department: string;
  departmentBad?: boolean;
  problem: string;
  tone: 'red' | 'orange';
};

const IMPORT_COLUMNS: DeskTableColumn<ImportErrorRow>[] = [
  {
    key: 'line',
    header: 'Ligne',
    width: 70,
    cell: (r) => <span className="mt-0.5 font-mono text-12">{r.line}</span>,
  },
  { key: 'name', header: 'Nom', width: 200, cell: (r) => r.name },
  {
    key: 'email',
    header: 'E-mail',
    width: 300,
    cell: (r) => (
      <span className={`mt-0.5 font-mono text-12 ${r.emailBad ? 'text-red' : ''}`}>
        {r.email}
      </span>
    ),
  },
  {
    key: 'department',
    header: 'Département',
    width: 180,
    cell: (r) => (
      <span className={r.departmentBad ? 'text-orange' : undefined}>
        {r.department}
      </span>
    ),
  },
  {
    key: 'problem',
    header: 'Problème',
    cell: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`mt-[2.5px] size-2 rounded-full ${r.tone === 'red' ? 'bg-red' : 'bg-orange'}`}
        />
        {r.problem}
      </span>
    ),
  },
];

export type ImportCsvDesktopProps = AnnuaireShell & {
  subtitle: string;
  /** Each column read: the file's name for it, ours, whether it was understood. */
  columns: readonly { source: string; target: string }[];
  figures: readonly { label: string; value: string; red?: boolean }[];
  errors: ImportErrorRow[];
  /** A department the file names and the company lacks: one at a time. */
  unknown?: {
    name: string;
    lines: number;
    departments: readonly { id: string; label: string }[];
    onChoose?: (departmentId: string) => void;
    onCreate?: () => void;
    creating?: boolean;
  };
  summary: string;
  submitLabel: string;
  canSubmit?: boolean;
  submitting?: boolean;
  message?: string;
  onChangeFile?: () => void;
  onCancel?: () => void;
  onSubmit?: () => void;
};

/** The CSV has been read: what will be imported and what must be fixed first. */
export function ImportCsvDesktop({
  company,
  nav,
  account,
  onNavigate,
  companyCrumb,
  subtitle,
  columns,
  figures,
  errors,
  unknown,
  summary,
  submitLabel,
  canSubmit = true,
  submitting = false,
  message,
  onChangeFile,
  onCancel,
  onSubmit,
}: ImportCsvDesktopProps) {
  return (
    <CompanyShell
      company={company}
      nav={nav}
      active="annuaire"
      account={account}
      onNavigate={onNavigate}
      breadcrumb={[companyCrumb, 'Annuaire', 'Importer un CSV']}
    >
      <DeskPageHeader
        title="Importer un CSV"
        subtitle={subtitle}
        actions={
          <Button
            variant="outline"
            size="desk"
            className="w-[140px]"
            onClick={onChangeFile}
          >
            Changer de fichier
          </Button>
        }
      />
      <h2 className="mt-4 h-[18px] text-15 font-semibold">Colonnes reconnues</h2>
      <div className="mt-2.5 flex gap-3">
        {columns.map(({ source, target }) => (
          <div
            key={source}
            className="relative h-14 w-[220px] rounded-desk border border-separator"
          >
            <p className="absolute top-2 left-[11px] truncate pr-3 font-mono text-12 text-muted">
              Colonne « {source} »
            </p>
            <Icon
              name="arrowRight"
              size={14}
              className="absolute top-[30px] left-[11px] text-muted"
            />
            <p className="absolute top-[27px] left-[31px] text-13 font-semibold">
              {target}
            </p>
            <Icon
              name="check"
              size={16}
              className="absolute top-[29px] right-[9px] text-green"
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex h-[76px] rounded-desk border border-separator">
        {figures.map((figure, i) => (
          <div key={figure.label} className="relative w-[288px] shrink-0">
            {i > 0 && (
              <div className="absolute top-[11px] -left-px h-[52px] w-px bg-separator" />
            )}
            <p className="absolute top-[11px] left-[15px] text-12 font-medium whitespace-nowrap text-muted">
              {figure.label}
            </p>
            <p
              className={`absolute top-[29px] left-[15px] text-22 font-bold ${figure.red ? 'text-red' : ''}`}
            >
              {figure.value}
            </p>
          </div>
        ))}
      </div>
      {errors.length > 0 && (
        <>
          <h2 className="mt-6 h-[18px] text-15 font-semibold">
            À corriger avant d’importer
          </h2>
          <DeskTable
            label="Lignes en erreur"
            className="mt-2.5 shrink-0"
            columns={IMPORT_COLUMNS}
            rows={errors}
            rowKey={(r) => r.line}
            footer={<span />}
          />
        </>
      )}
      {unknown && (
        <div className="relative mt-[15px] h-24 shrink-0 rounded-desk border border-separator">
          <Icon
            name="info"
            size={18}
            className="absolute top-[17px] left-[15px]"
          />
          <p className="absolute top-[14px] left-[43px] text-14 font-semibold">
            « {unknown.name} » n’existe pas encore ({unknown.lines}{' '}
            {unknown.lines > 1 ? 'lignes' : 'ligne'})
          </p>
          <p className="absolute top-[36px] left-[43px] text-13 text-muted">
            Créez-le, ou rangez ces salariés dans un département existant.
          </p>
          <div className="absolute top-[29px] right-[15px] flex gap-2">
            <span className="relative">
              <Button variant="outline" size="desk" className="relative w-[120px]">
                Ranger dans…
                <Icon
                  name="chevron"
                  size={12}
                  className="absolute top-2.5 right-2.5"
                />
              </Button>
              <select
                aria-label="Ranger dans"
                value=""
                onChange={(event) => unknown.onChoose?.(event.target.value)}
                className="absolute inset-0 w-full cursor-pointer opacity-0"
              >
                <option value="" disabled>
                  Ranger dans…
                </option>
                {unknown.departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.label}
                  </option>
                ))}
              </select>
            </span>
            <Button
              variant="outline"
              size="desk"
              icon="plus"
              className="w-[168px] justify-start truncate"
              disabled={unknown.creating}
              onClick={unknown.onCreate}
            >
              Créer « {unknown.name} »
            </Button>
          </div>
        </div>
      )}
      <p className="mt-5 text-12 text-muted">
        Les accents, majuscules et espaces sont corrigés à l’import. Les salariés
        absents du fichier ne sont pas supprimés.
      </p>
      {message && <p className="mt-2 text-12 text-red">{message}</p>}
      <div className="absolute inset-x-0 bottom-0 flex h-16 items-start justify-between border-t border-separator bg-surface pt-[15px] pr-8 pl-8">
        <p className="mt-[6px] text-13 font-semibold">{summary}</p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="desk"
            className="w-[84px]"
            onClick={onCancel}
          >
            Annuler
          </Button>
          <Button
            size="desk"
            className="w-[170px]"
            disabled={!canSubmit || submitting}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </CompanyShell>
  );
}

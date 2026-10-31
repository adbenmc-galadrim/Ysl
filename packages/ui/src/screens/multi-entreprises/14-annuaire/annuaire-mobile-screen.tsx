import { Banner } from '#components/banner';
import { Button } from '#components/button';
import type { ChangeEvent, ReactNode } from 'react';

import { EmptyState } from '#components/empty-state';
import { Field, FieldInput } from '#components/field';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { PersonAvatar, PhoneRow, PhoneSegments } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { Icon } from '#icons';
import { cn } from '#lib/tv';
import type {
  PersonFormErrors,
  PersonFormValue,
} from '#screens/multi-entreprises/14-annuaire/annuaire-desktop-screen';

function PhoneLetter({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <h2 className={cn('h-6 text-20 font-bold', className)}>{children}</h2>;
}

function AddButton({ onClick }: { onClick?: () => void }) {
  return (
    <IconButton
      icon="plus"
      label="Ajouter"
      size="lg"
      iconSize={22}
      onClick={onClick}
    />
  );
}

export type AnnuaireMobileEntry = {
  id: string;
  name: string;
  initials: string;
  /** Under the name: the department of a company's list, the place of a department's. */
  detail?: string;
};

export type AnnuaireMobileProps = {
  title: string;
  searchPlaceholder: string;
  groups: readonly { letter: string; people: AnnuaireMobileEntry[] }[];
  /** The company's list filters by department; a department's has no filter. */
  filter?: {
    options: readonly string[];
    value: string;
    onChange?: (option: string) => void;
  };
  query?: string;
  onQueryChange?: (query: string) => void;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
  onBack?: () => void;
  /** Under the list: those kept outside the directory. */
  footer?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};

/** The directory on the phone, sorted by first letter. */
export function AnnuaireMobile({
  title,
  searchPlaceholder,
  groups,
  filter,
  query = '',
  onQueryChange,
  onSelect,
  onAdd,
  onBack,
  footer,
  emptyTitle,
  emptyDescription,
}: AnnuaireMobileProps) {
  return (
    <Screen>
      <NavBar
        title={title}
        onBack={onBack}
        trailing={<AddButton onClick={onAdd} />}
      />
      <SearchField
        placeholder={searchPlaceholder}
        className="mt-4"
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        onClear={() => onQueryChange?.('')}
      />
      {filter && (
        <PhoneSegments
          label="Département"
          options={filter.options}
          value={filter.value}
          onChange={filter.onChange}
          className="mt-3 h-9 shrink-0 overflow-x-auto rounded-[18px]"
          optionClassName="h-8 min-w-[72px] rounded-2xl whitespace-nowrap px-2 pb-[3px] text-13"
        />
      )}
      {groups.length === 0 && emptyTitle && (
        <EmptyState
          icon="users"
          title={emptyTitle}
          description={emptyDescription}
          className="mt-12"
        />
      )}
      {groups.map(({ letter, people }, g) => (
        <section key={letter}>
          <PhoneLetter className={g ? 'mt-3.5' : filter ? 'mt-5' : 'mt-4'}>
            {letter}
          </PhoneLetter>
          <div className="mt-1.5">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={onSelect && (() => onSelect(person.id))}
                className="block w-full cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
              >
                <PhoneRow
                  leading={<PersonAvatar initials={person.initials} raised />}
                  title={person.name}
                  lines={person.detail ? [person.detail] : []}
                  separator
                />
              </button>
            ))}
          </div>
        </section>
      ))}
      {footer}
    </Screen>
  );
}

function CloseLeading({ onClick }: { onClick?: () => void }) {
  return (
    <IconButton
      icon="x"
      label="Fermer"
      size="lg"
      iconSize={22}
      className="-ml-0.5"
      onClick={onClick}
    />
  );
}

/** A controlled field of the phone form, drawn as `PhoneField`. */
function FormField({
  label,
  value,
  onChange,
  error,
  warned = false,
  type = 'text',
  className,
}: {
  label: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  warned?: boolean;
  type?: 'text' | 'email';
  className?: string;
}) {
  return (
    <Field
      label={<span className="relative -top-px">{label}</span>}
      help={error}
      helpTone="red"
      className={className}
    >
      {(id) => (
        <FieldInput
          id={id}
          type={type}
          value={value}
          onChange={onChange ?? (() => {})}
          autoComplete="off"
          className={cn(
            'relative h-12 gap-0 rounded-[12px] bg-surface pr-3.5 pl-3.5 font-normal',
            warned &&
              'shadow-[0_0_0_0.75px_var(--color-orange),inset_0_0_0_0.75px_var(--color-orange)]',
          )}
        />
      )}
    </Field>
  );
}

export type PersonFormMobileProps = {
  title: string;
  submitLabel: string;
  value: PersonFormValue;
  onChange?: (value: PersonFormValue) => void;
  errors?: PersonFormErrors;
  departments?: readonly { id: string; label: string }[];
  /** Under the fields: "Ajouté au Studio. Ses colis y seront déposés." */
  note?: string;
  /** The address is already someone's: the form cannot be sent. */
  conflict?: {
    title: string;
    description: string;
    action?: string;
    onAction?: () => void;
  } | null;
  /** Under the fields of an existing record: "Déplacer vers un autre département". */
  footerAction?: { label: string; onClick?: () => void };
  saving?: boolean;
  message?: string;
  onSubmit?: () => void;
  onClose?: () => void;
};

/** Adds or edits someone on the phone. */
export function PersonFormMobile({
  title,
  submitLabel,
  value,
  onChange,
  errors = {},
  departments,
  note,
  conflict,
  footerAction,
  saving = false,
  message,
  onSubmit,
  onClose,
}: PersonFormMobileProps) {
  const set =
    (key: keyof PersonFormValue) => (event: ChangeEvent<HTMLInputElement>) =>
      onChange?.({ ...value, [key]: event.target.value });
  const refused = saving || Boolean(conflict);
  return (
    <Screen tone="fill">
      <NavBar
        title={title}
        leading={<CloseLeading onClick={onClose} />}
        trailing={
          <NavBarAction
            disabled={refused}
            onClick={onSubmit}
            className={cn('mr-px', refused && 'text-faint')}
          >
            {submitLabel}
          </NavBarAction>
        }
      />
      <div className="mt-4 flex flex-col gap-4">
        <FormField
          label="Prénom et nom"
          value={value.name}
          onChange={set('name')}
          error={errors.name}
        />
        <FormField
          label="E-mail"
          type="email"
          value={value.email}
          onChange={set('email')}
          error={errors.email}
          warned={Boolean(conflict)}
        />
        {!conflict && (
          <FormField
            label="Lieu (facultatif)"
            value={value.site}
            onChange={set('site')}
          />
        )}
        {!conflict && departments && (
          <Field label={<span className="relative -top-px">Département</span>}>
            {(id) => (
              <select
                id={id}
                value={value.departmentId}
                onChange={(event) =>
                  onChange?.({ ...value, departmentId: event.target.value })
                }
                className="h-12 w-full appearance-none rounded-[12px] bg-surface pr-3.5 pl-3.5 text-16"
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
        )}
      </div>
      {note && !conflict && (
        <p className="mt-[26px] pl-4 text-13 text-muted">{note}</p>
      )}
      {message && <p className="mt-3 pl-4 text-13 text-red">{message}</p>}
      {footerAction && !conflict && (
        <Button
          variant="outline"
          block
          className="mt-6"
          onClick={footerAction.onClick}
        >
          {footerAction.label}
        </Button>
      )}
      {conflict && (
        <Banner
          tone="orange"
          icon="alert"
          title={conflict.title}
          description={
            <>
              {conflict.description}
              {conflict.action && (
                <button
                  type="button"
                  onClick={conflict.onAction}
                  className="mt-[10px] block cursor-pointer text-15 font-semibold"
                >
                  {conflict.action}
                </button>
              )}
            </>
          }
          className="mt-7 h-[109px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
          classNames={{
            icon: 'mt-4',
            title: 'mt-[15px] text-15',
            description: 'mt-0.5 text-13 leading-[15.6px]',
          }}
        />
      )}
    </Screen>
  );
}

function MoveOption({
  label,
  note,
  chosen = false,
  separator = false,
  onClick,
}: {
  label: string;
  note?: string;
  chosen?: boolean;
  separator?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onClick}
      className="relative block h-[52px] w-full cursor-pointer pt-[17px] pl-4 text-left text-16 outline-none focus-visible:ring-2 focus-visible:ring-blue"
    >
      <span className={cn(chosen && 'font-semibold')}>{label}</span>
      {note && <span className="absolute right-[15px] text-muted">{note}</span>}
      {chosen && (
        <Icon name="tick" size={16} className="absolute top-[18px] right-3" />
      )}
      {separator && (
        <span className="absolute inset-x-0 bottom-0 ml-4 h-px bg-separator" />
      )}
    </button>
  );
}

export type MoveSheetMobileProps = {
  /** The record behind the sheet. */
  name: string;
  departments: readonly { id: string; label: string }[];
  currentId: string | null;
  targetId: string | null;
  onTarget?: (id: string) => void;
  effect?: { title: string; description: string } | null;
  submitLabel: string;
  canSubmit?: boolean;
  message?: string;
  onSubmit?: () => void;
  onDismiss?: () => void;
  /** Over the app's screen; a story draws it in place, on the mockup's frame. */
  fixed?: boolean;
  behind?: ReactNode;
};

/** The administrator moves an employee, and reads what that changes first. */
export function MoveSheetMobile({
  name,
  departments,
  currentId,
  targetId,
  onTarget,
  effect,
  submitLabel,
  canSubmit = true,
  message,
  onSubmit,
  onDismiss,
  fixed = false,
  behind,
}: MoveSheetMobileProps) {
  return (
    <div
      className={cn(
        fixed
          ? 'fixed inset-0 z-[60]'
          : 'relative h-full min-h-dvh w-full overflow-hidden',
      )}
    >
      {behind ?? (
        <Screen tone="fill">
          <NavBar title={name} />
        </Screen>
      )}
      <div className="absolute inset-0 z-[60] bg-black/32" onClick={onDismiss}>
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Déplacer vers"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            'absolute inset-x-0 rounded-t-[24px] bg-surface px-5 pt-2 text-ink',
            fixed
              ? 'bottom-0 max-h-[90dvh] overflow-y-auto pb-[calc(var(--safe-bottom)+16px)]'
              : 'top-[250px] h-[632px]',
          )}
        >
          <span
            aria-hidden="true"
            className="mx-auto block h-[5px] w-9 rounded-[3px] bg-faint"
          />
          <h2 className="mt-[17px] text-22 font-bold">Déplacer vers</h2>
          <div role="radiogroup" className="mt-3.5 rounded-[14px] bg-fill">
            {departments.map((department, i) => (
              <MoveOption
                key={department.id}
                label={department.label}
                note={
                  department.id === currentId && department.id !== targetId
                    ? 'Actuel'
                    : undefined
                }
                chosen={department.id === targetId}
                separator={i < departments.length - 1}
                onClick={() => onTarget?.(department.id)}
              />
            ))}
          </div>
          {effect && (
            <Banner
              tone="orange"
              icon="alert"
              title={effect.title}
              description={effect.description}
              className="mt-3.5 h-[83px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
              classNames={{
                icon: 'mt-4',
                title: 'mt-[15px] text-15',
                description: 'mt-0.5 text-13 leading-[15.6px]',
              }}
            />
          )}
          {message && <p className="mt-3 text-13 text-red">{message}</p>}
          <Button
            block
            className="mt-[37px]"
            disabled={!canSubmit}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </section>
        {!fixed && (
          <span
            aria-hidden="true"
            className="absolute top-[843px] left-[130px] h-[5px] w-[134px] rounded-[3px] bg-black"
          />
        )}
      </div>
    </div>
  );
}

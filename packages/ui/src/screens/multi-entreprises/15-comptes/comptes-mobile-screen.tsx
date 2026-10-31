import type { ChangeEvent, ReactNode } from 'react';

import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import {
  PersonAvatar,
  PhoneRow,
  PhoneSection,
  PhoneSegments,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';
import type { ComptesSelect } from '#screens/multi-entreprises/15-comptes/comptes-desktop-screen';

const STATE_STYLE = {
  'Invitation envoyée': { tone: 'blue', width: 140 },
  Suspendu: { tone: 'orange', width: 93 },
  Révoqué: { tone: 'red', width: 88 },
} as const;

export type CompteMobileState = keyof typeof STATE_STYLE;

function RowState({ label }: { label: CompteMobileState }) {
  const { tone, width } = STATE_STYLE[label];
  return (
    <span
      className={cn(
        'flex h-6 items-center gap-1.5 rounded-[12px] pl-[9px] text-13 font-semibold',
        tone === 'blue' && 'bg-fill',
        tone === 'orange' && 'bg-orange-soft text-orange-strong',
        tone === 'red' && 'bg-red-soft text-red',
      )}
      style={{ width }}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          tone === 'blue' && 'bg-blue',
          tone === 'orange' && 'bg-orange',
          tone === 'red' && 'bg-red',
        )}
      />
      <span className="-mt-0.5">{label}</span>
    </span>
  );
}

export type CompteMobileRow = {
  id: string;
  initials: string;
  name: string;
  line: string;
  state?: CompteMobileState;
};

export type ComptesMobileProps = {
  title: string;
  sections: readonly {
    title: string;
    count: number;
    rows: readonly CompteMobileRow[];
  }[];
  query?: string;
  onQueryChange?: (value: string) => void;
  onSelect?: (id: string) => void;
  onAdd?: () => void;
  onBack?: () => void;
  /** Under the rows: the next page, or an empty or failed list. */
  footer?: ReactNode;
};

/** Who can sign in to the company, by role, on the phone. */
export function ComptesMobile({
  title,
  sections,
  query = '',
  onQueryChange,
  onSelect,
  onAdd,
  onBack,
  footer,
}: ComptesMobileProps) {
  return (
    <Screen>
      <NavBar
        title={title}
        onBack={onBack}
        trailing={
          <IconButton
            icon="userPlus"
            label="Ajouter"
            size="lg"
            iconSize={22}
            onClick={onAdd}
          />
        }
      />
      <SearchField
        placeholder="Nom ou e-mail"
        className="mt-4"
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        onClear={() => onQueryChange?.('')}
      />
      {sections.map((section, index) => (
        <div key={section.title}>
          <PhoneSection
            title={section.title}
            count={section.count}
            className={index === 0 ? 'mt-5' : 'mt-2.5'}
          />
          <div className="mt-2.5">
            {section.rows.map((row) => (
              <button
                key={row.id}
                type="button"
                className="block w-full cursor-pointer text-left"
                onClick={() => onSelect?.(row.id)}
              >
                <PhoneRow
                  leading={<PersonAvatar initials={row.initials} raised />}
                  title={row.name}
                  lines={[row.line]}
                  before={row.state && <RowState label={row.state} />}
                  separator
                />
              </button>
            ))}
          </div>
        </div>
      ))}
      {footer}
    </Screen>
  );
}

function AccountRow({
  icon,
  tileClass,
  label,
  value,
  select,
  selectName,
  separator = false,
  textTop = 17,
}: {
  icon: IconName;
  tileClass: string;
  label: string;
  value: string;
  select?: ComptesSelect;
  selectName?: string;
  separator?: boolean;
  textTop?: number;
}) {
  return (
    <div className="relative h-[52px] text-16">
      <span
        className={cn(
          'absolute top-3 left-3.5 flex size-7 items-center justify-center rounded-[7px] text-white',
          tileClass,
        )}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="absolute left-14" style={{ top: textTop }}>
        {label}
      </span>
      <span
        className={cn(
          'absolute max-w-[180px] truncate text-muted',
          select ? 'right-9' : 'right-[15px]',
        )}
        style={{ top: textTop }}
      >
        {select ? select.label : value}
      </span>
      {select && (
        <>
          <Icon
            name="chevron"
            size={16}
            className="absolute top-[18px] right-3.5 text-faint"
          />
          <select
            aria-label={selectName ?? label}
            value={select.value}
            disabled={select.disabled}
            onChange={(event) => select.onChange?.(event.target.value)}
            className="absolute inset-0 size-full cursor-pointer opacity-0"
          >
            {select.options.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      )}
      {separator && (
        <div className="absolute right-0 bottom-0 left-14 h-px bg-separator" />
      )}
    </div>
  );
}

export type CompteRecordMobileProps = {
  initials: string;
  name: string;
  email: string;
  role: { value: string; select?: ComptesSelect };
  department?: { value: string; select?: ComptesSelect };
  state?: string;
  lastLogin: string;
  devices?: string;
  message?: string;
  actions: readonly { label: string; danger?: boolean; onClick?: () => void }[];
  onBack?: () => void;
};

/** The record of one account: its role, where it sits, what can be done to it. */
export function CompteRecordMobile({
  initials,
  name,
  email,
  role,
  department,
  state,
  lastLogin,
  devices,
  message,
  actions,
  onBack,
}: CompteRecordMobileProps) {
  return (
    <Screen tone="fill">
      <NavBar onBack={onBack} />
      <div className="relative mt-3 h-14">
        <span className="absolute top-0 left-0 flex size-14 items-center justify-center rounded-full bg-surface text-20 font-semibold">
          {initials}
        </span>
        <p className="absolute -top-px right-0 left-[68px] truncate text-24 font-bold">
          {name}
        </p>
        <p className="absolute top-[31px] right-0 left-[68px] truncate text-14 text-muted">
          {email}
        </p>
      </div>
      <div className="mt-7 rounded-[14px] bg-surface">
        <AccountRow
          icon="building"
          tileClass="bg-muted"
          label="Rôle"
          value={role.value}
          select={role.select}
          separator
        />
        {department && (
          <AccountRow
            icon="pin"
            tileClass="bg-ios-red-light"
            label="Rattachement"
            value={department.value}
            select={department.select}
            separator
          />
        )}
        {state && (
          <AccountRow
            icon="pause"
            tileClass="bg-muted"
            label="État"
            value={state}
            separator
          />
        )}
        {devices && (
          <AccountRow
            icon="phone"
            tileClass="bg-muted"
            label="Appareils"
            value={devices}
            separator
          />
        )}
        <AccountRow
          icon="clock"
          tileClass="bg-muted"
          label="Dernière connexion"
          value={lastLogin}
          textTop={16}
        />
      </div>
      {message && (
        <p role="alert" className="mt-3 px-4 text-13 text-red">
          {message}
        </p>
      )}
      <div className="mt-7 rounded-[14px] bg-surface text-16">
        {actions.map((action, index) => (
          <button
            key={action.label}
            type="button"
            onClick={action.onClick}
            className={cn(
              'relative block h-[52px] w-full cursor-pointer pl-4 text-left',
              index === 0 ? 'pb-px' : 'pb-0',
              action.danger && 'text-red',
            )}
          >
            {action.label}
            {index < actions.length - 1 && (
              <span className="absolute right-0 bottom-0 left-4 h-px bg-separator" />
            )}
          </button>
        ))}
      </div>
    </Screen>
  );
}

export type CompteFormMobileProps = {
  title: string;
  roles: readonly string[];
  role: string;
  onRole?: (role: string) => void;
  department?: ComptesSelect;
  name: string;
  email: string;
  password?: string;
  passwordLabel?: string;
  onField?: (key: 'name' | 'email' | 'password', value: string) => void;
  hint: string;
  taken?: boolean;
  submitLabel: string;
  submitIcon: IconName;
  saving?: boolean;
  onSubmit?: () => void;
  onClose?: () => void;
};

const FIELD_BOX =
  'h-12 w-full rounded-[12px] bg-surface pr-3.5 pl-3.5 pb-[3px] text-16';

function FormInput({
  label,
  type = 'text',
  value,
  onChange,
  invalid = false,
  autoComplete,
}: {
  label: string;
  type?: string;
  value: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
  invalid?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="relative -top-px block pl-1 text-13 font-medium text-muted">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={invalid}
        autoComplete={autoComplete}
        className={cn(
          'mt-1.5',
          FIELD_BOX,
          invalid && 'shadow-[inset_0_0_0_1.5px_var(--color-red)]',
        )}
      />
    </label>
  );
}

/** Creating an account on the phone. */
export function CompteFormMobile({
  title,
  roles,
  role,
  onRole,
  department,
  name,
  email,
  password,
  passwordLabel,
  onField,
  hint,
  taken = false,
  submitLabel,
  submitIcon,
  saving = false,
  onSubmit,
  onClose,
}: CompteFormMobileProps) {
  const set =
    (key: 'name' | 'email' | 'password') =>
    (event: ChangeEvent<HTMLInputElement>) =>
      onField?.(key, event.target.value);
  return (
    <Screen
      tone="fill"
      bottom={
        <div className="h-[112px] border-t border-separator bg-surface px-5 pt-[23px]">
          <Button
            block
            icon={submitIcon}
            iconSize={20}
            className="gap-2"
            disabled={saving}
            onClick={onSubmit}
          >
            {submitLabel}
          </Button>
        </div>
      }
    >
      <NavBar
        title={title}
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            className="-ml-0.5"
            onClick={onClose}
          />
        }
      />
      <p className="relative -top-px mt-4 h-4 pl-4 text-13 font-medium text-muted">
        Rôle
      </p>
      <PhoneSegments
        label="Rôle"
        options={[...roles]}
        value={role}
        onChange={onRole}
        className="mt-2 h-11 rounded-[22px]"
        optionClassName="h-10 rounded-[20px] pb-[3px] text-14"
      />
      <div className="mt-5 flex flex-col gap-4">
        {department && (
          <label className="relative block">
            <span className="relative -top-px block pl-1 text-13 font-medium text-muted">
              Département
            </span>
            <select
              value={department.value}
              onChange={(event) => department.onChange?.(event.target.value)}
              className={cn('mt-1.5 appearance-none', FIELD_BOX)}
            >
              {department.options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon
              name="chevron"
              size={16}
              className="absolute right-3.5 bottom-4 rotate-90 text-faint"
            />
          </label>
        )}
        <FormInput label="Prénom et nom" value={name} onChange={set('name')} />
        <FormInput
          label="E-mail professionnel"
          type="email"
          value={email}
          onChange={set('email')}
          invalid={taken}
        />
      </div>
      <p className={cn('relative -top-px mt-1.5 text-13', taken ? 'text-red' : 'text-muted')}>
        {hint}
      </p>
      {passwordLabel && (
        <div className="mt-4">
          <FormInput
            label={passwordLabel}
            type="password"
            autoComplete="new-password"
            value={password ?? ''}
            onChange={set('password')}
          />
        </div>
      )}
    </Screen>
  );
}

/** What a suspended account sees on its device, whose data stays where it is. */
export function CompteSuspenduScreen({
  title,
  lines,
  retryLabel,
  onRetry,
}: {
  title: string;
  lines: readonly string[];
  retryLabel: string;
  onRetry?: () => void;
}) {
  return (
    <Screen>
      <div className="mt-[176px] flex flex-col items-center text-center">
        <span className="flex size-[88px] items-center justify-center rounded-full bg-orange-soft text-orange-strong">
          <Icon name="pause" size={44} />
        </span>
        <h1 className="mt-5 text-22 font-bold">{title}</h1>
        {lines.map((line) => (
          <p key={line} className="mt-2 text-15 leading-5 text-muted">
            {line}
          </p>
        ))}
        <Button block className="mt-8" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    </Screen>
  );
}

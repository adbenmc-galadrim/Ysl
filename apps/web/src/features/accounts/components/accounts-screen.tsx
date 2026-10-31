import type {
  AccountRecord,
  AccountState,
  ListAccountsInput,
} from '@repo/contract/accounts';
import {
  ACCOUNTS_PAGE_SIZE,
  createAccountInput,
} from '@repo/contract/accounts';
import { MIN_PASSWORD_LENGTH } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Button,
  CompteFormMobile,
  CompteFormPanel,
  type CompteFormValue,
  CompteInlineSelect,
  CompteRecordMobile,
  CompteRecordPanel,
  ComptesDesktop,
  ComptesErreurDesktop,
  ComptesMobile,
  type ComptesSelect,
  FieldInput,
  Sheet,
} from '@repo/ui';
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useDeferredValue, useState } from 'react';
import {
  devicesLine,
  hasNextPage,
  lastSignIn,
  pageRange,
  stateLabel,
  tableRow,
} from '#/features/accounts/describe';
import { initialsOf } from '#/features/settings/initials';
import { useDeskShell } from '#/features/shell/components/use-desk-shell';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const ACCOUNTS_KEY = ['accounts'] as const;
const ALL = 'all';

type Tab = typeof ALL | 'shuttle' | 'department' | 'company_admin';
type Open = { kind: 'create' } | { kind: 'record'; id: string } | null;
type Dialog =
  | { kind: 'suspend' | 'revoke' | 'resume' | 'reinstate' | 'password' }
  | { kind: 'role'; role: 'shuttle' | 'department' }
  | null;

const EMPTY_FORM: CompteFormValue = {
  role: 'shuttle',
  departmentId: '',
  name: '',
  email: '',
  password: '',
};

const errorCode = (error: unknown) =>
  (error as { data?: { code?: string } } | null)?.data?.code;

/** What the server said, in its words: last admin, address taken, department gone. */
function errorMessage(error: unknown): string {
  if (!error) return '';
  const code = errorCode(error);
  const { message } = error as Error;
  // A refused schema answers with zod's JSON, which is no sentence for a screen.
  const worded =
    (code === 'BAD_REQUEST' || code === 'CONFLICT' || code === 'NOT_FOUND') &&
    !message.startsWith('[');
  return worded ? message : t('accounts.failed');
}

function roleName(role: AccountRecord['role']): string {
  return role ? t(`auth.role.${role}`) : t('auth.role.unknown');
}

function departmentSelect(
  departments: readonly { id: string; name: string }[],
  value: string,
  onChange: (id: string) => void,
  emptyLabel: string,
): ComptesSelect {
  const options = [
    { id: '', label: emptyLabel },
    ...departments.map((row) => ({ id: row.id, label: row.name })),
  ];
  return {
    value,
    label: options.find((option) => option.id === value)?.label ?? emptyLabel,
    options,
    onChange,
  };
}

function useAccountMutations(
  onDone: () => void,
) {
  const queryClient = useQueryClient();
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
  return useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: async () => {
      onDone();
      await refresh();
    },
    onError: refresh,
  });
}

/** What each gesture does to the phone is said before it is confirmed. */
function AccountDialog({
  dialog,
  account,
  departments,
  onClose,
}: {
  dialog: NonNullable<Dialog>;
  account: AccountRecord;
  departments: readonly { id: string; name: string }[];
  onClose: () => void;
}) {
  const [password, setPassword] = useState('');
  const [closeSessions, setCloseSessions] = useState(false);
  const [departmentId, setDepartmentId] = useState(
    account.departmentId ?? departments[0]?.id ?? '',
  );
  const mutation = useAccountMutations(onClose);
  const { kind } = dialog;
  const userId = account.id;
  const name = account.name;
  const asksPassword = kind === 'password' || kind === 'reinstate';
  const asksDepartment = kind === 'role' && dialog.role === 'department';
  const tooShort = asksPassword && password.length < MIN_PASSWORD_LENGTH;
  const noDepartment = asksDepartment && !departmentId;

  const confirm = () => {
    mutation.mutate(() => {
      switch (kind) {
        case 'suspend':
          return trpcClient.accounts.suspend.mutate({ userId });
        case 'revoke':
          return trpcClient.accounts.revoke.mutate({ userId });
        case 'resume':
          return trpcClient.accounts.reinstate.mutate({ userId });
        case 'reinstate':
          return trpcClient.accounts.reinstate.mutate({ userId, password });
        case 'password':
          return trpcClient.accounts.resetPassword.mutate({
            userId,
            password,
            closeSessions,
          });
        case 'role':
          return trpcClient.accounts.setRole.mutate({
            userId,
            role: dialog.role,
            departmentId: dialog.role === 'department' ? departmentId : null,
          });
      }
    });
  };

  const text = {
    suspend: {
      title: t('accounts.suspend.title', { name }),
      description: t('accounts.suspend.description'),
      confirm: t('accounts.suspend.confirm'),
    },
    revoke: {
      title: t('accounts.revoke.title', { name }),
      description: t('accounts.revoke.description'),
      confirm: t('accounts.revoke.confirm'),
    },
    resume: {
      title: t('accounts.resume.title', { name }),
      description: t('accounts.resume.description'),
      confirm: t('accounts.resume.confirm'),
    },
    reinstate: {
      title: t('accounts.reinstate.title', { name }),
      description: t('accounts.reinstate.description'),
      confirm: t('accounts.reinstate.confirm'),
    },
    password: {
      title: t('accounts.password.title', { name }),
      description: t('accounts.password.description'),
      confirm: t('accounts.password.confirm'),
    },
    role: {
      title: t('accounts.role.title', { name }),
      description: t('accounts.role.description'),
      confirm: t('accounts.role.confirm'),
    },
  }[kind];
  const destructive =
    kind === 'suspend' ||
    kind === 'revoke' ||
    (kind === 'password' && closeSessions);

  return (
    <Sheet
      fixed
      title={text.title}
      description={
        mutation.isError ? errorMessage(mutation.error) : text.description
      }
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onClose}
    >
      {asksDepartment && (
        <select
          aria-label={t('accounts.department')}
          value={departmentId}
          onChange={(event) => setDepartmentId(event.target.value)}
          className="mt-4 h-12 w-full rounded-[12px] bg-fill px-3.5 text-16"
        >
          {departments.map((row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      )}
      {asksPassword && (
        <FieldInput
          id="account-password"
          type="password"
          autoComplete="new-password"
          aria-label={t('accounts.password.field')}
          placeholder={t('accounts.password.field')}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-4"
        />
      )}
      {kind === 'password' && (
        <label className="mt-4 flex items-start gap-3 text-14">
          <input
            type="checkbox"
            className="mt-1"
            checked={closeSessions}
            onChange={(event) => setCloseSessions(event.target.checked)}
          />
          <span>{t('accounts.password.closeSessions')}</span>
        </label>
      )}
      <Button
        variant={destructive ? 'destructive' : 'primary'}
        block
        disabled={mutation.isPending || tooShort || noDepartment}
        className="mt-6"
        onClick={confirm}
      >
        {text.confirm}
      </Button>
      <Button variant="secondary" block className="mt-3" onClick={onClose}>
        {t('accounts.cancel')}
      </Button>
    </Sheet>
  );
}

function roleSelect(
  account: AccountRecord,
  onDialog: (dialog: Dialog) => void,
): ComptesSelect | undefined {
  if (account.role !== 'shuttle' && account.role !== 'department') {
    return undefined;
  }
  return {
    value: account.role,
    label: roleName(account.role),
    options: [
      { id: 'shuttle', label: roleName('shuttle') },
      { id: 'department', label: roleName('department') },
    ],
    onChange: (id) => {
      if (id === 'shuttle' || id === 'department') {
        if (id !== account.role) onDialog({ kind: 'role', role: id });
      }
    },
  };
}

/** Suspending and bringing back, which the mockups draw at the foot of the record. */
function stateActions(state: AccountState, onDialog: (dialog: Dialog) => void) {
  switch (state) {
    case 'active':
      return {
        state: {
          label: t('accounts.suspend.action'),
          danger: true,
          icon: 'pause' as const,
          onClick: () => onDialog({ kind: 'suspend' }),
        },
        revoke: {
          label: t('accounts.revoke.action'),
          onClick: () => onDialog({ kind: 'revoke' }),
        },
      };
    case 'suspended':
      return {
        state: {
          label: t('accounts.resume.action'),
          danger: false,
          icon: 'check' as const,
          onClick: () => onDialog({ kind: 'resume' }),
        },
        revoke: {
          label: t('accounts.revoke.action'),
          onClick: () => onDialog({ kind: 'revoke' }),
        },
      };
    case 'revoked':
      return {
        state: {
          label: t('accounts.reinstate.action'),
          danger: false,
          icon: 'check' as const,
          onClick: () => onDialog({ kind: 'reinstate' }),
        },
        revoke: undefined,
      };
  }
}

/**
 * Comptes (admin entreprise): who can sign in to the company, created without
 * e-mail until the invitation exists (YSL-122). A suspension keeps the phone's
 * data; a revocation erases it, and the confirmation says so.
 */
export function AccountsScreen() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const shell = useDeskShell();
  const [tab, setTab] = useState<Tab>(ALL);
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [stateFilter, setStateFilter] = useState<AccountState | ''>('');
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const search = useDeferredValue(query.trim());
  const [open, setOpen] = useState<Open>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [form, setForm] = useState<CompteFormValue>(EMPTY_FORM);

  const toFirstPage = <T,>(set: (value: T) => void) => (value: T) => {
    setPage(1);
    set(value);
  };

  const input: ListAccountsInput = {
    page,
    pageSize: ACCOUNTS_PAGE_SIZE,
    ...(tab === ALL ? {} : { role: tab }),
    ...(departmentFilter ? { departmentId: departmentFilter } : {}),
    ...(stateFilter ? { state: stateFilter } : {}),
    ...(search ? { search } : {}),
  };
  const list = useQuery({
    queryKey: [...ACCOUNTS_KEY, 'list', input],
    queryFn: () => trpcClient.accounts.list.query(input),
    placeholderData: keepPreviousData,
  });
  const departments = useQuery({
    queryKey: ['departments', 'list'],
    queryFn: () => trpcClient.departments.list.query(),
  });
  const recordId = open?.kind === 'record' ? open.id : null;
  const record = useQuery({
    queryKey: [...ACCOUNTS_KEY, 'record', recordId],
    queryFn: () =>
      trpcClient.accounts.get.query({ userId: recordId ?? '' }),
    enabled: recordId !== null,
  });
  const attach = useAccountMutations(() => {});
  const create = useMutation({
    mutationFn: () =>
      trpcClient.accounts.create.mutate({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role as 'shuttle' | 'department' | 'company_admin',
        departmentId: form.role === 'department' ? form.departmentId : null,
      }),
    onSuccess: async (created) => {
      setForm(EMPTY_FORM);
      setOpen({ kind: 'record', id: created.id });
      await queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });

  const allDepartments = departments.data ?? [];
  const rows = list.data?.rows ?? [];
  const counts = list.data?.counts;
  const total = list.data?.total ?? 0;
  const account = record.data;
  const previous = page > 1 ? () => setPage(page - 1) : undefined;
  const next =
    list.data && hasNextPage(page, ACCOUNTS_PAGE_SIZE, list.data)
      ? () => setPage(page + 1)
      : undefined;

  const attachTo = (target: AccountRecord) =>
    departmentSelect(
      allDepartments,
      target.departmentId ?? '',
      (id) => {
        if (!id || id === target.departmentId) return;
        attach.mutate(() =>
          trpcClient.departments.attachAccount.mutate({
            userId: target.id,
            departmentId: id,
          }),
        );
      },
      t('accounts.noDepartment'),
    );

  const formDepartment = (() => {
    const select = departmentSelect(
      allDepartments,
      form.departmentId,
      (id) => setForm((value) => ({ ...value, departmentId: id })),
      form.role === 'department'
        ? t('accounts.chooseDepartment')
        : t('accounts.noDepartment'),
    );
    return form.role === 'department' ? select : { ...select, disabled: true };
  })();
  const taken = errorCode(create.error) === 'CONFLICT';
  const canCreate = createAccountInput.safeParse({
    ...form,
    departmentId: form.role === 'department' ? form.departmentId || null : null,
  }).success;
  const formHint = create.isError
    ? errorMessage(create.error)
    : t('accounts.create.hint', { min: MIN_PASSWORD_LENGTH });

  const sheet = account && dialog && (
    <AccountDialog
      key={`${account.id}-${dialog.kind}`}
      dialog={dialog}
      account={account}
      departments={allDepartments}
      onClose={() => setDialog(null)}
    />
  );
  const actions = account && stateActions(account.state, setDialog);
  const select = account && roleSelect(account, setDialog);
  // A revoked account has left its department; it is attached again once back.
  const inDepartment =
    account?.role === 'department' && account.state !== 'revoked';

  if (desk) {
    const { companyCrumb, company, nav, account: me, onNavigate } = shell;
    const deskShell = {
      company,
      nav,
      account: me,
      onNavigate,
      companyCrumb,
      search: { value: query, onChange: toFirstPage(setQuery) },
    };
    if (list.isError && !list.data) {
      return (
        <ComptesErreurDesktop
          {...deskShell}
          onRetry={() => void list.refetch()}
        />
      );
    }
    const panel =
      open?.kind === 'create' ? (
        <CompteFormPanel
          title={t('accounts.create.title')}
          value={form}
          onChange={setForm}
          department={formDepartment}
          passwordLabel={t('accounts.create.password')}
          hint={formHint}
          taken={taken}
          submitLabel={t('accounts.create.submit')}
          submitIcon="userPlus"
          saving={create.isPending || !canCreate}
          onSubmit={() => create.mutate()}
          onClose={() => setOpen(null)}
        />
      ) : account ? (
        <CompteRecordPanel
          initials={initialsOf(account.name)}
          name={account.name}
          email={account.email}
          details={[
            {
              label: t('accounts.role'),
              value: select ? (
                <CompteInlineSelect select={select} name={t('accounts.role')} />
              ) : (
                roleName(account.role)
              ),
            },
            { label: t('accounts.state'), value: stateLabel(account.state, t) },
            { label: t('accounts.lastSignIn'), value: lastSignIn(account) },
            { label: t('accounts.devices'), value: devicesLine(account, t) },
          ]}
          department={inDepartment ? attachTo(account) : undefined}
          departmentHint={t('accounts.departmentHint')}
          message={attach.isError ? errorMessage(attach.error) : undefined}
          passwordLabel={t('accounts.password.action')}
          onPassword={() => setDialog({ kind: 'password' })}
          stateAction={actions?.state}
          revoke={actions?.revoke}
          onClose={() => setOpen(null)}
        />
      ) : undefined;
    return (
      <>
        <ComptesDesktop
          {...deskShell}
          title={t('accounts.title')}
          subtitle={
            counts?.all === 1
              ? t('accounts.subtitle.one')
              : t('accounts.subtitle.many', { count: counts?.all ?? 0 })
          }
          tabs={[
            { id: ALL, label: t('accounts.tab.all'), count: counts?.all ?? 0 },
            { id: 'shuttle', label: t('accounts.tab.shuttle'), count: counts?.shuttle ?? 0 },
            { id: 'department', label: t('accounts.tab.department'), count: counts?.department ?? 0 },
            { id: 'company_admin', label: t('accounts.tab.admin'), count: counts?.company_admin ?? 0 },
          ]}
          activeTab={tab}
          onTab={(id) => toFirstPage(setTab)(id as Tab)}
          departmentFilter={departmentSelect(
            allDepartments,
            departmentFilter,
            toFirstPage(setDepartmentFilter),
            t('accounts.tab.all'),
          )}
          stateFilter={{
            value: stateFilter,
            label: stateFilter ? stateLabel(stateFilter, t) : t('accounts.tab.all'),
            options: [
              { id: '', label: t('accounts.tab.all') },
              { id: 'active', label: stateLabel('active', t) },
              { id: 'suspended', label: stateLabel('suspended', t) },
              { id: 'revoked', label: stateLabel('revoked', t) },
            ],
            onChange: (id) =>
              toFirstPage(setStateFilter)(id as AccountState | ''),
          }}
          rows={rows.map((row) => tableRow(row, t))}
          activeRow={recordId ?? undefined}
          onSelect={(id) => {
            attach.reset();
            setOpen({ kind: 'record', id });
          }}
          range={pageRange(page, ACCOUNTS_PAGE_SIZE, total, t)}
          onPrevious={previous}
          onNext={next}
          addLabel={t('accounts.create.title')}
          onAdd={() => {
            create.reset();
            setOpen({ kind: 'create' });
          }}
          panel={panel}
        />
        {sheet}
      </>
    );
  }

  if (open?.kind === 'create') {
    const ROLES = [
      { id: 'shuttle', label: t('accounts.segment.shuttle') },
      { id: 'department', label: t('accounts.segment.department') },
      { id: 'company_admin', label: t('accounts.segment.admin') },
    ];
    return (
      <CompteFormMobile
        title={t('accounts.create.title')}
        roles={ROLES.map((role) => role.label)}
        role={ROLES.find((role) => role.id === form.role)?.label ?? ''}
        onRole={(label) =>
          setForm((value) => ({
            ...value,
            role: ROLES.find((role) => role.label === label)?.id ?? value.role,
          }))
        }
        department={form.role === 'department' ? formDepartment : undefined}
        name={form.name}
        email={form.email}
        password={form.password}
        passwordLabel={t('accounts.create.password')}
        onField={(key, value) =>
          setForm((current) => ({ ...current, [key]: value }))
        }
        hint={formHint}
        taken={taken}
        submitLabel={t('accounts.create.submit')}
        submitIcon="userPlus"
        saving={create.isPending || !canCreate}
        onSubmit={() => create.mutate()}
        onClose={() => setOpen(null)}
      />
    );
  }

  if (recordId && account) {
    return (
      <>
        <CompteRecordMobile
          initials={initialsOf(account.name)}
          name={account.name}
          email={account.email}
          role={{ value: roleName(account.role), select }}
          department={
            inDepartment
              ? { value: account.departmentName ?? '—', select: attachTo(account) }
              : undefined
          }
          state={stateLabel(account.state, t)}
          lastLogin={lastSignIn(account)}
          devices={devicesLine(account, t)}
          message={attach.isError ? errorMessage(attach.error) : undefined}
          actions={[
            {
              label: t('accounts.password.action'),
              onClick: () => setDialog({ kind: 'password' }),
            },
            ...(actions
              ? [
                  {
                    label: actions.state.label,
                    danger: actions.state.danger,
                    onClick: actions.state.onClick,
                  },
                ]
              : []),
            ...(actions?.revoke
              ? [{ ...actions.revoke, danger: true }]
              : []),
          ]}
          onBack={() => setOpen(null)}
        />
        {sheet}
      </>
    );
  }

  const sections = (
    [
      ['shuttle', t('accounts.tab.shuttle'), counts?.shuttle],
      ['department', t('accounts.tab.department'), counts?.department],
      ['company_admin', t('accounts.tab.admin'), counts?.company_admin],
    ] as const
  )
    .map(([role, title, count]) => ({
      title,
      count: count ?? 0,
      rows: rows
        .filter((row) => row.role === role)
        .map((row) => ({
          id: row.id,
          initials: initialsOf(row.name),
          name: row.name,
          line: row.departmentName ?? roleName(row.role),
          state:
            row.state === 'active'
              ? undefined
              : { label: stateLabel(row.state, t), kind: row.state },
        })),
    }))
    .filter((section) => section.rows.length > 0);

  return (
    <ComptesMobile
      title={t('accounts.title')}
      sections={sections}
      query={query}
      onQueryChange={toFirstPage(setQuery)}
      onSelect={(id) => {
        attach.reset();
        setOpen({ kind: 'record', id });
      }}
      onAdd={() => {
        create.reset();
        setOpen({ kind: 'create' });
      }}
      onBack={() => void navigate({ to: '/reglages' })}
      footer={
        <div className="mt-4 pb-6">
          {list.isError && !list.data && (
            <p role="alert" className="text-14 text-red">
              {t('accounts.failed')}
            </p>
          )}
          {list.data && total > ACCOUNTS_PAGE_SIZE && (
            <div className="flex items-center justify-between text-14 text-muted">
              <span>{pageRange(page, ACCOUNTS_PAGE_SIZE, total, t)}</span>
              <span className="flex gap-2">
                <Button variant="secondary" size="sm" disabled={!previous} onClick={previous}>
                  {t('accounts.previous')}
                </Button>
                <Button variant="secondary" size="sm" disabled={!next} onClick={next}>
                  {t('accounts.next')}
                </Button>
              </span>
            </div>
          )}
        </div>
      }
    />
  );
}

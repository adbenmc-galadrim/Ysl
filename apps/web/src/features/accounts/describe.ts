import type {
  AccountRecord,
  AccountState,
  ListAccountsOutput,
} from '@repo/contract/accounts';
import type { TranslateFn } from '@repo/shared/i18n';
import type { CompteRole, CompteRow, CompteStateKind } from '@repo/ui';
import { deviceKind } from '#/features/devices/describe';
import { formatSyncTime } from '#/features/sync/sync-card';

const ROLE_TAG: Partial<Record<string, CompteRole>> = {
  shuttle: 'navette',
  department: 'departement',
  company_admin: 'admin',
};

export const stateLabel = (state: AccountState, t: TranslateFn): string =>
  t(`accounts.state.${state}`);

export const lastSignIn = (
  account: Pick<AccountRecord, 'lastSignInAt'>,
  now = new Date(),
): string =>
  account.lastSignInAt ? formatSyncTime(account.lastSignInAt, now) : '—';

/** « iPhone, Mac » : each kind of device still signed in, once. */
export function devicesLine(
  account: Pick<AccountRecord, 'deviceAgents'>,
  t: TranslateFn,
): string {
  const kinds = new Set(account.deviceAgents.map(deviceKind));
  return kinds.size
    ? [...kinds].map((kind) => t(`devices.kind.${kind}`)).join(', ')
    : '—';
}

export function tableRow(account: AccountRecord, t: TranslateFn): CompteRow {
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role ? (ROLE_TAG[account.role] ?? null) : null,
    department: account.departmentName ?? '—',
    state: stateLabel(account.state, t),
    stateKind: account.state satisfies CompteStateKind,
    lastLogin: lastSignIn(account),
  };
}

/** « 51–100 sur 205 ». */
export function pageRange(
  page: number,
  pageSize: number,
  total: number,
  t: TranslateFn,
): string {
  return t('directory.range', {
    from: total === 0 ? 0 : (page - 1) * pageSize + 1,
    to: Math.min(page * pageSize, total),
    total,
  });
}

export const hasNextPage = (
  page: number,
  pageSize: number,
  { total }: Pick<ListAccountsOutput, 'total'>,
): boolean => page * pageSize < total;

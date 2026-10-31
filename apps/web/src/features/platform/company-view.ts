import type { PlatformCompany } from '@repo/contract/platform';
import type { TranslateFn } from '@repo/shared/i18n';
import type { Company, CompanyTab, DeskStat } from '@repo/ui';
import { initialsOf } from '#/features/settings/initials';

export type CompanyFilter = 'all' | 'active' | 'suspended';

export const COMPANY_FILTERS: CompanyFilter[] = ['all', 'active', 'suspended'];

const LONG_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'Europe/Paris',
});

export const longDate = (date: Date): string => LONG_DATE.format(date);

export const figure = (n: number): string => n.toLocaleString('fr-FR');

export function counted(
  kind: 'accounts' | 'departments',
  count: number,
  t: TranslateFn,
): string {
  return count === 1
    ? t(`platform.count.${kind}.one`)
    : t(`platform.count.${kind}`, { count: figure(count) });
}

export function modelName(
  model: PlatformCompany['profileModel'],
  t: TranslateFn,
): string {
  return model ? t(`platform.model.${model}`) : t('platform.model.none');
}

export const isActive = (company: PlatformCompany): boolean =>
  company.suspendedAt === null;

/** A row of the mock-up's table, whose usage columns stay blank until the figures exist. */
export function companyRow(company: PlatformCompany, t: TranslateFn): Company {
  return {
    id: company.id,
    initials: initialsOf(company.name),
    name: company.name,
    status: isActive(company) ? 'active' : 'suspended',
    statusLabel: isActive(company)
      ? t('platform.status.active')
      : t('platform.status.suspended'),
    profile: modelName(company.profileModel, t),
    departments: company.departments,
    accounts: company.accounts,
    parcels: '',
    lastActivity: '',
  };
}

export function matchesFilter(
  company: PlatformCompany,
  filter: CompanyFilter,
  query: string,
): boolean {
  const named = company.name
    .toLocaleLowerCase('fr')
    .includes(query.trim().toLocaleLowerCase('fr'));
  if (!named) return false;
  if (filter === 'all') return true;
  return filter === 'active' ? isActive(company) : !isActive(company);
}

export function companyTabs(
  companies: PlatformCompany[],
  t: TranslateFn,
): CompanyTab[] {
  const active = companies.filter(isActive).length;
  return [
    { label: t('platform.list.tab.all'), count: companies.length },
    { label: t('platform.list.tab.active'), count: active },
    {
      label: t('platform.list.tab.suspended'),
      count: companies.length - active,
    },
  ];
}

export function companyStats(
  companies: PlatformCompany[],
  t: TranslateFn,
): DeskStat[] {
  const active = companies.filter(isActive).length;
  const suspended = companies.length - active;
  return [
    { label: t('platform.list.stat.active'), value: figure(active) },
    {
      label: t('platform.list.stat.accounts'),
      value: figure(companies.reduce((sum, row) => sum + row.accounts, 0)),
    },
    {
      label: t('platform.list.stat.suspended'),
      value: figure(suspended),
      ...(suspended > 0 ? { tone: 'orange' as const } : {}),
    },
  ];
}

import type {
  PlatformCompany,
  PlatformOverviewOutput,
} from '@repo/contract/platform';
import type { TranslateFn } from '@repo/shared/i18n';
import { PROFILE_MODELS } from '@repo/contract/operating-profile';
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

const MONTH = new Intl.DateTimeFormat('fr-FR', {
  month: 'long',
  timeZone: 'Europe/Paris',
});

export const monthName = (now: Date): string => MONTH.format(now);

const TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Europe/Paris',
});

const SHORT_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  timeZone: 'Europe/Paris',
});

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' });

export const timeOf = (date: Date): string => TIME.format(date);

export const shortDate = (date: Date): string => SHORT_DATE.format(date);

/** Days between two instants on Paris's calendar: 0 today, 1 yesterday. */
export function daysAgo(date: Date, now: Date): number {
  const day = (at: Date) => Date.parse(DAY.format(at));
  return Math.round((day(now) - day(date)) / 86_400_000);
}

export function activityLabel(
  date: Date | null,
  now: Date,
  t: TranslateFn,
): string {
  if (!date) return t('platform.activity.none');
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 60) {
    return t('platform.activity.minutes', { count: Math.max(minutes, 1) });
  }
  const days = daysAgo(date, now);
  if (days === 0) return t('platform.activity.today', { time: timeOf(date) });
  if (days === 1) {
    return t('platform.activity.yesterday', { time: timeOf(date) });
  }
  return shortDate(date);
}

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

export function companyRow(
  company: PlatformCompany,
  t: TranslateFn,
  now = new Date(),
): Company {
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
    parcels: figure(company.parcelsThisMonth),
    lastActivity: activityLabel(company.lastActivityAt, now, t),
  };
}

export const MODEL_FILTERS = [
  'all',
  ...PROFILE_MODELS,
  'none',
] as const;

export type ModelFilter = (typeof MODEL_FILTERS)[number];

export const matchesModel = (
  company: PlatformCompany,
  model: ModelFilter,
): boolean =>
  model === 'all' || (company.profileModel ?? 'none') === model;

export const COMPANY_SORTS = ['activity', 'name', 'parcels'] as const;

export type CompanySort = (typeof COMPANY_SORTS)[number];

/** The most recent or the busiest first; the server's order, by name, breaks ties. */
export function sortedCompanies(
  companies: PlatformCompany[],
  sort: CompanySort,
): PlatformCompany[] {
  if (sort === 'name') return companies;
  const score = (company: PlatformCompany) =>
    sort === 'parcels'
      ? company.parcelsThisMonth
      : (company.lastActivityAt?.getTime() ?? 0);
  return [...companies].sort((a, b) => score(b) - score(a));
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

const PENDING = '—';

/** The same date for a tile, where a phone has room for one short word. */
export function activityFigure(date: Date | null, now: Date): string {
  if (!date) return PENDING;
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 60) return `${Math.max(minutes, 1)} min`;
  return daysAgo(date, now) === 0 ? timeOf(date) : shortDate(date);
}

export function companyStats(
  overview: PlatformOverviewOutput | undefined,
  t: TranslateFn,
  now = new Date(),
): DeskStat[] {
  const suspended = overview?.suspendedCompanies ?? 0;
  const shown = (value: number | undefined) =>
    value === undefined ? PENDING : figure(value);
  return [
    {
      label: t('platform.list.stat.active'),
      value: shown(overview && overview.companies - suspended),
    },
    { label: t('platform.list.stat.accounts'), value: shown(overview?.accounts) },
    {
      label: t('platform.list.stat.parcels', { month: monthName(now) }),
      value: shown(overview?.parcelsThisMonth),
    },
    {
      label: t('platform.list.stat.suspended'),
      value: shown(overview?.suspendedCompanies),
      ...(suspended > 0 ? { tone: 'orange' as const } : {}),
    },
  ];
}

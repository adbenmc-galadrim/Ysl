import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  EntreprisesDesktop,
  EntreprisesErreurDesktop,
  EntreprisesListMobile,
  type Company,
} from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { useSignOut } from '#/features/auth/api/sign-out';
import {
  COMPANY_FILTERS,
  COMPANY_SORTS,
  companyRow,
  companyStats,
  companyTabs,
  counted,
  type CompanySort,
  figure,
  isActive,
  matchesFilter,
  matchesModel,
  MODEL_FILTERS,
  type ModelFilter,
  modelName,
  activityLabel,
  sortedCompanies,
} from '#/features/platform/company-view';
import { usePlatformChrome } from '#/features/platform/components/use-platform-chrome';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

export const COMPANIES_KEY = ['platform', 'companies'];

/** The home of the app's admin: its clients, by name and figures only (D26). */
export function CompaniesPage() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const chrome = usePlatformChrome();
  const signOut = useSignOut();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [model, setModel] = useState<ModelFilter>('all');
  const [sort, setSort] = useState<CompanySort>('activity');
  const companies = useQuery({
    queryKey: COMPANIES_KEY,
    queryFn: () => trpcClient.platform.companies.query(),
  });
  const overview = useQuery({
    queryKey: ['platform', 'overview'],
    queryFn: () => trpcClient.platform.overview.query(),
  });
  const all = useMemo(() => companies.data ?? [], [companies.data]);
  const shown = sortedCompanies(
    all.filter(
      (company) =>
        matchesFilter(company, COMPANY_FILTERS[tab] ?? 'all', query) &&
        matchesModel(company, model),
    ),
    sort,
  );
  const modelLabel = (value: ModelFilter) =>
    value === 'all'
      ? t('platform.list.filter.model.all')
      : modelName(value === 'none' ? null : value, t);
  const open = (company: Company) =>
    void navigate({ to: '/entreprises/$id', params: { id: company.id } });
  const onNew = () => void navigate({ to: '/entreprises/nouvelle' });
  const search = { value: query, onChange: setQuery };

  if (companies.isError && desk) {
    return (
      <EntreprisesErreurDesktop
        chrome={{ ...chrome, search }}
        onRetry={() => void companies.refetch()}
      />
    );
  }
  const subtitle =
    all.length === 1
      ? t('platform.list.subtitle.one')
      : t('platform.list.subtitle', { count: all.length });
  if (desk) {
    return (
      <EntreprisesDesktop
        chrome={{ ...chrome, search }}
        subtitle={companies.isPending ? t('platform.loading') : subtitle}
        stats={companyStats(overview.data, t)}
        tabs={companyTabs(all, t)}
        activeTab={tab}
        onSelectTab={setTab}
        rows={shown.map((company) => companyRow(company, t))}
        filters={[
          {
            icon: 'filter',
            label: t('platform.list.filter.model'),
            value: modelLabel(model),
            className: 'w-[230px]',
            selected: model,
            onSelect: (value) => setModel(value as ModelFilter),
            choices: MODEL_FILTERS.map((value) => ({
              value,
              label: modelLabel(value),
            })),
          },
          {
            icon: 'list',
            label: t('platform.list.filter.sort'),
            value: t(`platform.list.sort.${sort}`),
            className: 'w-[176px]',
            selected: sort,
            onSelect: (value) => setSort(value as CompanySort),
            choices: COMPANY_SORTS.map((value) => ({
              value,
              label: t(`platform.list.sort.${value}`),
            })),
          },
        ]}
        range={t('platform.list.range', {
          count: shown.length,
          total: all.length,
        })}
        note={t('platform.note')}
        onNew={onNew}
        onOpen={open}
      />
    );
  }
  const rowOf = (company: (typeof all)[number]) => ({
    company: companyRow(company, t),
    lines: [
      t('platform.list.line', {
        departments: counted('departments', company.departments, t),
        accounts: counted('accounts', company.accounts, t),
      }),
      t('platform.list.usage', {
        parcels: t('platform.count.parcels', {
          count: figure(company.parcelsThisMonth),
        }),
        activity: activityLabel(company.lastActivityAt, new Date(), t),
      }),
    ],
  });
  return (
    <EntreprisesListMobile
      subtitle={
        companies.isError
          ? t('error.internal')
          : companies.isPending
            ? t('platform.loading')
            : subtitle
      }
      active={shown.filter(isActive).map(rowOf)}
      watched={shown.filter((company) => !isActive(company)).map(rowOf)}
      onNew={onNew}
      onOpen={open}
      journalLabel={t('platform.nav.journal')}
      onJournal={() => void navigate({ to: '/journal' })}
      signOutLabel={t('platform.signOut')}
      onSignOut={() => signOut.mutate({})}
      search={search}
      searchPlaceholder={t('platform.search')}
    />
  );
}

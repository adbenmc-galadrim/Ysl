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
  companyRow,
  companyStats,
  companyTabs,
  counted,
  isActive,
  matchesFilter,
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
  const companies = useQuery({
    queryKey: COMPANIES_KEY,
    queryFn: () => trpcClient.platform.companies.query(),
  });
  const all = useMemo(() => companies.data ?? [], [companies.data]);
  const shown = all.filter((company) =>
    matchesFilter(company, COMPANY_FILTERS[tab] ?? 'all', query),
  );
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
        stats={companyStats(all, t)}
        tabs={companyTabs(all, t)}
        activeTab={tab}
        onSelectTab={setTab}
        rows={shown.map((company) => companyRow(company, t))}
        withUsage={false}
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
      signOutLabel={t('platform.signOut')}
      onSignOut={() => signOut.mutate({})}
      search={search}
      searchPlaceholder={t('platform.search')}
    />
  );
}

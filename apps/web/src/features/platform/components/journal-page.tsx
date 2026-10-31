import {
  JOURNAL_ACTIONS,
  JOURNAL_PAGE,
  JOURNAL_PERIODS,
  type JournalAction,
  type JournalPeriod,
} from '@repo/contract/platform';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  JournalChargementMobile,
  JournalDesktop,
  JournalListMobile,
  JournalVideMobile,
} from '@repo/ui';
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { usePlatformChrome } from '#/features/platform/components/use-platform-chrome';
import { platformErrorMessage } from '#/features/platform/errors';
import {
  journalDays,
  journalLine,
} from '#/features/platform/journal-view';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';
import { trpcClient } from '#/lib/trpc';

const t = createTranslator(DEFAULT_LOCALE);

const ALL = 'all';

/** The app's admin's own acts, kept twelve months; a company's people never appear (D26). */
export function JournalPage({ companyId }: { companyId?: string }) {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const chrome = usePlatformChrome();
  const [query, setQuery] = useState('');
  const [action, setAction] = useState<JournalAction | typeof ALL>(ALL);
  const [period, setPeriod] = useState<JournalPeriod>('12m');
  const [page, setPage] = useState(0);
  const filter = {
    period,
    ...(action === ALL ? {} : { action }),
    ...(query.trim() ? { query: query.trim() } : {}),
    ...(companyId ? { companyId } : {}),
  };
  const offset = page * JOURNAL_PAGE;
  const paged = useQuery({
    queryKey: ['platform', 'journal', { ...filter, offset }],
    queryFn: () => trpcClient.platform.journal.query({ ...filter, offset }),
    placeholderData: keepPreviousData,
    enabled: desk,
  });
  const piled = useInfiniteQuery({
    queryKey: ['platform', 'journal', 'phone', filter],
    queryFn: ({ pageParam }) =>
      trpcClient.platform.journal.query({ ...filter, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const read = pages.length * JOURNAL_PAGE;
      return read < last.total ? read : undefined;
    },
    placeholderData: keepPreviousData,
    enabled: !desk,
  });
  const journal = desk ? paged : piled;
  const entries = desk
    ? (paged.data?.entries ?? [])
    : (piled.data?.pages.flatMap((one) => one.entries) ?? []);
  const total =
    (desk ? paged.data?.total : piled.data?.pages[0]?.total) ?? 0;
  const now = new Date();
  const search = {
    value: query,
    onChange: (value: string) => {
      setQuery(value);
      setPage(0);
    },
  };

  if (desk) {
    const typeLabel = (value: JournalAction | typeof ALL) =>
      value === ALL
        ? t('platform.journal.filter.type.all')
        : t(`platform.journal.action.${value}`);
    return (
      <JournalDesktop
        data={{
          chrome: { ...chrome, search },
          searchPlaceholder: t('platform.search'),
          lines: entries.map((entry) => journalLine(entry, now, t)),
          filters: [
            ...(companyId
              ? [
                  {
                    icon: 'building' as const,
                    label: t('platform.journal.filter.company'),
                    value: entries[0]?.companyName ?? '…',
                    className: 'w-[300px]',
                    selected: companyId,
                    onSelect: () => {
                      setPage(0);
                      void navigate({ to: '/journal' });
                    },
                    choices: [
                      {
                        value: companyId,
                        label: entries[0]?.companyName ?? '…',
                      },
                      {
                        value: ALL,
                        label: t('platform.journal.filter.company.all'),
                      },
                    ],
                  },
                ]
              : []),
            {
              icon: 'filter',
              label: t('platform.journal.filter.type'),
              value: typeLabel(action),
              className: 'w-[260px]',
              selected: action,
              onSelect: (value) => {
                setAction(value as JournalAction | typeof ALL);
                setPage(0);
              },
              choices: [ALL, ...JOURNAL_ACTIONS].map((value) => ({
                value,
                label: typeLabel(value as JournalAction | typeof ALL),
              })),
            },
            {
              icon: 'calendar',
              label: t('platform.journal.filter.period'),
              value: t(`platform.journal.period.${period}`),
              className: 'w-[209px]',
              selected: period,
              onSelect: (value) => {
                setPeriod(value as JournalPeriod);
                setPage(0);
              },
              choices: JOURNAL_PERIODS.map((value) => ({
                value,
                label: t(`platform.journal.period.${value}`),
              })),
            },
          ],
          range: t('platform.journal.range', {
            from: total === 0 ? 0 : offset + 1,
            to: offset + entries.length,
            total,
          }),
          onPrevious: page > 0 ? () => setPage(page - 1) : undefined,
          onNext:
            offset + entries.length < total
              ? () => setPage(page + 1)
              : undefined,
          message: journal.isError
            ? platformErrorMessage(journal.error)
            : journal.data && total === 0
              ? t('platform.journal.none')
              : undefined,
        }}
      />
    );
  }

  const onBack = () =>
    void (companyId
      ? navigate({ to: '/entreprises/$id', params: { id: companyId } })
      : navigate({ to: '/' }));
  if (journal.isPending) return <JournalChargementMobile onBack={onBack} />;
  if (journal.isError) {
    return (
      <JournalVideMobile
        onBack={onBack}
        title={t('error.internal')}
        description={platformErrorMessage(journal.error)}
      />
    );
  }
  if (total === 0 && !query.trim()) {
    return (
      <JournalVideMobile
        onBack={onBack}
        title={t('platform.journal.empty')}
        description={t('platform.journal.empty.description')}
      />
    );
  }
  return (
    <JournalListMobile
      days={journalDays(entries, now, t)}
      onBack={onBack}
      search={search}
      searchPlaceholder={t('platform.search')}
      message={total === 0 ? t('platform.journal.none') : undefined}
      moreLabel={piled.hasNextPage ? t('platform.journal.more') : undefined}
      onMore={() => void piled.fetchNextPage()}
    />
  );
}

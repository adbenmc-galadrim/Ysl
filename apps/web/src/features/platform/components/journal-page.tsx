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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
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
export function JournalPage({ company }: { company?: string }) {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const chrome = usePlatformChrome();
  const [query, setQuery] = useState(company ?? '');
  const [action, setAction] = useState<JournalAction | typeof ALL>(ALL);
  const [period, setPeriod] = useState<JournalPeriod>('12m');
  const [page, setPage] = useState(0);
  const [shownOnPhone, setShownOnPhone] = useState(JOURNAL_PAGE);
  const offset = desk ? page * JOURNAL_PAGE : 0;
  const limit = desk ? JOURNAL_PAGE : shownOnPhone;
  const input = {
    period,
    offset,
    limit,
    ...(action === ALL ? {} : { action }),
    ...(query.trim() ? { query: query.trim() } : {}),
  };
  const journal = useQuery({
    queryKey: ['platform', 'journal', input],
    queryFn: () => trpcClient.platform.journal.query(input),
    placeholderData: keepPreviousData,
  });
  const entries = journal.data?.entries ?? [];
  const total = journal.data?.total ?? 0;
  const now = new Date();
  const search = {
    value: query,
    onChange: (value: string) => {
      setQuery(value);
      setPage(0);
      setShownOnPhone(JOURNAL_PAGE);
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

  const onBack = () => void navigate({ to: '/' });
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
      moreLabel={entries.length < total ? t('platform.journal.more') : undefined}
      onMore={() => setShownOnPhone(shownOnPhone + JOURNAL_PAGE)}
    />
  );
}

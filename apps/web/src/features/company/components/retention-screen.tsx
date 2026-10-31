import {
  COMPANY_RETENTION_KEYS,
  impactRows,
  RETENTION_LIMITS,
  resolveRetention,
  type CompanyRetentionKey,
  type RetentionAmounts,
  type RetentionImpact,
} from '@repo/contract/company-settings';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  DeskSectionTitle,
  DeskTable,
  GroupedHeader,
  Sheet,
  type DeskTableColumn,
} from '@repo/ui';
import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import {
  CompanyFrame,
  companyPlaceholder,
} from '#/features/company/company-frame';
import { refusal, useCompany } from '#/features/company/use-company';
import { formatDuration } from '#/features/retention/describe';
import { trpcClient } from '#/lib/trpc';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

const CHOICES: Record<'day' | 'month', readonly number[]> = {
  day: [1, 3, 7, 14, 30, 60, 90],
  month: [1, 3, 6, 12, 18, 24, 36, 48, 60],
};

/** The choices of a duration, the current one kept if it is not among them. */
function choicesOf(key: CompanyRetentionKey, current: number): number[] {
  const { unit, min, max } = RETENTION_LIMITS[key];
  const usual = CHOICES[unit].filter(
    (amount) => amount >= min && amount <= max,
  );
  return [...new Set([...usual, current])].sort((a, b) => a - b);
}

function DurationSelect({
  name,
  value,
  amounts,
  onChange,
  disabled,
}: {
  name: CompanyRetentionKey;
  value: number;
  amounts: number[];
  onChange: (amount: number) => void;
  disabled: boolean;
}) {
  const { unit } = RETENTION_LIMITS[name];
  return (
    <select
      aria-label={t(`company.retention.${name}`)}
      className="h-8 cursor-pointer rounded-[6px] bg-surface px-2 text-13 text-ink shadow-[0_0_0_0.5px_var(--color-border),inset_0_0_0_0.5px_var(--color-border)] focus-visible:ring-2 focus-visible:ring-blue"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    >
      {amounts.map((amount) => (
        <option key={amount} value={amount}>
          {formatDuration({ amount, unit })}
        </option>
      ))}
    </select>
  );
}

const counted = (
  key: 'parcels' | 'proofs' | 'contacts' | 'emails',
  count: number,
) =>
  count > 0
    ? t(`company.retention.count.${key}.${count > 1 ? 'many' : 'one'}`, {
        count,
      })
    : null;

/** "38 colis, 402 e-mails": what the server can count of what goes. */
function announcement(impact: RetentionImpact): string | null {
  const parts = [
    counted('parcels', impact.parcels),
    counted('proofs', impact.proofs),
    counted('contacts', impact.contacts),
    counted('emails', impact.emails),
  ].filter((part): part is string => part !== null);
  return parts.length ? parts.join(', ') : null;
}

function ImpactLines({ impact }: { impact: RetentionImpact }) {
  const rows = announcement(impact);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-14">
        {rows
          ? t('company.retention.impact', { rows })
          : t('company.retention.impact.none')}
      </p>
      {impact.deviceOnly.length > 0 && (
        <p className="text-13 text-muted">
          {t('company.retention.impact.device')}
        </p>
      )}
    </div>
  );
}

type Row = { key: CompanyRetentionKey };

/**
 * Réglages › Conservation (admin, D28, mockup 16). Lowering a duration erases
 * data at the next purge: the rows are announced before anything is saved, and
 * what the iPhones alone hold is said to be uncountable rather than left out.
 */
export function RetentionScreen() {
  const desk = useMediaQuery(DESK_WIDTH);
  const navigate = useNavigate();
  const { query, online, refresh } = useCompany();
  const [draft, setDraft] = useState<RetentionAmounts | null>(null);
  const [confirming, setConfirming] = useState(false);
  const stored = query.data?.retention;
  const value = draft ?? stored ?? {};
  const resolved = resolveRetention(value);
  const saved = resolveRetention(stored);
  const changed =
    draft !== null &&
    COMPANY_RETENTION_KEYS.some(
      (key) => resolved[key].amount !== saved[key].amount,
    );

  const preview = useQuery({
    queryKey: ['company', 'previewRetention', value],
    queryFn: () =>
      trpcClient.company.previewRetention.query({ retention: value }),
    enabled: online && changed,
    placeholderData: keepPreviousData,
  });
  const impact = changed ? preview.data : undefined;

  const save = useMutation({
    mutationFn: (announced: number) =>
      trpcClient.company.saveRetention.mutate({ retention: value, announced }),
    onSuccess: async (outcome) => {
      if (outcome.status === 'changed') {
        await preview.refetch();
        return;
      }
      setConfirming(false);
      setDraft(null);
      await refresh();
    },
  });
  const staleAnnouncement = save.data?.status === 'changed' && !save.isPending;

  const select = (key: CompanyRetentionKey) => (
    <DurationSelect
      name={key}
      value={resolved[key].amount}
      amounts={choicesOf(key, resolved[key].amount).filter(
        (amount) => key !== 'signature' || amount <= resolved.parcel.amount,
      )}
      disabled={save.isPending}
      onChange={(amount) => {
        save.reset();
        // A signature goes with its parcel: it follows, rather than being refused.
        const signature =
          key === 'parcel' && (value.signature ?? 0) > amount
            ? { signature: amount }
            : {};
        setDraft({ ...value, [key]: amount, ...signature });
      }}
    />
  );

  const columns: DeskTableColumn<Row>[] = [
    {
      key: 'data',
      header: t('company.retention.column.data'),
      width: 300,
      cell: ({ key }) => (
        <span className="font-semibold">{t(`company.retention.${key}`)}</span>
      ),
    },
    {
      key: 'where',
      header: t('company.retention.column.where'),
      width: 220,
      cell: ({ key }) => (
        <span className="text-ink-2">
          {t(`company.retention.where.${key}`)}
        </span>
      ),
    },
    {
      key: 'duration',
      header: t('company.retention.column.duration'),
      cell: ({ key }) => select(key),
    },
  ];

  const overlay = confirming && impact && (
    <Sheet
      fixed
      title={t('company.retention.confirm.title')}
      description={t('company.retention.confirm.description')}
      onDismiss={() => setConfirming(false)}
    >
      <div className="mt-4 flex flex-col gap-3">
        <ImpactLines impact={impact} />
        {staleAnnouncement && (
          <p role="alert" className="text-13 text-orange-strong">
            {t('company.retention.confirm.changed')}
          </p>
        )}
        {save.isError && (
          <p role="alert" className="text-13 text-red">
            {refusal(save.error, t('company.saveFailed'))}
          </p>
        )}
        <Button
          block
          disabled={save.isPending || preview.isFetching}
          onClick={() => save.mutate(impactRows(impact))}
        >
          {t('company.retention.confirm.action')}
        </Button>
        <Button block variant="secondary" onClick={() => setConfirming(false)}>
          {t('company.retention.confirm.cancel')}
        </Button>
      </div>
    </Sheet>
  );

  const rows = COMPANY_RETENTION_KEYS.map((key) => ({ key }));
  return (
    <CompanyFrame
      tab="retention"
      title={t('company.retention.title')}
      overlay={overlay}
    >
      {!query.data ? (
        <p className="p-4 text-14 text-muted">
          {companyPlaceholder(online, query.isError)}
        </p>
      ) : (
        <div
          className={
            desk
              ? 'mt-5 flex max-w-[780px] flex-col gap-4'
              : 'flex flex-col gap-3 px-4 pb-8'
          }
        >
          {desk ? (
            <>
              <DeskSectionTitle
                title={t('company.retention.heading')}
                description={t('company.retention.description')}
              />
              <DeskTable
                label={t('company.retention.heading')}
                columns={columns}
                rows={rows}
                rowKey={(row) => row.key}
                rowHeight={48}
              />
            </>
          ) : (
            <>
              <GroupedHeader className="px-0">
                {t('company.retention.heading')}
              </GroupedHeader>
              <p className="text-13 text-muted">
                {t('company.retention.description')}
              </p>
              {COMPANY_RETENTION_KEYS.map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-control bg-surface p-3"
                >
                  <div className="min-w-0">
                    <p className="text-15 font-semibold">
                      {t(`company.retention.${key}`)}
                    </p>
                    <p className="text-13 text-muted">
                      {t(`company.retention.where.${key}`)}
                    </p>
                  </div>
                  {select(key)}
                </div>
              ))}
            </>
          )}
          {changed && impact && (
            <Banner
              tone={impactRows(impact) > 0 ? 'orange' : 'blue'}
              icon="alert"
              title={t('company.retention.next')}
              description={
                announcement(impact)
                  ? t('company.retention.impact', {
                      rows: announcement(impact)!,
                    })
                  : t('company.retention.impact.none')
              }
            />
          )}
          <div className={desk ? 'flex gap-2' : 'flex flex-col gap-2'}>
            <Button
              size={desk ? 'desk' : undefined}
              disabled={!changed || !impact || !online}
              onClick={() => {
                save.reset();
                setConfirming(true);
              }}
            >
              {t('company.save')}
            </Button>
            <Button
              variant="outline"
              size={desk ? 'desk' : undefined}
              icon="download"
              onClick={() => void navigate({ to: '/reglages/export' })}
            >
              {t('company.retention.export')}
            </Button>
          </div>
        </div>
      )}
    </CompanyFrame>
  );
}

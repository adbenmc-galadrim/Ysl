import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, DepartmentDepositsContent } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';
import { useOwnDepartmentName } from '#/features/shell/components/use-desk-shell';
import { isPending, latestFirst } from '#/features/parcels/deposit';
import { formatWhen } from '#/features/parcels/record';

const t = createTranslator(DEFAULT_LOCALE);

/** Deposits of the department: those to count first (ME30). */
export function DepartmentDepositsPage() {
  const navigate = useNavigate();
  const name = useOwnDepartmentName();
  const deposits = useLiveQuery(
    async () =>
      latestFirst(await db.deposit.filter((row) => !row.deletedAt).toArray()),
    [],
  );
  const now = new Date();
  const rows = [...(deposits ?? [])]
    .sort((a, b) => Number(isPending(b)) - Number(isPending(a)))
    .map((row) => {
      const pending = isPending(row);
      return {
        id: row.id,
        at: formatWhen(row.postedAt, now, t),
        by: row.shuttleName ?? t('deposits.shuttle'),
        count: row.announced,
        state: pending
          ? t('deposits.state.pending')
          : row.gap
            ? t('deposits.state.gap', { count: row.counted ?? 0 })
            : row.confirmedByName
              ? t('deposits.state.confirmedBy', { name: row.confirmedByName })
              : t('deposits.state.confirmed'),
        tone: pending
          ? ('orange' as const)
          : row.gap
            ? ('red' as const)
            : ('green' as const),
      };
    });
  const waiting = rows.filter(({ tone }) => tone === 'orange').length;
  return (
    <div className="px-5 pt-[calc(var(--safe-top)+12px)] xl:p-0">
      <DepartmentDepositsContent
        title={t('deposits.title')}
        subtitle={t('deposits.subtitle', { count: waiting, name })}
        label={t('deposits.title')}
        empty={t('deposits.empty')}
        rows={rows}
        columns={{
          at: t('deposits.column.at'),
          by: t('deposits.column.by'),
          count: t('deposits.column.count'),
          state: t('deposits.column.state'),
        }}
        onRow={(depositId) =>
          void navigate({
            to: '/departement/depots/$depositId',
            params: { depositId },
          })
        }
      />
      <Button
        variant="secondary"
        icon="qr"
        iconSize={18}
        className="mt-6 w-fit gap-2 px-4"
        onClick={() => void navigate({ to: '/reglages/affiche-qr' })}
      >
        {t('poster.link')}
      </Button>
    </div>
  );
}

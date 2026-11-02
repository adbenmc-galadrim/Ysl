import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { type HistoriqueDay, HistoriqueMobile } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { loadSpace } from '#/features/department-space/load';
import {
  closedAt,
  historyLine,
  inTab,
  latestClosedFirst,
} from '#/features/department-space/space';
import { useMinuteClock } from '#/features/parcels/api/use-parcels';
import { startOfDay } from '#/features/parcels/model';
import { dayTitle } from '#/features/search/search-index';

const t = createTranslator(DEFAULT_LOCALE);

/** What left the department, by day, on the phone. */
export function DepartmentHistoryPage() {
  const navigate = useNavigate();
  const session = useSession();
  const now = useMinuteClock();
  const parcels = useLiveQuery(() => loadSpace(db, now), [now]);
  if (!parcels) return null;
  const days: HistoriqueDay[] = [];
  for (const row of latestClosedFirst(inTab(parcels, 'history'))) {
    const title = dayTitle(startOfDay(closedAt(row)), now, t);
    const line = {
      id: row.parcel.id,
      title: row.entry.row.recipient,
      line: historyLine(row, t, session.user.id),
      closed:
        row.parcel.status === 'a_regulariser'
          ? ('toSettle' as const)
          : row.parcel.status === 'retourne'
            ? ('returned' as const)
            : undefined,
    };
    const last = days.at(-1);
    if (last?.title === title) last.rows.push(line);
    else days.push({ title, rows: [line] });
  }
  return (
    <HistoriqueMobile
      title={t('departmentSpace.tab.history')}
      days={days}
      empty={t('departmentSpace.empty.history')}
      onBack={() => void navigate({ to: '/' })}
      onRow={(parcelId) =>
        void navigate({ to: '/colis/$parcelId', params: { parcelId } })
      }
    />
  );
}

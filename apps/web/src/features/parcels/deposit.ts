import type { TranslateFn } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalDeposit,
  LocalParcel,
} from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';
import { formatTime } from '#/features/parcels/model';

const LOCATIONS_SHOWN = 8;

/**
 * « J'ai posé » (ME27): offline like every write. The parcels stay on their way
 * until the department counts them (D24), on the server.
 */
export async function postDeposit(
  db: CourrierDatabase,
  {
    departmentId,
    parcelIds,
    shuttleId,
    shuttleName,
    location = null,
    now = new Date(),
  }: {
    departmentId: string;
    parcelIds: readonly string[];
    shuttleId: string;
    shuttleName: string | null;
    /** Where they were put, if the shuttle says. */
    location?: string | null;
    now?: Date;
  },
): Promise<string> {
  const id = newId();
  const shelved = location
    ? (await db.parcel.bulkGet([...parcelIds])).filter(
        (row) => row !== undefined && row.location !== location,
      )
    : [];
  await commitLocal(
    db,
    {
      upserts: [
        {
          entity: 'deposit',
          row: {
            id,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
            departmentId,
            shuttleId,
            shuttleName,
            parcelIds: [...parcelIds],
            announced: parcelIds.length,
            postedAt: now,
            counted: null,
            gap: null,
            gapParcelIds: null,
            confirmedAt: null,
            confirmedBy: null,
            confirmedByName: null,
          },
        },
        ...shelved.flatMap((row) =>
          row
            ? [
                {
                  entity: 'parcel' as const,
                  row: { ...row, location, updatedAt: now },
                },
                parcelEvent(
                  row.id,
                  { type: 'parcel.edited', fields: ['location'] },
                  { agentId: shuttleId, now },
                ),
              ]
            : [],
        ),
      ],
    },
    { now },
  );
  return id;
}

export const isPending = (deposit: LocalDeposit) =>
  !deposit.confirmedAt && !deposit.deletedAt;

/** The parcel ids a deposit still to count holds back at this department; one that moved since goes on. */
export function pendingParcelIds(
  deposits: readonly LocalDeposit[],
  departmentId: string,
): ReadonlySet<string> {
  return new Set(
    deposits
      .filter((row) => isPending(row) && row.departmentId === departmentId)
      .flatMap((row) => row.parcelIds),
  );
}

/** The last one first: what the screens say about a department. */
export const latestFirst = (deposits: readonly LocalDeposit[]) =>
  [...deposits].sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());

/** « Finance a compté 4 colis sur 5 au dépôt de 9:40. » */
export function gapLine(
  deposit: Pick<LocalDeposit, 'gap' | 'counted' | 'announced' | 'postedAt'>,
  department: string,
  t: TranslateFn,
): string {
  const time = formatTime(deposit.postedAt);
  return deposit.gap === 'left'
    ? t('deposit.gap.left.line', { department, time })
    : t('deposit.gap.count.line', {
        department,
        counted: deposit.counted ?? 0,
        announced: deposit.announced,
        time,
      });
}

/** The places in use at a department, the last one used first: the shelves are few, and keep their names. */
export async function locationsOf(
  db: CourrierDatabase,
  departmentId: string,
): Promise<string[]> {
  const rows = await db.parcel
    .filter(
      (row) =>
        row.departmentId === departmentId &&
        !row.deletedAt &&
        Boolean(row.location?.trim()),
    )
    .toArray();
  const seen = new Map<string, string>();
  for (const { location } of rows.sort(
    (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
  )) {
    const name = location!.trim();
    if (!seen.has(name.toLocaleLowerCase('fr'))) {
      seen.set(name.toLocaleLowerCase('fr'), name);
    }
  }
  return [...seen.values()].slice(0, LOCATIONS_SHOWN);
}

/** Where a lot is, when all its parcels say the same. */
export function commonLocation(
  parcels: readonly Pick<LocalParcel, 'location'>[],
): string | null {
  const [first] = parcels;
  return first?.location &&
    parcels.every(({ location }) => location === first.location)
    ? first.location
    : null;
}

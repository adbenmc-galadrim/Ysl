import { parsePickup } from '@repo/contract/settings';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '#/features/db/database';

/** The department of this account, the only one it pulls; `pickup` of its own, or the company's. */
export function useOwnDepartment() {
  const row = useLiveQuery(
    () => db.department.filter((item) => !item.deletedAt).first(),
    [],
  );
  const pickup = parsePickup(row?.pickup);
  return {
    name: row?.name ?? '',
    place: pickup.place || row?.receptionPoint || '',
    pickup: row?.pickup ? pickup : null,
  };
}

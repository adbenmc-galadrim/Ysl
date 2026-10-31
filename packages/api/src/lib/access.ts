import { seesWholeCompany, type UserRole } from '@repo/contract/auth';
import { parcel } from '@repo/db/schema';
import { eq, sql, type SQL } from 'drizzle-orm';

/** Who reads or writes the data of a company. */
export type Access = {
  organizationId: string;
  userId: string;
  role: UserRole;
  departmentId: string | null;
  /** The company runs tours (`goesOnTour`): read for a shuttle only. */
  onTour?: boolean;
};

/** The parcels an account reaches (§2.1): all those of its company, those of its department, or those of its tours. */
export type ParcelScope =
  | { kind: 'company' }
  | { kind: 'department'; departmentId: string }
  | { kind: 'tour'; shuttleId: string };

/** Matches no row: a department account attached nowhere reaches nothing. */
const UNATTACHED = '00000000-0000-0000-0000-000000000000';

/** A shuttle acting as department keeps the whole company: it has no tour to narrow it to. */
export function parcelScope({
  role,
  departmentId,
  userId,
  onTour,
}: Access): ParcelScope {
  if (role === 'shuttle' && onTour) return { kind: 'tour', shuttleId: userId };
  if (seesWholeCompany(role)) return { kind: 'company' };
  return { kind: 'department', departmentId: departmentId ?? UNATTACHED };
}

/** Whose tour a parcel is on: who took it over, else who validated it (§3.7.9). */
export const parcelCarrier = sql<string>`coalesce(${parcel.tourShuttleId}, ${parcel.receivedBy})`;

/** The parcels of this scope, within those of the company. */
export function parcelInScope(scope: ParcelScope): SQL | undefined {
  switch (scope.kind) {
    case 'company':
      return undefined;
    case 'department':
      return eq(parcel.departmentId, scope.departmentId);
    case 'tour':
      return sql`${parcelCarrier} = ${scope.shuttleId}`;
  }
}

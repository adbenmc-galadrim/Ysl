import { seesWholeCompany, type UserRole } from '@repo/contract/auth';

/** Who reads or writes the data of a company. */
export type Access = {
  organizationId: string;
  userId: string;
  role: UserRole;
  departmentId: string | null;
};

/** The parcels an account reaches (§2.1): all those of its company, or those of its department. */
export type ParcelScope =
  { kind: 'company' } | { kind: 'department'; departmentId: string };

/** Matches no row: a department account attached nowhere reaches nothing. */
const UNATTACHED = '00000000-0000-0000-0000-000000000000';

/**
 * `admin`, `agent` and a null role keep every parcel of their company until
 * the conversion (YSL-118). So does the shuttle until `tour` exists: YSL-133
 * narrows it to its tours here.
 */
export function parcelScope({ role, departmentId }: Access): ParcelScope {
  if (seesWholeCompany(role)) return { kind: 'company' };
  return { kind: 'department', departmentId: departmentId ?? UNATTACHED };
}

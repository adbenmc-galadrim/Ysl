import { z } from 'zod';
import type { ParcelStatus } from './parcel-status';

export type MoveOutcome = 'follows' | 'toSettle' | 'stays';

/**
 * What becomes of a parcel when its person changes department (ME21). The
 * trigger `directory_person_moved` holds the same list; a test compares them.
 * `toSettle`: already at its department, the parcel stays and is marked (D25).
 * Read it through `moveOutcomeOf`: a notified parcel may be deposited too.
 */
export const PARCEL_ON_MOVE: Record<ParcelStatus, MoveOutcome> = {
  a_completer: 'follows',
  recu: 'follows',
  en_route: 'follows',
  depose: 'toSettle',
  a_regulariser: 'stays',
  notifie: 'follows',
  remis: 'stays',
  retourne: 'stays',
};

export function moveOutcomeOf(parcel: {
  status: ParcelStatus;
  depositedAt?: Date | null;
}): MoveOutcome {
  return parcel.status === 'notifie' && parcel.depositedAt
    ? 'toSettle'
    : PARCEL_ON_MOVE[parcel.status];
}

const personId = z.uuid();
const departmentId = z.uuid();

export const moveEffectsInput = z.object({ personId });

export const movePersonInput = z.object({ personId, departmentId });

export type MovePersonInput = z.infer<typeof movePersonInput>;

export const moveEffects = z.object({
  follows: z.number().int().min(0),
  toSettle: z.number().int().min(0),
});

export type MoveEffects = z.infer<typeof moveEffects>;

export const MOVE_REQUEST_NOTE_MAX = 300;

/** A department asks the admin to move one of its people; it moves nobody itself (ME21). */
export const requestMoveInput = z.object({
  personId,
  note: z.string().trim().max(MOVE_REQUEST_NOTE_MAX).nullable(),
});

export type RequestMoveInput = z.infer<typeof requestMoveInput>;

export const closeMoveRequestInput = z.object({ personId });

export const moveRequest = z.object({
  personId,
  departmentId,
  departmentName: z.string(),
  note: z.string().nullable(),
  createdAt: z.date(),
});

export type MoveRequest = z.infer<typeof moveRequest>;

export const moveRequests = z.array(moveRequest);

/** An employee file stays far below; a wrong file does not. */
export const DIRECTORY_CSV_MAX_LENGTH = 5_000_000;

const csv = z.string().min(1).max(DIRECTORY_CSV_MAX_LENGTH);

/** What the admin decided for a department the file names and the company lacks. */
export const departmentChoice = z.object({
  name: z.string().min(1),
  departmentId,
});

export type DepartmentChoice = z.infer<typeof departmentChoice>;

export const directoryImportInput = z.object({
  csv,
  choices: z.array(departmentChoice).default([]),
});

export type DirectoryImportInput = z.infer<typeof directoryImportInput>;

export const DIRECTORY_COLUMNS = [
  'lastName',
  'firstName',
  'email',
  'department',
  'site',
] as const;

export type DirectoryColumn = (typeof DIRECTORY_COLUMNS)[number];

export const DIRECTORY_IMPORT_PROBLEMS = [
  'name-missing',
  'email-invalid',
  'duplicate-in-file',
  'department-unknown',
  'email-ambiguous',
] as const;

export type DirectoryImportProblem = (typeof DIRECTORY_IMPORT_PROBLEMS)[number];

export const directoryImportPreview = z.object({
  separator: z.enum([';', ',']),
  lines: z.number().int().min(0),
  columns: z.array(
    z.object({ source: z.string(), target: z.enum(DIRECTORY_COLUMNS) }),
  ),
  /** Columns the import cannot go without and the file lacks. */
  missing: z.array(z.enum(DIRECTORY_COLUMNS)),
  toAdd: z.number().int().min(0),
  toUpdate: z.number().int().min(0),
  /** Among the updates, those who change department: their parcels follow. */
  toMove: z.number().int().min(0),
  unchanged: z.number().int().min(0),
  errors: z.array(
    z.object({
      line: z.number().int().min(1),
      name: z.string(),
      email: z.string(),
      department: z.string(),
      problem: z.enum(DIRECTORY_IMPORT_PROBLEMS),
    }),
  ),
  unknownDepartments: z.array(
    z.object({ name: z.string(), lines: z.number().int().min(1) }),
  ),
});

export type DirectoryImportPreview = z.infer<typeof directoryImportPreview>;

export const directoryImportReport = z.object({
  added: z.number().int().min(0),
  updated: z.number().int().min(0),
  unchanged: z.number().int().min(0),
  ignored: z.number().int().min(0),
});

export type DirectoryImportReport = z.infer<typeof directoryImportReport>;

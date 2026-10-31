import { z } from 'zod';
import type { ParcelStatus } from './parcel-status';

export type MoveOutcome = 'follows' | 'toSettle' | 'stays';

/**
 * What becomes of a parcel when its person changes department (ME21). The
 * trigger of `drizzle/0021` holds the same list; a test compares them. Hook of
 * YSL-131: `en_route` follows, `depose` goes `toSettle`, and the trigger marks it.
 */
export const PARCEL_ON_MOVE: Record<ParcelStatus, MoveOutcome> = {
  a_completer: 'follows',
  recu: 'follows',
  notifie: 'follows',
  remis: 'stays',
  retourne: 'stays',
};

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

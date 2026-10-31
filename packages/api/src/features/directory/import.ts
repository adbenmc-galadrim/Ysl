import type {
  DepartmentChoice,
  DirectoryColumn,
  DirectoryImportPreview,
  DirectoryImportProblem,
  DirectoryImportReport,
} from '@repo/contract/directory';
import type { AnyDb } from '@repo/db';
import { department, directoryPerson } from '@repo/db/schema';
import { guessSeparator, readCsvRecords } from '@repo/shared/csv-read';
import { newId } from '@repo/shared/id';
import { isEmail, normalizeName } from '@repo/shared/text';
import { and, eq, isNull } from 'drizzle-orm';

const CHUNK = 500;

/** The words a file may head each column with, accents and case aside. */
const HEADERS: Record<DirectoryColumn, readonly string[]> = {
  lastName: ['nom', 'nom de famille', 'last name', 'lastname', 'surname'],
  firstName: ['prenom', 'first name', 'firstname', 'given name'],
  email: ['mail', 'email', 'e mail', 'courriel', 'adresse e mail'],
  department: ['service', 'departement', 'department', 'direction'],
  site: ['bureau', 'lieu', 'site', 'poste', 'etage'],
};

const REQUIRED: readonly DirectoryColumn[] = ['lastName', 'email'];

type Row = {
  line: number;
  firstName: string;
  lastName: string;
  email: string;
  department: string;
  site: string;
};

type Parsed = Pick<
  DirectoryImportPreview,
  'separator' | 'lines' | 'columns' | 'missing'
> & { rows: Row[] };

function parse(csv: string): Parsed {
  const separator = guessSeparator(csv);
  const [head, ...records] = readCsvRecords(csv, separator);
  const at = new Map<DirectoryColumn, number>();
  const columns: Parsed['columns'] = [];
  (head?.cells ?? []).forEach((cell, index) => {
    const word = normalizeName(cell);
    const target = (Object.keys(HEADERS) as DirectoryColumn[]).find(
      (column) => !at.has(column) && HEADERS[column].includes(word),
    );
    if (!target) return;
    at.set(target, index);
    columns.push({ source: cell.trim(), target });
  });
  const missing = REQUIRED.filter((column) => !at.has(column));
  const cell = (cells: string[], column: DirectoryColumn) => {
    const index = at.get(column);
    return index === undefined ? '' : (cells[index] ?? '').trim();
  };
  const rows = records.map(({ line, cells }): Row => {
    const written = cell(cells, 'lastName');
    const firstName = cell(cells, 'firstName');
    // A single « Nom » column may hold the whole name.
    const space = firstName ? -1 : written.search(/\s/);
    return {
      line,
      firstName: space < 0 ? firstName : written.slice(0, space),
      lastName: space < 0 ? written : written.slice(space + 1).trim(),
      email: cell(cells, 'email').toLowerCase(),
      department: cell(cells, 'department'),
      site: cell(cells, 'site'),
    };
  });
  return { separator, lines: records.length, columns, missing, rows };
}

const fullName = (row: Pick<Row, 'firstName' | 'lastName'>) =>
  `${row.firstName} ${row.lastName}`.trim();

type Existing = typeof directoryPerson.$inferSelect;

type Change =
  | { kind: 'add'; row: Row; departmentId: string | null; name: string | null }
  | {
      kind: 'update';
      row: Row;
      firstName: string;
      lastName: string;
      person: Existing;
      departmentId: string | null;
      name: string | null;
    }
  | { kind: 'unchanged' };

type Plan = Omit<
  DirectoryImportPreview,
  'separator' | 'lines' | 'columns' | 'missing'
> & {
  changes: Change[];
};

/** Reads the file against the directory: nothing is written. Absent people are kept. */
async function plan(
  tx: AnyDb,
  organizationId: string,
  rows: Row[],
  choices: readonly DepartmentChoice[],
): Promise<Plan> {
  const departments = await tx
    .select({ id: department.id, name: department.name })
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        isNull(department.deletedAt),
      ),
    );
  const people = await tx
    .select()
    .from(directoryPerson)
    .where(
      and(
        eq(directoryPerson.organizationId, organizationId),
        isNull(directoryPerson.deletedAt),
      ),
    );
  const byName = new Map(
    departments.map((row) => [normalizeName(row.name), row]),
  );
  const known = new Set(departments.map((row) => row.id));
  for (const choice of choices) {
    const target = departments.find((row) => row.id === choice.departmentId);
    if (target && known.has(target.id)) {
      byName.set(normalizeName(choice.name), target);
    }
  }
  const byEmail = new Map<string, Existing[]>();
  for (const person of people) {
    const key = person.email.toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), person]);
  }

  const seen = new Set<string>();
  const errors: Plan['errors'] = [];
  const unknown = new Map<string, { name: string; lines: number }>();
  const changes: Change[] = [];
  let toAdd = 0;
  let toUpdate = 0;
  let toMove = 0;
  let unchanged = 0;

  for (const row of rows) {
    const refuse = (problem: DirectoryImportProblem) =>
      errors.push({
        line: row.line,
        name: fullName(row),
        email: row.email,
        department: row.department,
        problem,
      });
    if (!row.lastName && !row.firstName) {
      refuse('name-missing');
      continue;
    }
    if (!isEmail(row.email)) {
      refuse('email-invalid');
      continue;
    }
    if (seen.has(row.email)) {
      refuse('duplicate-in-file');
      continue;
    }
    seen.add(row.email);
    const target = row.department
      ? byName.get(normalizeName(row.department))
      : undefined;
    if (row.department && !target) {
      const key = normalizeName(row.department);
      const entry = unknown.get(key) ?? { name: row.department, lines: 0 };
      unknown.set(key, { ...entry, lines: entry.lines + 1 });
      refuse('department-unknown');
      continue;
    }
    // Two departments may hold one address: the line names which, or nothing can be told.
    const cards = byEmail.get(row.email) ?? [];
    const person =
      cards.find((card) => target && card.departmentId === target.id) ??
      (cards.length === 1 ? cards[0] : undefined);
    if (cards.length > 1 && !person) {
      refuse('email-ambiguous');
      continue;
    }
    if (!person) {
      // A card needs both: the form could not edit one without them.
      if (!row.firstName || !row.lastName) {
        refuse('name-missing');
        continue;
      }
      toAdd += 1;
      changes.push({
        kind: 'add',
        row,
        departmentId: target?.id ?? null,
        name: target?.name ?? null,
      });
      continue;
    }
    // An empty cell says nothing: it erases no name, and takes nobody out of their department.
    // The same name written whole keeps its split: « Jean Pierre » stays one first name.
    const sameName = fullName(row) === fullName(person);
    const firstName = sameName
      ? person.firstName
      : row.firstName || person.firstName;
    const lastName = sameName
      ? person.lastName
      : row.lastName || person.lastName;
    const same =
      person.active &&
      person.firstName === firstName &&
      person.lastName === lastName &&
      (!target || person.departmentId === target.id) &&
      (!row.site || person.site === row.site);
    if (same) {
      unchanged += 1;
      changes.push({ kind: 'unchanged' });
      continue;
    }
    toUpdate += 1;
    if (target && person.departmentId !== target.id) toMove += 1;
    changes.push({
      kind: 'update',
      row,
      firstName,
      lastName,
      person,
      departmentId: target?.id ?? person.departmentId,
      name: target?.name ?? person.department,
    });
  }
  return {
    toAdd,
    toUpdate,
    toMove,
    unchanged,
    errors,
    unknownDepartments: [...unknown.values()],
    changes,
  };
}

export async function previewDirectoryImport(
  db: AnyDb,
  organizationId: string,
  csv: string,
  choices: readonly DepartmentChoice[],
): Promise<DirectoryImportPreview> {
  const { rows, ...file } = parse(csv);
  if (file.missing.length) {
    return {
      ...file,
      toAdd: 0,
      toUpdate: 0,
      toMove: 0,
      unchanged: 0,
      errors: [],
      unknownDepartments: [],
    };
  }
  const { changes: _changes, ...result } = await plan(
    db,
    organizationId,
    rows,
    choices,
  );
  void _changes;
  return { ...file, ...result };
}

/**
 * Applies the file in one transaction; lines in error are left out. A person
 * whose department changes moves like any other, by the trigger of drizzle/0021.
 */
export async function applyDirectoryImport(
  db: AnyDb,
  organizationId: string,
  csv: string,
  choices: readonly DepartmentChoice[],
): Promise<DirectoryImportReport> {
  const { rows, missing } = parse(csv);
  if (missing.length) {
    return { added: 0, updated: 0, unchanged: 0, ignored: rows.length };
  }
  return db.transaction(async (tx) => {
    const { changes, toAdd, toUpdate, unchanged, errors } = await plan(
      tx,
      organizationId,
      rows,
      choices,
    );
    const now = new Date();
    const additions = changes.flatMap((change) =>
      change.kind === 'add'
        ? [
            {
              id: newId(),
              organizationId,
              firstName: change.row.firstName,
              lastName: change.row.lastName,
              nameNorm: normalizeName(fullName(change.row)),
              email: change.row.email,
              department: change.name,
              departmentId: change.departmentId,
              site: change.row.site || null,
            },
          ]
        : [],
    );
    for (let at = 0; at < additions.length; at += CHUNK) {
      await tx.insert(directoryPerson).values(additions.slice(at, at + CHUNK));
    }
    for (const change of changes) {
      if (change.kind !== 'update') continue;
      const { row, person, firstName, lastName } = change;
      await tx
        .update(directoryPerson)
        .set({
          firstName,
          lastName,
          nameNorm: normalizeName(`${firstName} ${lastName}`),
          department: change.name,
          departmentId: change.departmentId,
          site: row.site || person.site,
          active: true,
          updatedAt: now,
        })
        .where(
          and(
            eq(directoryPerson.organizationId, organizationId),
            eq(directoryPerson.id, person.id),
          ),
        );
    }
    return {
      added: toAdd,
      updated: toUpdate,
      unchanged,
      ignored: errors.length,
    };
  });
}

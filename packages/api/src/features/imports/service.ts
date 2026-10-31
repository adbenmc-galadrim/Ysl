import { createHash } from 'node:crypto';
import type { AnyDb } from '@repo/db';
import { contact, directoryPerson, event, parcel } from '@repo/db/schema';
import { isTrackingFlag, type V1ImportReport } from '@repo/contract/imports';
import { eventColumns, PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import { newId } from '@repo/shared/id';
import type { TranslateFn } from '@repo/shared/i18n';
import { normalizeName } from '@repo/shared/text';
import { TRPCError } from '@trpc/server';
import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import {
  readV1File,
  sameParcelKey,
  type V1Row,
} from '#features/imports/v1-rows';

const CHUNK = 500;

type Importer = { organizationId: string; userId: string };

type Recipient = { personId: string } | { contactId: string };

/**
 * The id of the parcel a v1 row becomes, the same at every import of the
 * file: a UUID v7 whose time is the reception and whose rest is a digest of
 * the mailroom and the row, so importing again finds it even when the
 * tracking has been corrected since.
 */
export function importedParcelId(organizationId: string, row: V1Row): string {
  const digest = createHash('sha256')
    .update(
      [
        organizationId,
        'v1',
        row.sourceId,
        row.trackingNorm,
        row.receivedAt.toISOString(),
      ].join('|'),
    )
    .digest();
  const bytes = Buffer.alloc(16);
  bytes.writeUIntBE(Math.max(0, row.receivedAt.getTime()), 0, 6);
  digest.copy(bytes, 6, 0, 10);
  bytes[6] = 0x70 | (bytes[6]! & 0x0f);
  bytes[8] = 0x80 | (bytes[8]! & 0x3f);
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const chunks = <T>(items: T[]) =>
  Array.from({ length: Math.ceil(items.length / CHUNK) }, (_, i) =>
    items.slice(i * CHUNK, (i + 1) * CHUNK),
  );

/**
 * Finds the recipient of each row the way an agent would (F27): a person of
 * the directory by e-mail, else a contact by e-mail, else a contact without
 * e-mail by name; creates the contact that is missing, once per e-mail.
 */
async function recipients(
  tx: AnyDb,
  importer: Importer,
  rows: V1Row[],
  now: Date,
) {
  const org = importer.organizationId;
  const people = await tx
    .select({ id: directoryPerson.id, email: directoryPerson.email })
    .from(directoryPerson)
    .where(
      and(
        eq(directoryPerson.organizationId, org),
        eq(directoryPerson.active, true),
        isNull(directoryPerson.deletedAt),
      ),
    );
  const contacts = await tx
    .select({
      id: contact.id,
      email: contact.email,
      nameNorm: contact.nameNorm,
    })
    .from(contact)
    .where(and(eq(contact.organizationId, org), isNull(contact.deletedAt)));

  const personByEmail = new Map(
    people.map((person) => [person.email.toLowerCase(), person.id]),
  );
  // An address two departments hold says nobody: a contact keeps it, unattributed.
  const held = new Set<string>();
  for (const { email } of people) {
    const key = email.toLowerCase();
    if (held.has(key)) personByEmail.delete(key);
    held.add(key);
  }
  const contactByEmail = new Map<string, string>();
  const contactByName = new Map<string, string>();
  for (const known of contacts) {
    if (known.email) contactByEmail.set(known.email.toLowerCase(), known.id);
    else contactByName.set(known.nameNorm, known.id);
  }

  const created: (typeof contact.$inferInsert)[] = [];
  const uses = new Map<string, { count: number; last: Date }>();
  const byLine = new Map<number, Recipient>();

  for (const row of rows) {
    const email = row.email?.toLowerCase();
    const name = row.recipient ?? row.email ?? '';
    const nameNorm = normalizeName(name);
    if (!email && !nameNorm) continue;
    const personId = email ? personByEmail.get(email) : undefined;
    if (personId) {
      byLine.set(row.line, { personId });
      continue;
    }
    let contactId = email
      ? contactByEmail.get(email)
      : contactByName.get(nameNorm);
    if (!contactId) {
      contactId = newId();
      created.push({
        id: contactId,
        organizationId: org,
        name,
        nameNorm,
        email: row.email,
        createdBy: importer.userId,
        createdAt: now,
        updatedAt: now,
      });
      if (email) contactByEmail.set(email, contactId);
      else contactByName.set(nameNorm, contactId);
    }
    byLine.set(row.line, { contactId });
    const use = uses.get(contactId);
    uses.set(contactId, {
      count: (use?.count ?? 0) + 1,
      last: use && use.last > row.receivedAt ? use.last : row.receivedAt,
    });
  }

  for (const row of created) {
    const use = uses.get(row.id);
    row.usageCount = use?.count ?? 0;
    row.lastUsedAt = use?.last ?? null;
    uses.delete(row.id);
  }

  return { byLine, created, uses };
}

/**
 * `imports.v1Csv` (F52): the v1 history into the mailroom's parcels, in one
 * transaction; the iPhones get them at their next pull. Importing the same
 * file again adds nothing.
 */
export async function importV1Csv(
  db: AnyDb,
  importer: Importer,
  csv: string,
  t: TranslateFn,
): Promise<V1ImportReport> {
  const file = readV1File(csv, t);
  if (!file.ok) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: t('import.v1.error.notV1'),
    });
  }
  const org = importer.organizationId;
  const skips = [...file.skips];

  return db.transaction(async (tx) => {
    // One import at a time per mailroom: two at once would both create the
    // same contacts, which carry no unique e-mail index.
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`imports.v1:${org}`}))`,
    );
    const ids = new Map(
      file.rows.map((row) => [row.line, importedParcelId(org, row)]),
    );
    const existingIds = new Set<string>();
    const existingKeys = new Set<string>();
    for (const part of chunks(file.rows)) {
      const found = await tx
        .select({
          id: parcel.id,
          trackingNorm: parcel.trackingNorm,
          receivedAt: parcel.receivedAt,
        })
        .from(parcel)
        .where(
          and(
            eq(parcel.organizationId, org),
            sql`(${inArray(
              parcel.id,
              part.map((row) => ids.get(row.line)!),
            )} or ${inArray(
              parcel.trackingNorm,
              part.map((row) => row.trackingNorm),
            )})`,
          ),
        );
      for (const row of found) {
        existingIds.add(row.id);
        if (row.trackingNorm) {
          existingKeys.add(sameParcelKey(row.trackingNorm, row.receivedAt));
        }
      }
    }

    const fresh = file.rows.filter((row) => {
      const present =
        existingIds.has(ids.get(row.line)!) ||
        existingKeys.has(sameParcelKey(row.trackingNorm, row.receivedAt));
      if (present) {
        skips.push({
          line: row.line,
          tracking: row.tracking,
          recipient: row.recipient,
          reason: 'already-present',
        });
      }
      return !present;
    });

    const now = new Date();
    const found = await recipients(tx, importer, fresh, now);
    for (const part of chunks(found.created)) {
      await tx.insert(contact).values(part);
    }

    const doubtful = t('import.v1.note.tracking');
    const values = fresh.map((row): typeof parcel.$inferInsert => {
      const recipient = found.byLine.get(row.line);
      const flagged = row.flags.some(isTrackingFlag);
      return {
        id: ids.get(row.line)!,
        organizationId: org,
        status: row.status,
        carrier: row.carrier,
        tracking: row.tracking,
        trackingNorm: row.trackingNorm,
        ...recipient,
        readName: row.recipient,
        department: row.department,
        senderName: row.sender,
        pieceN: row.pieces,
        pieceTotal: row.pieces,
        notes: flagged
          ? [doubtful, row.notes].filter(Boolean).join('\n')
          : row.notes,
        receivedAt: row.receivedAt,
        receivedBy: importer.userId,
        deliveredAt: row.deliveredAt,
        deliveredBy: row.deliveredAt ? importer.userId : null,
        createdAt: now,
        updatedAt: now,
      };
    });
    const inserted = new Set<string>();
    for (const part of chunks(values)) {
      const rows = await tx
        .insert(parcel)
        .values(part)
        .onConflictDoNothing({ target: parcel.id })
        .returning({ id: parcel.id });
      for (const row of rows) inserted.add(row.id);
    }

    const imported = fresh.filter((row) => inserted.has(ids.get(row.line)!));
    const events = imported.map((row): typeof event.$inferInsert => ({
      id: newId(),
      organizationId: org,
      entity: PARCEL_EVENT_ENTITY,
      entityId: ids.get(row.line)!,
      ...eventColumns({ type: 'parcel.imported', flags: row.flags }),
      actorId: importer.userId,
      at: now,
    }));
    for (const part of chunks(events)) {
      await tx.insert(event).values(part);
    }

    for (const [contactId, use] of found.uses) {
      await tx
        .update(contact)
        .set({
          usageCount: sql`${contact.usageCount} + ${use.count}`,
          lastUsedAt: sql`greatest(${contact.lastUsedAt}, ${use.last.toISOString()}::timestamptz)`,
          updatedAt: now,
        })
        .where(and(eq(contact.organizationId, org), eq(contact.id, contactId)));
    }

    return {
      imported: imported.length,
      skipped: skips.length,
      contactsCreated: found.created.length,
      flagged: imported
        .filter((row) => row.flags.length > 0)
        .map((row) => ({
          line: row.line,
          tracking: row.tracking,
          recipient: row.recipient,
          carrier: row.carrier,
          flags: row.flags,
          ...(row.unknownStatus === undefined
            ? {}
            : { status: row.unknownStatus }),
        })),
      skips: skips.sort((a, b) => a.line - b.line),
    };
  });
}

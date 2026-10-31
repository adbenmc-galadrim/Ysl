import { eventColumns, PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import {
  gapOfReceived,
  parcelsToSettle,
  type ConfirmDepositInput,
  type SettleParcelInput,
} from '@repo/contract/deposits';
import {
  depositedStatus,
  statusPatch,
  type ParcelStatus,
} from '@repo/contract/parcel-status';
import type { AnyDb } from '@repo/db';
import {
  contact,
  department,
  deposit,
  directoryPerson,
  event,
  organizationMember,
  parcel,
  user,
} from '@repo/db/schema';
import {
  createTranslator,
  DEFAULT_LOCALE,
  type TranslationKey,
} from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { TRPCError } from '@trpc/server';
import {
  and,
  arrayContains,
  asc,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  sql,
} from 'drizzle-orm';
import { parcelCarrier } from '#lib/access';

const translate = createTranslator(DEFAULT_LOCALE);

const refused = (
  code: 'NOT_FOUND' | 'CONFLICT' | 'BAD_REQUEST',
  key: Extract<TranslationKey, `deposit.error.${string}`>,
) => new TRPCError({ code, message: translate(key) });

type Actor = { organizationId: string; userId: string; name: string | null };
type ParcelRow = typeof parcel.$inferSelect;

/** A change of status, its counter and its line in the history, as a device would write them. */
async function moveParcel(
  tx: AnyDb,
  row: ParcelRow,
  to: ParcelStatus,
  { organizationId, userId }: Actor,
  now: Date,
  more: Partial<typeof parcel.$inferInsert> = {},
): Promise<void> {
  await tx
    .update(parcel)
    .set({
      ...statusPatch(row, to, { now, agentId: userId }),
      updatedAt: now,
      ...more,
    })
    .where(eq(parcel.id, row.id));
  await tx.insert(event).values({
    id: newId(),
    organizationId,
    entity: PARCEL_EVENT_ENTITY,
    entityId: row.id,
    actorId: userId,
    at: now,
    ...eventColumns({ type: 'parcel.status', from: row.status, to }),
  });
}

/**
 * The department's word on a deposit (D24), in one transaction: every parcel
 * still on its way there is deposited or waits « À régulariser ». The only way
 * out of `en_route` to a deposit (`depositedStatus`): a device never writes it.
 */
export async function confirmDeposit(
  tx: AnyDb,
  actor: Actor,
  departmentId: string | null,
  input: Omit<ConfirmDepositInput, 'received'> & {
    received?: ConfirmDepositInput['received'];
  },
  {
    now = new Date(),
    each = false,
    asAnnounced = false,
  }: {
    now?: Date;
    /** The profile asks parcel by parcel: `received` is required. */
    each?: boolean;
    /** No department counts: every parcel still on its way is taken as there. */
    asAnnounced?: boolean;
  } = {},
): Promise<{ deposited: number; toSettle: number }> {
  const [row] = await tx
    .select()
    .from(deposit)
    .where(
      and(
        eq(deposit.organizationId, actor.organizationId),
        eq(deposit.id, input.depositId),
        isNull(deposit.deletedAt),
      ),
    )
    .for('update');
  if (!row || (departmentId !== null && row.departmentId !== departmentId)) {
    throw refused('NOT_FOUND', 'deposit.error.notFound');
  }
  if (row.confirmedAt) throw refused('CONFLICT', 'deposit.error.confirmed');

  // Moved since the shuttle put them down, or entrusted to another: no longer this deposit's.
  const live = await tx
    .select()
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, actor.organizationId),
        inArray(parcel.id, row.parcelIds),
        eq(parcel.departmentId, row.departmentId),
        eq(parcel.status, 'en_route'),
        isNull(parcel.deletedAt),
        sql`${parcelCarrier} = ${row.shuttleId}`,
      ),
    )
    .for('update');

  const liveIds = live.map(({ id }) => id);
  if (each && !input.received) {
    throw refused('BAD_REQUEST', 'deposit.error.each');
  }
  const gap =
    each && input.received
      ? gapOfReceived(liveIds, input.received, input.gap)
      : input.gap;
  const counted = asAnnounced ? live.length : input.counted;
  if (
    (!gap && counted !== live.length) ||
    (gap?.kind === 'extra' && counted <= live.length)
  ) {
    throw refused('BAD_REQUEST', 'deposit.error.count');
  }
  const settled = new Set(parcelsToSettle(liveIds, gap));
  for (const one of live) {
    if (!settled.has(one.id)) {
      await moveParcel(tx, one, depositedStatus(one), actor, now);
    } else {
      // Gone, the employee: the parcel itself is there, in the department's hands.
      await moveParcel(
        tx,
        one,
        'a_regulariser',
        actor,
        now,
        gap?.kind === 'left' ? { depositedAt: now } : {},
      );
    }
  }
  await tx
    .update(deposit)
    .set({
      counted,
      gap: gap?.kind ?? null,
      gapParcelIds: gap ? [...settled] : null,
      confirmedAt: now,
      confirmedBy: actor.userId,
      confirmedByName: actor.name,
      updatedAt: now,
    })
    .where(eq(deposit.id, row.id));
  return { deposited: live.length - settled.size, toSettle: settled.size };
}

async function openDepartment(
  tx: AnyDb,
  organizationId: string,
  id: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: department.id })
    .from(department)
    .where(
      and(
        eq(department.organizationId, organizationId),
        eq(department.id, id),
        isNull(department.deletedAt),
      ),
    );
  if (!row) throw refused('BAD_REQUEST', 'deposit.error.department');
}

/**
 * The department changes: the e-mail traced named the old one, so the deposit
 * tells again (ME29, as for a person who moves).
 */
async function sendTo(
  tx: AnyDb,
  row: ParcelRow,
  departmentId: string,
  actor: Actor,
  now: Date,
  more: Partial<typeof parcel.$inferInsert> = {},
): Promise<void> {
  const moved = row.departmentId !== departmentId;
  const notice = moved ? { lastNotifiedAt: null } : {};
  if (row.status === 'a_regulariser') {
    await moveParcel(tx, { ...row, departmentId }, 'en_route', actor, now, {
      departmentId,
      ...notice,
      ...more,
    });
    return;
  }
  await tx
    .update(parcel)
    .set({ departmentId, updatedAt: now, ...more })
    .where(eq(parcel.id, row.id));
}

/** What the company admin decides for a parcel in the way (§3.7.9: the admin alone). */
export async function settleParcel(
  tx: AnyDb,
  actor: Actor,
  input: SettleParcelInput,
  now = new Date(),
): Promise<void> {
  const { organizationId } = actor;
  const [row] = await tx
    .select()
    .from(parcel)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        eq(parcel.id, input.parcelId),
        isNull(parcel.deletedAt),
      ),
    )
    .for('update');
  if (!row) throw refused('NOT_FOUND', 'deposit.error.parcelGone');
  const blocked = row.status === 'a_regulariser';
  const placeless =
    row.departmentId === null &&
    (['a_completer', 'recu', 'notifie'] as const).some(
      (status) => status === row.status,
    );
  if (!blocked && !placeless) {
    throw refused('CONFLICT', 'deposit.error.settled');
  }

  switch (input.action) {
    case 'redeposit': {
      if (!blocked || !row.departmentId) {
        throw refused('BAD_REQUEST', 'deposit.error.department');
      }
      await moveParcel(tx, row, 'en_route', actor, now);
      return;
    }
    case 'return':
    case 'lost': {
      if (!blocked) throw refused('CONFLICT', 'deposit.error.settled');
      const note = translate('deposit.lost.note');
      await moveParcel(
        tx,
        row,
        'retourne',
        actor,
        now,
        input.action === 'lost'
          ? { notes: row.notes ? `${row.notes}\n${note}` : note }
          : {},
      );
      return;
    }
    case 'department': {
      await openDepartment(tx, organizationId, input.departmentId);
      const [person] = row.personId
        ? await tx
            .select({ departmentId: directoryPerson.departmentId })
            .from(directoryPerson)
            .where(
              and(
                eq(directoryPerson.organizationId, organizationId),
                eq(directoryPerson.id, row.personId),
              ),
            )
        : [];
      // A parcel follows its person: only their card, or another person, moves it.
      if (person?.departmentId) {
        throw refused('BAD_REQUEST', 'deposit.error.followsPerson');
      }
      if (person && row.personId) {
        await tx
          .update(directoryPerson)
          .set({ departmentId: input.departmentId, updatedAt: now })
          .where(eq(directoryPerson.id, row.personId));
      }
      await sendTo(tx, row, input.departmentId, actor, now);
      return;
    }
    case 'person': {
      const [person] = await tx
        .select({
          departmentId: directoryPerson.departmentId,
          email: directoryPerson.email,
        })
        .from(directoryPerson)
        .where(
          and(
            eq(directoryPerson.organizationId, organizationId),
            eq(directoryPerson.id, input.personId),
            isNull(directoryPerson.deletedAt),
          ),
        );
      if (!person?.departmentId) {
        throw refused('BAD_REQUEST', 'deposit.error.department');
      }
      await openDepartment(tx, organizationId, person.departmentId);
      await sendTo(tx, row, person.departmentId, actor, now, {
        personId: input.personId,
        contactId: null,
        notificationEmail: person.email,
      });
      return;
    }
  }
}

/**
 * The parcels of a shuttle away, to another (§3.7.9: the admin alone). Its own
 * phone is told they left at its next pull; a deposit it announced loses them.
 */
export async function entrustParcels(
  tx: AnyDb,
  { organizationId }: Actor,
  parcelIds: readonly string[],
  shuttleId: string,
  now = new Date(),
): Promise<number> {
  const [shuttle] = await tx
    .select({ id: user.id })
    .from(organizationMember)
    .innerJoin(user, eq(user.id, organizationMember.userId))
    .where(
      and(
        eq(organizationMember.organizationId, organizationId),
        eq(user.id, shuttleId),
        eq(user.role, 'shuttle'),
        sql`coalesce(${user.banned}, false) = false`,
      ),
    );
  if (!shuttle) throw refused('BAD_REQUEST', 'deposit.error.shuttle');
  const moved = await tx
    .update(parcel)
    .set({
      formerShuttleIds: sql`array_append(${parcel.formerShuttleIds}, ${parcelCarrier})`,
      tourShuttleId: shuttleId,
      updatedAt: now,
    })
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        inArray(parcel.id, [...parcelIds]),
        isNull(parcel.deletedAt),
        inArray(parcel.status, [
          'a_completer',
          'recu',
          'en_route',
          'a_regulariser',
        ]),
        sql`${parcelCarrier} <> ${shuttleId}`,
      ),
    )
    .returning({ id: parcel.id });
  for (const { id } of moved) {
    await tx
      .update(deposit)
      .set({
        parcelIds: sql`array_remove(${deposit.parcelIds}, ${id}::uuid)`,
        announced: sql`${deposit.announced} - 1`,
        deletedAt: sql`case when cardinality(${deposit.parcelIds}) = 1 then ${now.toISOString()}::timestamptz end`,
        updatedAt: now,
      })
      .where(
        and(
          eq(deposit.organizationId, organizationId),
          isNull(deposit.confirmedAt),
          isNull(deposit.deletedAt),
          arrayContains(deposit.parcelIds, [id]),
        ),
      );
  }
  return moved.length;
}

const OPEN_WITHOUT_PLACE = ['a_completer', 'recu', 'notifie'] as const;

/** The admin's page: what waits for a decision, read on the server, the carrier included. */
export async function settlementOf(db: AnyDb, organizationId: string) {
  const rows = await db
    .select({
      id: parcel.id,
      status: parcel.status,
      departmentId: parcel.departmentId,
      personId: parcel.personId,
      firstName: directoryPerson.firstName,
      lastName: directoryPerson.lastName,
      contactName: contact.name,
      readName: parcel.readName,
      carrier: parcel.carrier,
      tracking: parcel.tracking,
      carrierId: parcelCarrier,
      carrierName: user.name,
      since: parcel.updatedAt,
    })
    .from(parcel)
    .leftJoin(directoryPerson, eq(directoryPerson.id, parcel.personId))
    .leftJoin(contact, eq(contact.id, parcel.contactId))
    .leftJoin(user, sql`${user.id} = ${parcelCarrier}`)
    .where(
      and(
        eq(parcel.organizationId, organizationId),
        isNull(parcel.deletedAt),
        sql`(${parcel.status} in ('a_regulariser', 'en_route')
             or (${parcel.departmentId} is null and ${inArray(parcel.status, [...OPEN_WITHOUT_PLACE])}))`,
      ),
    )
    .orderBy(asc(parcel.updatedAt));
  const gaps = await db
    .select()
    .from(deposit)
    .where(
      and(
        eq(deposit.organizationId, organizationId),
        isNotNull(deposit.gap),
        isNull(deposit.deletedAt),
      ),
    )
    .orderBy(desc(deposit.confirmedAt));
  const [departments, shuttles] = await Promise.all([
    db
      .select({ id: department.id, name: department.name })
      .from(department)
      .where(
        and(
          eq(department.organizationId, organizationId),
          isNull(department.deletedAt),
        ),
      )
      .orderBy(asc(department.name)),
    db
      .select({ id: user.id, name: user.name })
      .from(organizationMember)
      .innerJoin(user, eq(user.id, organizationMember.userId))
      .where(
        and(
          eq(organizationMember.organizationId, organizationId),
          eq(user.role, 'shuttle'),
          sql`coalesce(${user.banned}, false) = false`,
        ),
      )
      .orderBy(asc(user.name)),
  ]);
  const shown = rows.map(
    ({ firstName, lastName, contactName, readName, ...row }) => {
      const gap = gaps.find(({ gapParcelIds }) =>
        gapParcelIds?.includes(row.id),
      );
      return {
        ...row,
        recipient:
          firstName !== null
            ? `${firstName} ${lastName ?? ''}`.trim()
            : (contactName ?? readName),
        gap: gap
          ? {
              kind: gap.gap,
              counted: gap.counted,
              announced: gap.announced,
              confirmedAt: gap.confirmedAt,
              confirmedByName: gap.confirmedByName,
            }
          : null,
      };
    },
  );
  return {
    toSettle: shown.filter(({ status }) => status === 'a_regulariser'),
    withoutDepartment: shown.filter(
      ({ status, departmentId }) =>
        status !== 'a_regulariser' && status !== 'en_route' && !departmentId,
    ),
    carried: shown.filter(({ status }) => status === 'en_route'),
    extras: gaps.flatMap((row) =>
      row.gap === 'extra' && row.counted !== null && row.confirmedAt
        ? [
            {
              id: row.id,
              departmentId: row.departmentId,
              announced: row.announced,
              counted: row.counted,
              confirmedAt: row.confirmedAt,
              confirmedByName: row.confirmedByName,
            },
          ]
        : [],
    ),
    departments,
    shuttles: shuttles.map((row) => ({ id: row.id, name: row.name })),
  };
}

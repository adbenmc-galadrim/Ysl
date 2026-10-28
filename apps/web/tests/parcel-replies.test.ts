import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { assignRecipient } from '#/features/parcels/complete';
import { toRemiseParcel } from '#/features/handover/waiting';
import { homeState, reminderOf, toParcelRow } from '#/features/parcels/model';
import { describeRecord } from '#/features/parcels/record';
import {
  answeredWith,
  replyAbsent,
  replyColleague,
  replyNotMine,
} from '#/features/replies/record';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const options = { agentId: 'agent-1', now: NOW };
/** Wednesday 21 October 2026: the first reminder falls due on Friday the 23rd. */
const NOTIFIED = new Date(2026, 9, 21, 9);

const hugo = personRow({
  firstName: 'Hugo',
  lastName: 'Lefèvre',
  nameNorm: 'hugo lefevre',
  email: 'hugo@example.com',
  department: 'Accessoires',
});

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
  await db.directoryPerson.put(hugo);
});

const notified = (overrides = {}) =>
  parcelRow({
    status: 'notifie',
    statusSeq: 1,
    personId: hugo.id,
    department: 'Accessoires',
    notificationEmail: 'h.lefevre@example.com',
    readName: 'H. LEFEVRE',
    notifiedAt: NOTIFIED,
    lastNotifiedAt: NOTIFIED,
    ...overrides,
  });

async function history(id: string) {
  const record = await loadParcelRecord(db, id);
  if (!record) throw new Error('missing');
  return describeRecord(record, { now: NOW, t, showUnsent: false });
}

describe('« Ce n’est pas pour moi »', () => {
  it('takes the notice back, the recipient off, and reopens the parcel', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);

    expect(await replyNotMine(db, parcel.id, options)).toBe('recorded');

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'a_completer',
      statusSeq: 3,
      personId: null,
      contactId: null,
      department: null,
      notificationEmail: null,
      notifiedAt: null,
      readName: 'H. LEFEVRE',
      reply: 'not_mine',
      repliedAt: NOW,
    });
    const ops = await db.outbox.orderBy('seq').toArray();
    expect(
      ops.map((op) =>
        op.entity === 'parcel'
          ? `parcel ${String(op.patch.status)} ${String(op.patch.statusSeq)}`
          : `${op.entity} ${String(op.patch.type)}`,
      ),
    ).toEqual([
      'parcel recu 2',
      'event parcel.status',
      'parcel a_completer 3',
      'event parcel.status',
      'event parcel.reply',
    ]);
    expect(ops.at(-1)?.patch).toMatchObject({
      detail: {
        reply: 'not_mine',
        previous: { kind: 'person', id: hugo.id, name: 'Hugo Lefèvre' },
      },
    });
    expect((await history(parcel.id)).history?.[0]?.title).toBe(
      'A répondu : ce n’est pas pour moi',
    );
  });

  it('unlearns the name read for the disowned person, and only that', async () => {
    const wrong = {
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      nameNorm: 'h lefevre',
      personId: hugo.id,
      contactId: null,
      confirmations: 2,
    };
    const other = { ...wrong, id: newId(), nameNorm: 'm petit' };
    await db.recipientAlias.bulkPut([wrong, other]);
    const parcel = notified();
    await db.parcel.put(parcel);

    await replyNotMine(db, parcel.id, options);

    expect(await db.recipientAlias.get(wrong.id)).toMatchObject({
      deletedAt: NOW,
    });
    expect(await db.recipientAlias.get(other.id)).toMatchObject({
      deletedAt: null,
    });
  });

  it('writes nothing for a parcel already answered or never notified', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyNotMine(db, parcel.id, options);
    const before = await db.outbox.count();

    expect(await replyNotMine(db, parcel.id, options)).toBe('unchanged');
    const received = parcelRow({ status: 'recu', personId: hugo.id });
    await db.parcel.put(received);
    expect(await replyNotMine(db, received.id, options)).toBe('unchanged');
    expect(await db.outbox.count()).toBe(before);
  });

  it('is dealt with once someone else is set for the parcel', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyNotMine(db, parcel.id, options);
    const nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
    await db.directoryPerson.put(nora);

    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: nora.id },
      // As « Réattribuer » on Colis: only the name shows there.
      { ...options, seesTracking: false },
    );

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'recu',
      personId: nora.id,
      reply: null,
      repliedAt: null,
    });
  });
});

describe('« Un collègue passe le prendre »', () => {
  it('names the colleague on every notified parcel of the recipient', async () => {
    const first = notified();
    const second = notified({ receivedAt: new Date(NOW.getTime() + 1) });
    const waiting = parcelRow({ status: 'recu', personId: hugo.id });
    await db.parcel.bulkPut([first, second, waiting]);
    const ids = (await answeredWith(db, first.id)).map(({ id }) => id);
    expect(ids).toEqual([first.id, second.id]);

    await replyColleague(db, ids, '  Paul   Mercier ', options);

    for (const id of ids) {
      expect(await db.parcel.get(id)).toMatchObject({
        status: 'notifie',
        personId: hugo.id,
        reply: 'colleague',
        expectedDelegate: 'Paul Mercier',
      });
    }
    expect((await db.parcel.get(waiting.id))?.expectedDelegate).toBeNull();
    const shown = await history(first.id);
    expect(shown.history?.[0]?.title).toBe(
      'A répondu : Paul Mercier passera le prendre',
    );
    expect(shown.details).toContainEqual({
      label: 'Retrait prévu par',
      value: 'Paul Mercier',
    });
  });

  it('writes nothing when the same colleague is named again', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyColleague(db, [parcel.id], 'Paul Mercier', options);
    const before = await db.outbox.count();

    expect(
      await replyColleague(db, [parcel.id], 'Paul  Mercier', options),
    ).toBe('unchanged');
    expect(await db.outbox.count()).toBe(before);
    await expect(
      replyColleague(db, [parcel.id], '   ', options),
    ).rejects.toThrow();
  });
});

describe('« Absence jusqu’au … »', () => {
  it('holds the reminders back until the working day after', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    // Saturday the 24th: the first reminder fell due on Friday.
    expect(reminderOf(parcel, NOW)?.due).toBe(true);

    await replyAbsent(db, [parcel.id], new Date(2026, 9, 30, 18), options);

    const away = (await db.parcel.get(parcel.id))!;
    expect(away).toMatchObject({
      reply: 'absent',
      remindersPausedUntil: new Date(2026, 9, 30),
    });
    expect(reminderOf(away, NOW)).toMatchObject({ due: false, late: false });
    expect(homeState(away, new Date(2026, 9, 29, 9))).toBe('notified');
    const back = new Date(2026, 10, 2, 9);
    expect(reminderOf(away, back)).toMatchObject({ due: true, late: false });
    const shown = await history(parcel.id);
    expect(shown.history?.[0]?.title).toBe(
      'A répondu : absence jusqu’au 30 oct.',
    );
    expect(shown.details).toContainEqual({
      label: 'Absence jusqu’au',
      value: '30 oct.',
    });
  });

  it('keeps saying the absence once a colleague is named after it', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyAbsent(db, [parcel.id], new Date(2026, 9, 30), options);
    await replyColleague(db, [parcel.id], 'Paul Mercier', options);

    const shown = await history(parcel.id);
    expect(shown.details).toEqual(
      expect.arrayContaining([
        { label: 'Retrait prévu par', value: 'Paul Mercier' },
        { label: 'Absence jusqu’au', value: '30 oct.' },
      ]),
    );
    expect(reminderOf((await db.parcel.get(parcel.id))!, NOW)?.due).toBe(false);
  });

  it('refuses a day already gone, and writes nothing for the same day twice', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await expect(
      replyAbsent(db, [parcel.id], new Date(2026, 9, 23), options),
    ).rejects.toThrow();
    await replyAbsent(db, [parcel.id], new Date(2026, 9, 30), options);
    const before = await db.outbox.count();
    expect(
      await replyAbsent(db, [parcel.id], new Date(2026, 9, 30, 15), options),
    ).toBe('unchanged');
    expect(await db.outbox.count()).toBe(before);
  });
});

describe('the answer on the lists', () => {
  const context = () => ({
    people: new Map([[hugo.id, hugo]]),
    contacts: new Map(),
  });

  it('heads a disowned parcel with the name read and says when', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyNotMine(db, parcel.id, options);
    const later = new Date(NOW.getTime() + 10 * 60_000);

    const row = toParcelRow(
      (await db.parcel.get(parcel.id))!,
      context(),
      later,
      t,
    );

    expect(row).toMatchObject({
      recipient: 'H. LEFEVRE',
      state: 'incomplete',
      note: undefined,
      reply: {
        kind: 'notMine',
        text: '« Ce n’est pas pour moi », il y a 10 min',
      },
    });
  });

  it('says who comes on the row and at the handover', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyColleague(db, [parcel.id], 'Paul Mercier', options);
    const saved = (await db.parcel.get(parcel.id))!;

    expect(toParcelRow(saved, context(), NOW, t)?.reply).toEqual({
      kind: 'delegated',
      text: 'Paul Mercier passera à sa place',
    });
    expect(toRemiseParcel(saved, NOW, t).received).toMatch(
      /^Retrait prévu par Paul Mercier · reçu /,
    );
    // An absence said afterwards: the colleague still comes.
    await replyAbsent(db, [parcel.id], new Date(2026, 9, 30), options);
    expect(
      toRemiseParcel((await db.parcel.get(parcel.id))!, NOW, t).received,
    ).toMatch(/^Retrait prévu par Paul Mercier · /);
  });

  it('leaves a parcel in distress in its section, said as such', async () => {
    const old = new Date(2026, 9, 12, 9);
    const parcel = notified({ notifiedAt: old, lastNotifiedAt: old });
    await db.parcel.put(parcel);
    await replyColleague(db, [parcel.id], 'Paul Mercier', options);

    const row = toParcelRow(
      (await db.parcel.get(parcel.id))!,
      context(),
      NOW,
      t,
    );

    expect(row).toMatchObject({ state: 'late', reply: undefined });
  });

  it('says until when the recipient is away, then nothing once back', async () => {
    const parcel = notified();
    await db.parcel.put(parcel);
    await replyAbsent(db, [parcel.id], new Date(2026, 9, 30), options);
    const saved = (await db.parcel.get(parcel.id))!;

    expect(toParcelRow(saved, context(), NOW, t)?.reply).toEqual({
      kind: 'absent',
      text: 'Absence jusqu’au 30 oct.',
    });
    expect(
      toParcelRow(saved, context(), new Date(2026, 10, 2, 9), t)?.reply,
    ).toBeUndefined();
  });
});

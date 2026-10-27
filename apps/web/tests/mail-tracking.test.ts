import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import {
  markFailed,
  markOpened,
  markSent,
  prepareNotification,
} from '#/features/mail/notifications';
import { pinHash } from '#/features/mail/pickup-code';
import {
  countMails,
  filterMails,
  lastMailFailed,
  mailStatusLine,
  mailSummary,
  STALE_OPEN_MS,
  staleMails,
  trackMails,
} from '#/features/mail/tracking';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const options = { userId: 'agent-1', now: NOW };
const personId = '0199f000-0000-7000-8000-0000000000aa';
const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

function prepare(
  parcels: LocalParcel[],
  {
    now = NOW,
    userId = 'agent-1',
    pin,
  }: { now?: Date; userId?: string; pin?: string } = {},
) {
  return prepareNotification(
    db,
    {
      type: 'avis',
      personId,
      recipients: ['nora.haddad@example.com'],
      parcelIds: parcels.map(({ id }) => id),
      templateId: null,
      target: 'mailto',
      pickupPin: pin,
    },
    { userId, now },
  );
}

async function tracked(userId = 'agent-1') {
  const parcels = new Map(
    (await db.parcel.toArray()).map((parcel) => [parcel.id, parcel]),
  );
  return trackMails(await db.notification.toArray(), { userId, parcels });
}

describe('the sending log', () => {
  it('sorts the agent’s mails by what they wait for', async () => {
    const [a, b, c, d] = [0, 1, 2, 3].map(() => parcelRow({ personId }));
    await db.parcel.bulkPut([a!, b!, c!, d!]);
    const opened = await prepare([a!], { now: minutes(1) });
    await markOpened(db, opened.id, { now: minutes(1) });
    const failed = await prepare([b!], { now: minutes(2) });
    await markFailed(db, failed.id, 'Non envoyé', { now: minutes(2) });
    const sent = await prepare([c!], { now: minutes(3) });
    await markSent(db, sent.id, { ...options, now: minutes(3) });
    await prepare([d!], { userId: 'agent-2' });

    const mails = await tracked();

    expect(mails.map((mail) => mail.notification.id)).toEqual([
      sent.id,
      failed.id,
      opened.id,
    ]);
    expect(
      filterMails(mails, 'toConfirm').map((m) => m.notification.id),
    ).toEqual([opened.id]);
    expect(filterMails(mails, 'failed').map((m) => m.notification.id)).toEqual([
      failed.id,
    ]);
    expect(filterMails(mails, 'sent').map((m) => m.notification.id)).toEqual([
      sent.id,
    ]);
    expect(
      filterMails(mails, 'all', b!.id).map((m) => m.notification.id),
    ).toEqual([failed.id]);
    expect(countMails(mails)).toEqual({ toConfirm: 1, failed: 1 });
  });

  it('confirms late: the parcels become notified, dated at the confirmation', async () => {
    const parcel = parcelRow({ personId });
    await db.parcel.put(parcel);
    const mail = await prepare([parcel]);
    await markOpened(db, mail.id, { now: NOW });
    const later = minutes(45);

    await markSent(db, mail.id, { userId: 'agent-1', now: later });

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'notifie',
      notifiedAt: later,
    });
    const [event] = await db.event.toArray();
    expect(event).toMatchObject({ type: 'parcel.notified', at: later });
    expect(countMails(await tracked())).toEqual({ toConfirm: 0, failed: 0 });
  });

  it('leaves the parcels to notify when the mail failed, and says so', async () => {
    const parcel = parcelRow({ personId });
    const other = parcelRow({ personId });
    await db.parcel.bulkPut([parcel, other]);
    const mail = await prepare([parcel]);
    await markFailed(db, mail.id, 'Non envoyé', options);

    expect((await db.parcel.get(parcel.id))?.status).toBe('recu');
    expect(lastMailFailed(await db.notification.toArray())).toEqual(
      new Set([parcel.id]),
    );
  });

  it('closes a failure once a later mail resends it, with a new code', async () => {
    const parcel = parcelRow({ personId });
    await db.parcel.put(parcel);
    const first = await prepare([parcel], { pin: '1234' });
    await markFailed(db, first.id, 'Non envoyé', options);

    const again = await prepare([parcel], { now: minutes(5), pin: '5678' });

    const mails = await tracked();
    expect(mails.map((mail) => [mail.notification.id, mail.state])).toEqual([
      [again.id, 'waiting'],
      [first.id, 'closed'],
    ]);
    expect(mailStatusLine(mails[1]!, minutes(6), t)).toBe('Renvoyé à 12 h 05');
    expect(countMails(mails)).toEqual({ toConfirm: 1, failed: 0 });
    expect(lastMailFailed(await db.notification.toArray()).size).toBe(0);
    const open = (await db.pickupCode.toArray()).filter(
      (code) => !code.deletedAt,
    );
    expect(open.map((code) => code.pinHash)).toEqual([await pinHash('5678')]);
  });

  it('closes a failure whose parcels all moved on', async () => {
    const parcel = parcelRow({
      personId,
      status: 'remis',
      deliveredAt: NOW,
      deliveredBy: 'agent-1',
    });
    await db.parcel.put(parcel);
    const mail = await prepare([parcel]);
    await markFailed(db, mail.id, 'Non envoyé', options);

    const [only] = await tracked();
    expect(only?.state).toBe('closed');
    expect(mailStatusLine(only!, NOW, t)).toBe('Colis déjà notifiés ou remis');
  });

  it('reminds only of mails left unanswered for ten minutes', async () => {
    const parcel = parcelRow({ personId });
    await db.parcel.put(parcel);
    const old = await prepare([parcel]);
    await markOpened(db, old.id, { now: NOW });
    await prepare([parcel], { now: minutes(9) });

    const mails = await tracked();
    const stale = staleMails(mails, new Date(NOW.getTime() + STALE_OPEN_MS));
    expect(stale.map((mail) => mail.notification.id)).toEqual([old.id]);
    expect(mailStatusLine(stale[0]!, minutes(11), t)).toBe(
      'Messagerie ouverte à 12 h 00, sans réponse',
    );
  });

  it('names the mail by its parcels', async () => {
    const amazon = parcelRow({ personId, carrier: 'Amazon' });
    const dhl = parcelRow({ personId, carrier: 'DHL' });
    await db.parcel.bulkPut([amazon, dhl]);
    const one = await prepare([amazon]);
    const both = await prepare([amazon, dhl]);
    const parcels = new Map([amazon, dhl].map((p) => [p.id, p]));

    expect(mailSummary(one, parcels, t)).toBe('1 colis Amazon');
    expect(mailSummary(both, parcels, t)).toBe('2 colis');
    expect(mailSummary({ ...one, type: 'relance' }, parcels, t)).toBe(
      'Relance, 1 colis Amazon',
    );
  });
});

import 'fake-indexeddb/auto';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { requestBatchMails } from '#/features/batch/summary';
import {
  SYNC_STATE_KEYS,
  type CourrierDatabase,
  type LocalNotification,
} from '#/features/db/schema';
import { markSent, prepareNotification } from '#/features/mail/notifications';
import { loadPendingMails } from '#/features/mail/pending-mails';
import {
  loadReminderMails,
  reminderSections,
} from '#/features/mail/reminder-mails';
import { parcelsOnServer, serverMailOn } from '#/features/mail/server-mail';
import { pullChanges } from '#/features/sync/pull';
import { trackMails } from '#/features/mail/tracking';
import { loadReminderDates } from '#/features/parcels/reminders';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

let db: CourrierDatabase;

const CONTACT = '01000000-0000-7000-8000-000000000001';
const BATCH = '01000000-0000-7000-8000-000000000002';

async function seed() {
  await db.contact.put({
    id: CONTACT,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    name: 'Nora Haddad',
    email: 'nora@example.test',
  } as never);
  const parcel = parcelRow({
    status: 'recu',
    contactId: CONTACT,
    batchId: BATCH,
  });
  await db.parcel.put(parcel);
  return parcel;
}

const serverOn = (value: boolean) =>
  db.syncState.put({ key: SYNC_STATE_KEYS.serverMail, value });

const request = () =>
  requestBatchMails(db, BATCH, { userId: 'agent', now: new Date() });

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('the mails of a validated batch', () => {
  it('stay with the phone while the server does not send, and nothing is queued', async () => {
    await seed();
    await request();
    expect(await db.notification.count()).toBe(0);
    expect(await db.outbox.count()).toBe(0);
    expect(await loadPendingMails(db)).toHaveLength(1);
  });

  it('become one request per recipient, no code on the iPhone, none left to notify', async () => {
    await seed();
    await serverOn(true);
    await request();

    const [row] = await db.notification.toArray();
    expect(row).toMatchObject({
      channel: 'server',
      status: 'prepared',
      type: 'avis',
      contactId: CONTACT,
      recipients: ['nora@example.test'],
    });
    expect(await db.pickupCode.count()).toBe(0);
    expect(await loadPendingMails(db)).toHaveLength(0);
  });

  it('go back to the phone when the server stops sending or does not answer', async () => {
    const parcel = await seed();
    await serverOn(true);
    await request();
    expect(await parcelsOnServer(db)).toContain(parcel.id);

    await serverOn(false);
    expect(await parcelsOnServer(db)).not.toContain(parcel.id);

    await serverOn(true);
    const later = new Date(Date.now() + 16 * 60_000);
    expect(await parcelsOnServer(db, later)).not.toContain(parcel.id);
  });
});

describe('what the pull says of the sending', () => {
  const page = (serverMail?: boolean) => ({
    generation: '01000000-0000-7000-8000-000000000003',
    reset: false,
    rows: [],
    next: null,
    cursor: 0,
    ...(serverMail === undefined ? {} : { serverMail }),
  });

  it('turns it on and off, and a server of before leaves the phone', async () => {
    await pullChanges(db, () => Promise.resolve(page(true)));
    expect(await serverMailOn(db)).toBe(true);
    await pullChanges(db, () => Promise.resolve(page()));
    expect(await serverMailOn(db)).toBe(false);
  });
});

describe('a mail that bounced', () => {
  const at = (minutes: number) => new Date(NOW.getTime() + minutes * 60_000);
  const mail = (fields: Partial<LocalNotification>) =>
    ({
      id: crypto.randomUUID(),
      deletedAt: null,
      type: 'avis',
      personId: null,
      contactId: CONTACT,
      recipients: ['old@example.test'],
      parcelIds: ['p'],
      preparedBy: 'agent',
      status: 'sent',
      preparedAt: at(0),
      sentAt: at(0),
      ...fields,
    }) as LocalNotification;
  const stateOfFirst = (others: LocalNotification[]) => {
    const first = mail({ deliveryStatus: 'bounced' });
    return trackMails([first, ...others], {
      userId: 'agent',
      parcels: new Map([
        ['p', parcelRow({ id: 'p', status: 'notifie', contactId: CONTACT })],
      ]),
    }).find((row) => row.notification.id === first.id)?.state;
  };

  it('stays failed for a mail only prepared to another address', () => {
    expect(
      stateOfFirst([
        mail({
          status: 'prepared',
          sentAt: null,
          preparedAt: at(5),
          recipients: ['new@example.test'],
        }),
      ]),
    ).toBe('failed');
  });

  it('closes for a mail that left to another address, or delivered to the same', () => {
    expect(
      stateOfFirst([
        mail({ preparedAt: at(5), recipients: ['new@example.test'] }),
      ]),
    ).toBe('closed');
    expect(
      stateOfFirst([mail({ preparedAt: at(5), deliveryStatus: 'delivered' })]),
    ).toBe('closed');
    expect(stateOfFirst([mail({ preparedAt: at(5) })])).toBe('failed');
  });

  it('keeps J+2 for the mail that gets through, and does not count as a reminder', async () => {
    const parcel = parcelRow({
      status: 'notifie',
      contactId: CONTACT,
      notifiedAt: at(0),
      lastNotifiedAt: at(0),
    });
    await db.parcel.put(parcel);
    await db.notification.put(
      mail({ parcelIds: [parcel.id], deliveryStatus: 'bounced' }),
    );
    const fixed = await prepareNotification(
      db,
      {
        type: 'avis',
        contactId: CONTACT,
        recipients: ['new@example.test'],
        parcelIds: [parcel.id],
        templateId: null,
        target: 'mailto',
      },
      { userId: 'agent', now: at(60) },
    );

    const { changes } = await markSent(db, fixed.id, {
      userId: 'agent',
      now: at(60),
    });

    expect(changes[0]).toMatchObject({ reminder: false });
    const after = await db.parcel.get(parcel.id);
    expect(after?.notifiedAt).toEqual(at(60));
    const dates = await loadReminderDates(db, [after!]);
    expect(dates.get(parcel.id)).toBeUndefined();
  });

  it('is said on Relances, apart, never reminded with the others', async () => {
    await db.contact.put({
      id: CONTACT,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      name: 'Nora Haddad',
      email: 'nora@example.test',
    } as never);
    const parcel = parcelRow({
      status: 'notifie',
      contactId: CONTACT,
      notifiedAt: at(0),
    });
    await db.parcel.put(parcel);
    await db.notification.put(
      mail({ parcelIds: [parcel.id], deliveryStatus: 'bounced' }),
    );
    const later = new Date(NOW.getTime() + 10 * 24 * 60 * 60_000);

    const mails = await loadReminderMails(db, later);

    expect(mails[0]).toMatchObject({ bounced: true, due: false });
    const [section] = reminderSections(
      mails,
      later,
      createTranslator(DEFAULT_LOCALE),
    );
    expect(section?.people).toHaveLength(1);
  });
});

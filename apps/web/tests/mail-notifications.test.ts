import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  markFailed,
  markOpened,
  markSent,
  NotificationStateError,
  prepareNotification,
} from '#/features/mail/notifications';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const options = { userId: 'agent-1', now: NOW };
const personId = '0199f000-0000-7000-8000-0000000000aa';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function prepared(parcelIds: string[]) {
  return prepareNotification(
    db,
    {
      type: 'avis',
      personId,
      recipients: ['nora.haddad@example.com'],
      parcelIds,
      templateId: null,
      target: 'mailto',
    },
    options,
  );
}

describe('the outbox of e-mails', () => {
  it('records a prepared mail, queued, without its text', async () => {
    const row = await prepared([parcelRow().id]);

    expect(row).toMatchObject({
      status: 'prepared',
      target: 'mailto',
      preparedBy: 'agent-1',
      sentAt: null,
    });
    expect(row).not.toHaveProperty('body');
    const [op] = await db.outbox.toArray();
    expect(op).toMatchObject({
      entity: 'notification',
      entityId: row.id,
      type: 'upsert',
    });
  });

  it('notifies the parcels in the same write as the mail confirmed', async () => {
    const received = parcelRow({ personId, statusSeq: 1 });
    const reminded = parcelRow({
      personId,
      status: 'notifie',
      notifiedAt: new Date(2026, 9, 22),
    });
    const handedOver = parcelRow({
      personId,
      status: 'remis',
      deliveredAt: NOW,
      deliveredBy: 'agent-1',
    });
    await db.parcel.bulkPut([received, reminded, handedOver]);
    const mail = await prepared([received.id, reminded.id, handedOver.id]);
    await markOpened(db, mail.id, { now: NOW });
    const before = await db.outbox.count();

    const { notification, changes } = await markSent(db, mail.id, options);

    expect(notification).toMatchObject({
      status: 'sent',
      sentAt: NOW,
      openedAt: NOW,
    });
    expect(
      changes.map((change) =>
        'skip' in change ? change.skip : change.reminder,
      ),
    ).toEqual([false, true, 'closed']);
    expect(await db.parcel.get(received.id)).toMatchObject({
      status: 'notifie',
      statusSeq: 2,
      notifiedAt: NOW,
    });
    expect(await db.parcel.get(reminded.id)).toMatchObject({
      status: 'notifie',
      lastNotifiedAt: NOW,
    });
    expect((await db.parcel.get(handedOver.id))?.status).toBe('remis');
    const ops = (await db.outbox.toArray()).slice(before);
    expect(ops.map((op) => op.entity)).toEqual([
      'notification',
      'parcel',
      'event',
      'parcel',
      'event',
    ]);
    expect(ops.map((op) => op.clientTs)).toEqual(ops.map(() => NOW));
    expect(ops[2]?.patch).toMatchObject({
      entityId: received.id,
      type: 'parcel.notified',
      detail: { notificationId: mail.id, kind: 'avis' },
    });
    expect(ops[4]?.patch).toMatchObject({ detail: { kind: 'relance' } });
  });

  it('keeps a sent mail sent, and a failure with its reason', async () => {
    const mail = await prepared([parcelRow().id]);
    const failed = await markFailed(db, mail.id, '  Adresse refusée  ', {
      now: NOW,
    });
    expect(failed).toMatchObject({
      status: 'failed',
      failedReason: 'Adresse refusée',
    });

    const reopened = await markOpened(db, mail.id, { now: NOW });
    expect(reopened).toMatchObject({ status: 'opened', failedReason: null });

    await markSent(db, mail.id, options);
    await expect(markFailed(db, mail.id, 'x')).rejects.toBeInstanceOf(
      NotificationStateError,
    );
    expect((await markSent(db, mail.id, options)).notification.status).toBe(
      'sent',
    );
  });
});

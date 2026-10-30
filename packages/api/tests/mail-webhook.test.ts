import type { PGlite } from '@electric-sql/pglite';
import type { AnyDb } from '@repo/db';
import { emailOutbox, notification, parcel } from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { isWebhookAuthorized, receiveMailEvent } from '#features/mail/webhook';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

let client: PGlite;
let testDb: TestDb;
let db: AnyDb;

const NOW = new Date('2026-10-30T10:00:00Z');
const at = (minutesAgo: number) =>
  Math.floor((NOW.getTime() - minutesAgo * 60_000) / 1_000);

beforeAll(async () => {
  ({ client, db: testDb } = await openTestDb());
  db = asAnyDb(testDb);
});

afterAll(async () => {
  await client.close();
});

async function sentMail() {
  const [{ id: parcelId } = { id: '' }] = await testDb
    .insert(parcel)
    .values(parcelRow())
    .returning({ id: parcel.id });
  const notificationId = newId();
  await testDb.insert(notification).values({
    id: notificationId,
    organizationId: ORGANIZATION_ID,
    type: 'avis',
    recipients: ['a@example.test'],
    parcelIds: [parcelId],
    preparedAt: NOW,
    preparedBy: AGENT_ID,
  });
  const messageId = `<${newId()}@smtp-relay.mailin.fr>`;
  await testDb.insert(emailOutbox).values({
    idempotencyKey: newId(),
    organizationId: ORGANIZATION_ID,
    notificationId,
    recipient: 'a@example.test',
    subject: 'Colis',
    textBody: 'Votre colis',
    status: 'sent',
    providerMessageId: messageId,
  });
  return { notificationId, messageId };
}

const receive = (event: string, messageId: string, minutesAgo = 1) =>
  receiveMailEvent(
    db,
    { event, 'message-id': messageId, ts_event: at(minutesAgo) },
    { now: NOW },
  );

async function mailOf(id: string) {
  const [row] = await testDb
    .select({
      deliveryStatus: notification.deliveryStatus,
      deliveryAt: notification.deliveryAt,
      serverXid: notification.serverXid,
    })
    .from(notification)
    .where(eq(notification.id, id));
  return row;
}

describe('isWebhookAuthorized', () => {
  it('takes the token and nothing else', () => {
    expect(isWebhookAuthorized('Bearer secret', 'secret')).toBe(true);
    expect(isWebhookAuthorized('Bearer wrong', 'secret')).toBe(false);
    expect(isWebhookAuthorized('Bearer secret-longer', 'secret')).toBe(false);
    expect(isWebhookAuthorized('secret', 'secret')).toBe(false);
    expect(isWebhookAuthorized(undefined, 'secret')).toBe(false);
  });
});

describe('receiveMailEvent', () => {
  it('carries the status to the notification, dated by the provider', async () => {
    const { notificationId, messageId } = await sentMail();

    expect(await receive('delivered', messageId)).toBe(200);

    expect(await mailOf(notificationId)).toMatchObject({
      deliveryStatus: 'delivered',
      deliveryAt: new Date(at(1) * 1_000),
    });
  });

  it('changes nothing on a replay, not even the sync cursor', async () => {
    const { notificationId, messageId } = await sentMail();
    await receive('hard_bounce', messageId);
    const first = await mailOf(notificationId);

    expect(await receive('hard_bounce', messageId, 0)).toBe(200);

    expect(await mailOf(notificationId)).toEqual(first);
  });

  it('keeps a bounce when `delivered` arrives after it', async () => {
    const { notificationId, messageId } = await sentMail();
    await receive('hard_bounce', messageId);

    await receive('delivered', messageId);

    expect((await mailOf(notificationId))?.deliveryStatus).toBe('bounced');
  });

  it('moves a delivered mail on to a complaint', async () => {
    const { notificationId, messageId } = await sentMail();
    await receive('delivered', messageId);

    await receive('spam', messageId);

    expect((await mailOf(notificationId))?.deliveryStatus).toBe('complained');
  });

  it.each([
    ['invalid_email', 'bounced'],
    ['blocked', 'bounced'],
    ['unsubscribed', 'unsubscribed'],
  ])('reads %s as %s', async (event, status) => {
    const { notificationId, messageId } = await sentMail();

    await receive(event, messageId);

    expect((await mailOf(notificationId))?.deliveryStatus).toBe(status);
  });

  it('writes nothing for an event that says nothing final', async () => {
    const { notificationId, messageId } = await sentMail();

    expect(await receive('soft_bounce', messageId)).toBe(200);

    expect((await mailOf(notificationId))?.deliveryStatus).toBeNull();
  });

  it('follows a mail with no notification on the outbox alone', async () => {
    const messageId = `<${newId()}@smtp-relay.mailin.fr>`;
    await testDb.insert(emailOutbox).values({
      idempotencyKey: newId(),
      recipient: 'invite@example.test',
      subject: 'Invitation',
      textBody: 'Bienvenue',
      status: 'sent',
      providerMessageId: messageId,
    });

    expect(await receive('delivered', messageId)).toBe(200);

    const [row] = await testDb
      .select({ status: emailOutbox.deliveryStatus })
      .from(emailOutbox)
      .where(eq(emailOutbox.providerMessageId, messageId));
    expect(row?.status).toBe('delivered');
  });

  it('asks again for a recent unknown message, which may be mid-send', async () => {
    expect(await receive('delivered', '<unknown@x>', 1)).toBe(429);
  });

  it('drops an old unknown message', async () => {
    expect(await receive('delivered', '<unknown@x>', 10)).toBe(200);
  });

  it('refuses a body that is not an event', async () => {
    expect(await receiveMailEvent(db, { event: 'delivered' })).toBe(400);
    expect(await receiveMailEvent(db, null)).toBe(400);
  });

  it('answers 429, never 5xx, when the database fails: Brevo would give up', async () => {
    const broken = {
      transaction: () => Promise.reject(new Error('connection lost')),
    } as unknown as AnyDb;

    expect(
      await receiveMailEvent(broken, {
        event: 'delivered',
        'message-id': '<a@x>',
      }),
    ).toBe(429);
  });

  it('stamps the sync cursor when the status moves', async () => {
    const { notificationId, messageId } = await sentMail();
    const before = await mailOf(notificationId);

    await receive('delivered', messageId);

    expect((await mailOf(notificationId))?.serverXid).not.toBe(
      before?.serverXid,
    );
  });
});

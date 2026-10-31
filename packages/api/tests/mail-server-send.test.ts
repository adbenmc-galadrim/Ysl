import type { PGlite } from '@electric-sql/pglite';
import { pickupPinHash, pickupVerdict } from '@repo/contract/pickup';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { brevoMailer } from '#features/mail/brevo';
import { qrModules, qrPng } from '#features/mail/qr';
import { drainEmailOutbox } from '#features/mail/queue';
import { requestDueReminders } from '#features/mail/server-reminders';
import { prepareServerMails } from '#features/mail/server-send';
import { receiveMailEvent } from '#features/mail/webhook';
import { startFakeBrevo } from './helpers/fake-brevo';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

const {
  department,
  departmentMember,
  directoryPerson,
  emailOutbox,
  emailSuppression,
  event,
  mailSender,
  notification,
  parcel,
  pickupCode,
  setting,
} = schema;

const NOW = new Date('2026-10-26T09:00:00Z');
const DAY = 24 * 60 * 60_000;

let client: PGlite;
let db: TestDb;
let brevo: Awaited<ReturnType<typeof startFakeBrevo>>;
let mailer: ReturnType<typeof brevoMailer>;
let finance: string;
let studio: string;

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  brevo = await startFakeBrevo();
  mailer = brevoMailer({
    apiKey: 'test-key',
    from: { email: 'courrier@plateforme.test', name: 'Courrier' },
    fetch: brevo.fetch,
  });
  finance = newId();
  studio = newId();
  await db.insert(department).values([
    {
      id: finance,
      organizationId: ORGANIZATION_ID,
      name: 'Finance',
      pickup: {
        place: 'Salle 12',
        hours: { mon: '', tue: '', wed: '', thu: '', fri: '' },
        instructions: '',
      },
    },
    { id: studio, organizationId: ORGANIZATION_ID, name: 'Studio' },
  ]);
}, 60_000);

afterAll(async () => {
  await brevo.close();
  await client.close();
});

beforeEach(async () => {
  brevo.sent.length = 0;
  brevo.refusedSenders.clear();
  await db.delete(emailOutbox);
  await db.delete(emailSuppression);
  await db.delete(mailSender);
});

async function addPerson(email = `${newId()}@example.test`) {
  const id = newId();
  await db.insert(directoryPerson).values({
    id,
    organizationId: ORGANIZATION_ID,
    departmentId: finance,
    firstName: 'Nora',
    lastName: 'Haddad',
    nameNorm: 'haddad nora',
    email,
  });
  return { id, email };
}

async function addParcel(personId: string, fields: object = {}) {
  const row = {
    ...parcelRow(),
    personId,
    departmentId: finance,
    carrier: 'UPS',
    tracking: '1Z999AA10123456784',
    ...fields,
  };
  await db.insert(parcel).values(row as typeof parcel.$inferInsert);
  return row.id;
}

async function request(
  personId: string,
  parcelIds: string[],
  fields: Partial<typeof notification.$inferInsert> = {},
) {
  const id = newId();
  await db.insert(notification).values({
    id,
    organizationId: ORGANIZATION_ID,
    type: 'avis',
    personId,
    recipients: ['ignored@example.test'],
    parcelIds,
    status: 'prepared',
    channel: 'server',
    preparedAt: NOW,
    preparedBy: AGENT_ID,
    ...fields,
  });
  return id;
}

const any = () => asAnyDb(db);
const prepare = async (now = NOW) => {
  await prepareServerMails(any(), { now });
  await db.update(emailOutbox).set({ nextAttemptAt: now });
};
const round = async (now = NOW) => {
  await prepare(now);
  return drainEmailOutbox(any(), mailer, { now: () => now });
};
const parcelOf = async (id: string) =>
  (await db.select().from(parcel).where(eq(parcel.id, id)))[0]!;
const mailOf = async (id: string) =>
  (await db.select().from(notification).where(eq(notification.id, id)))[0]!;
const liveCodes = (personId: string) =>
  db
    .select()
    .from(pickupCode)
    .where(
      and(eq(pickupCode.personId, personId), isNull(pickupCode.deletedAt)),
    );

describe('a request written by the iPhone', () => {
  it('sends one mail, draws the code in the parcels department and tells the parcels', async () => {
    const { id: person, email } = await addPerson();
    const ids = [await addParcel(person), await addParcel(person)];
    const mail = await request(person, ids);

    expect(await round()).toMatchObject({ sent: 1 });

    expect(brevo.sent).toHaveLength(1);
    const [sent] = brevo.sent;
    expect(sent!.to[0]!.email).toBe(email);
    expect(sent!.textContent).toContain('Salle 12');
    expect(sent!.textContent).toContain('UPS ···6784');
    expect(sent!.htmlContent).toContain('<table');
    expect(sent!.attachment?.[0]?.name).toBe('code-de-retrait.png');
    const [code] = await liveCodes(person);
    expect(code?.departmentId).toBe(finance);
    const pin = /(\d{4})/.exec(sent!.textContent)![1]!;
    expect(code?.pinHash).toBe(await pickupPinHash(pin));
    expect(await mailOf(mail)).toMatchObject({
      status: 'sent',
      recipients: [email],
    });
    expect(await parcelOf(ids[0]!)).toMatchObject({ status: 'notifie' });
    const events = await db
      .select()
      .from(event)
      .where(eq(event.entityId, ids[0]!));
    expect(events.map((row) => row.type)).toContain('parcel.notified');
  });

  it('leaves no code or text in the queue once the mail left', async () => {
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);
    await round();

    const [row] = await db.select().from(emailOutbox);
    expect(row).toMatchObject({
      status: 'sent',
      textBody: '',
      htmlBody: null,
      attachments: null,
    });
  });

  it('sends nothing twice when the round runs again', async () => {
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);
    await round();
    await round();
    expect(brevo.sent).toHaveLength(1);
  });

  it('writes one code per department when the parcels sit in two', async () => {
    const { id: person } = await addPerson();
    const a = await addParcel(person);
    const b = await addParcel(person);
    await client.exec(
      `alter table parcel disable trigger user; update parcel set department_id = '${studio}' where id = '${b}'; alter table parcel enable trigger user;`,
    );
    await request(person, [a, b]);
    await round();

    expect(brevo.sent).toHaveLength(2);
    const departments = (await liveCodes(person)).map((c) => c.departmentId);
    expect(departments.sort()).toEqual([finance, studio].sort());
    expect(await parcelOf(b)).toMatchObject({ status: 'notifie' });
  });

  it('sends nothing for a phone mail: only a request of the server goes', async () => {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    await request(person, [parcelId], { channel: 'phone', target: 'mailto' });
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect(await liveCodes(person)).toHaveLength(0);
    expect(await parcelOf(parcelId)).toMatchObject({ status: 'recu' });
  });

  it('gives a parcel for a contact a department, and its code opens there', async () => {
    const contactId = newId();
    await db.insert(schema.contact).values({
      id: contactId,
      organizationId: ORGANIZATION_ID,
      name: 'Inès Roux',
      nameNorm: 'ines roux',
      email: 'ines@example.test',
      department: 'Studio',
    } as typeof schema.contact.$inferInsert);
    const row = { ...parcelRow(), contactId };
    await db.insert(parcel).values(row);
    expect((await parcelOf(row.id)).departmentId).toBe(studio);

    const id = newId();
    await db.insert(notification).values({
      id,
      organizationId: ORGANIZATION_ID,
      type: 'avis',
      contactId,
      recipients: ['ines@example.test'],
      parcelIds: [row.id],
      status: 'prepared',
      channel: 'server',
      preparedAt: NOW,
      preparedBy: AGENT_ID,
    });
    await round();
    expect(brevo.sent[0]!.to[0]!.email).toBe('ines@example.test');
    const [code] = await db
      .select()
      .from(pickupCode)
      .where(eq(pickupCode.contactId, contactId));
    expect(code?.departmentId).toBe(studio);
  });

  it('does not send one person the code of another when the parcel changed hands', async () => {
    const { id: first } = await addPerson();
    const { id: second } = await addPerson();
    const parcelId = await addParcel(second);
    const mail = await request(first, [parcelId]);
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect(await mailOf(mail)).toMatchObject({ status: 'failed' });
    expect(await liveCodes(first)).toHaveLength(0);
  });

  it('sends one mail and one live code when a parcel has its own address', async () => {
    const { id: person, email } = await addPerson();
    const a = await addParcel(person);
    const b = await addParcel(person, {
      notificationEmail: 'autre@example.test',
    });
    await request(person, [a, b], { recipients: [email] });
    await round();
    expect(brevo.sent).toHaveLength(1);
    expect(brevo.sent[0]!.to[0]!.email).toBe(email);
    expect(await liveCodes(person)).toHaveLength(1);
  });

  it('holds back while the phone has a later mail on the parcel, even unconfirmed', async () => {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    await request(person, [parcelId]);
    await prepare();
    await db.insert(notification).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      type: 'avis',
      personId: person,
      recipients: ['a@example.test'],
      parcelIds: [parcelId],
      status: 'opened',
      target: 'mailto',
      preparedAt: new Date(NOW.getTime() + 20 * 60_000),
      preparedBy: AGENT_ID,
    });
    await drainEmailOutbox(any(), mailer, { now: () => NOW });
    expect(brevo.sent).toHaveLength(0);
  });

  it('draws no code for a person filed under no department', async () => {
    const { id: person } = await addPerson();
    await db
      .update(directoryPerson)
      .set({ departmentId: null })
      .where(eq(directoryPerson.id, person));
    const row = { ...parcelRow(), personId: person };
    await db.insert(parcel).values(row);
    const mail = await request(person, [row.id]);
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect(await liveCodes(person)).toHaveLength(0);
    expect(await mailOf(mail)).toMatchObject({
      status: 'failed',
      failedReason: 'Colis sans département',
    });
    expect(await parcelOf(row.id)).toMatchObject({ status: 'recu' });
  });

  it('sends one mail for a double tap', async () => {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    await request(person, [parcelId]);
    await request(person, [parcelId]);
    await round();
    await round();
    expect(brevo.sent).toHaveLength(1);
  });

  it('reads the address on the server, not the one the device wrote', async () => {
    const { id: person, email } = await addPerson();
    await request(person, [await addParcel(person)], {
      recipients: ['attacker@example.test'],
    });
    await round();
    expect(brevo.sent[0]!.to[0]!.email).toBe(email);
  });

  it('answers to the parcels department', async () => {
    await db
      .insert(departmentMember)
      .values({
        userId: AGENT_ID,
        organizationId: ORGANIZATION_ID,
        departmentId: finance,
      })
      .onConflictDoNothing();
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);
    await round();
    expect(brevo.sent[0]!.replyTo?.email).toBe('agent@example.test');
  });

  it('is dropped once the phone told the parcel, before and after the queue', async () => {
    const { id: person } = await addPerson();
    const before = await addParcel(person, {
      status: 'notifie',
      notifiedAt: NOW,
    });
    const refused = await request(person, [before]);
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect((await mailOf(refused)).status).toBe('failed');

    const after = await addParcel(person);
    const queued = await request(person, [after]);
    await prepare();
    await db
      .update(parcel)
      .set({ status: 'notifie', notifiedAt: NOW })
      .where(eq(parcel.id, after));
    await drainEmailOutbox(any(), mailer, { now: () => NOW });
    expect(brevo.sent).toHaveLength(0);
    expect((await mailOf(queued)).status).toBe('failed');
  });

  it('does not send a request too old, when the job comes back after days off', async () => {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    const old = await request(person, [parcelId], {
      preparedAt: new Date(NOW.getTime() - 4 * DAY),
    });
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect(await mailOf(old)).toMatchObject({ status: 'failed' });
    expect(await parcelOf(parcelId)).toMatchObject({ status: 'recu' });
  });

  it('gives the former code back when the mail cannot leave', async () => {
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);
    await round();
    const [held] = await liveCodes(person);

    const bad = await addParcel(person);
    const mail = await request(person, [bad]);
    const refusing = {
      send: () =>
        Promise.resolve({ status: 'rejected' as const, reason: 'brevo 400' }),
    };
    await prepare();
    await drainEmailOutbox(any(), refusing, { now: () => NOW });

    expect((await liveCodes(person)).map((c) => c.id)).toEqual([held!.id]);
    expect(await mailOf(mail)).toMatchObject({ status: 'failed' });
    expect(await parcelOf(bad)).toMatchObject({ status: 'recu' });
  });

  it('sends nothing to an address that unsubscribed', async () => {
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);
    await round();
    const [row] = await db.select().from(emailOutbox);
    await db
      .update(emailOutbox)
      .set({ providerMessageId: '<x@relay>' })
      .where(eq(emailOutbox.id, row!.id));
    await receiveMailEvent(any(), {
      event: 'unsubscribed',
      'message-id': '<x@relay>',
    });
    brevo.sent.length = 0;

    const next = await request(person, [await addParcel(person)]);
    await round();
    expect(brevo.sent).toHaveLength(0);
    expect(await mailOf(next)).toMatchObject({
      status: 'failed',
      failedReason: 'Adresse désinscrite des e-mails',
    });
  });

  it('falls back on the platform when Brevo refuses the company sender', async () => {
    await db.insert(mailSender).values({
      organizationId: ORGANIZATION_ID,
      name: 'Maison',
      email: 'courrier@maison.test',
      domain: 'maison.test',
      status: 'verified',
    });
    brevo.refusedSenders.add('courrier@maison.test');
    const { id: person } = await addPerson();
    await request(person, [await addParcel(person)]);

    expect(await round()).toMatchObject({ sent: 1, blocked: 0 });
    expect(brevo.sent[0]!.sender).toEqual({
      email: 'courrier@plateforme.test',
      name: 'Maison',
    });
  });
});

describe('a corrected address after a bounce', () => {
  it('counts as the first notice: J+2 runs from it, not from the mail nobody read', async () => {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    const first = await request(person, [parcelId]);
    await round();
    await db
      .update(notification)
      .set({ deliveryStatus: 'bounced' })
      .where(eq(notification.id, first));
    await db.delete(emailOutbox);

    const later = new Date(NOW.getTime() + 2 * DAY);
    const fixed = await request(person, [parcelId], { preparedAt: later });
    await round(later);

    expect(await mailOf(fixed)).toMatchObject({ status: 'sent', type: 'avis' });
    expect((await parcelOf(parcelId)).notifiedAt).toEqual(later);
  });
});

describe('automatic reminders', () => {
  beforeEach(async () => {
    await db.update(parcel).set({ deletedAt: NOW });
  });

  async function setProfile(reminders: 'optional' | 'required') {
    await db.delete(setting).where(eq(setting.key, 'operatingProfile'));
    await db.insert(setting).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      key: 'operatingProfile',
      value: {
        shuttleActsAsDepartment: false,
        batchReview: 'optional',
        depositConfirmation: 'disabled',
        handoverProof: 'optional',
        handoverScan: 'disabled',
        signature: 'optional',
        photo: 'optional',
        emailMoment: 'scan',
        reminders,
      },
    });
  }

  async function noticed() {
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person);
    await request(person, [parcelId]);
    await round();
    brevo.sent.length = 0;
    return { person, parcelId };
  }

  const J2 = new Date('2026-10-28T09:00:00Z');

  it('goes once at J+2 with a new code, and the former QR says replaced', async () => {
    await setProfile('required');
    const { person, parcelId } = await noticed();
    const [former] = await liveCodes(person);

    await requestDueReminders(any(), J2);
    await round(J2);
    expect(brevo.sent).toHaveLength(1);
    expect(brevo.sent[0]!.subject).toContain('Rappel');
    expect((await parcelOf(parcelId)).notifiedAt).toEqual(NOW);

    expect(await requestDueReminders(any(), J2)).toBe(0);
    await round(J2);
    expect(brevo.sent).toHaveLength(1);

    const [current] = await liveCodes(person);
    expect(current!.id).not.toBe(former!.id);
    const [old] = await db
      .select()
      .from(pickupCode)
      .where(eq(pickupCode.id, former!.id));
    expect(pickupVerdict([old!], J2)).toEqual({ status: 'replaced' });
  });

  it('waits for the rule, and for working hours', async () => {
    await setProfile('required');
    await noticed();
    expect(
      await requestDueReminders(any(), new Date('2026-10-27T09:00:00Z')),
    ).toBe(0);
    expect(
      await requestDueReminders(any(), new Date('2026-10-28T04:00:00Z')),
    ).toBe(0);
  });

  it('stays by hand when the profile says so', async () => {
    await setProfile('optional');
    await noticed();
    expect(await requestDueReminders(any(), J2)).toBe(0);
  });

  it('leaves to the phone what the phone told', async () => {
    await setProfile('required');
    const { id: person } = await addPerson();
    const parcelId = await addParcel(person, {
      status: 'notifie',
      notifiedAt: NOW,
    });
    await db.insert(notification).values({
      id: newId(),
      organizationId: ORGANIZATION_ID,
      type: 'avis',
      personId: person,
      recipients: ['a@example.test'],
      parcelIds: [parcelId],
      status: 'sent',
      sentAt: NOW,
      preparedAt: NOW,
      preparedBy: AGENT_ID,
    });
    expect(await requestDueReminders(any(), J2)).toBe(0);
  });

  it('holds back after a bounce: the address has to change first', async () => {
    await setProfile('required');
    const { parcelId } = await noticed();
    await db
      .update(notification)
      .set({ deliveryStatus: 'bounced' })
      .where(eq(notification.status, 'sent'));
    expect(await parcelOf(parcelId)).toMatchObject({ status: 'notifie' });
    expect(await requestDueReminders(any(), J2)).toBe(0);
  });
});

describe('the QR', () => {
  it('is a real PNG of the modules', () => {
    const png = qrPng(
      qrModules('YSL:RETRAIT:ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'),
    );
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });
});

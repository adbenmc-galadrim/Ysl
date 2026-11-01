import type { PGlite } from '@electric-sql/pglite';
import {
  DEFAULT_OPERATING_PROFILE,
  type OperatingProfile,
} from '@repo/contract/operating-profile';
import type { SyncOp } from '@repo/contract/sync';
import * as schema from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { eq } from 'drizzle-orm';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { confirmDeposit, settleParcel } from '#features/deposits/service';
import { serverMailEnabled } from '#features/mail/config';
import { brevoMailer } from '#features/mail/brevo';
import { drainEmailOutbox } from '#features/mail/queue';
import { requestDueReminders } from '#features/mail/server-reminders';
import { prepareServerMails } from '#features/mail/server-send';
import { saveOperatingProfile } from '#features/operating/service';
import { push } from '#features/sync/push';
import { startFakeBrevo } from './helpers/fake-brevo';
import { accessOf, addDepartment, addPerson } from './helpers/departments';
import {
  AGENT_ID,
  asAnyDb,
  openTestDb,
  ORGANIZATION_ID,
  parcelRow,
  type TestDb,
} from './helpers/pglite';

vi.mock('#features/mail/config', () => ({
  serverMailEnabled: vi.fn(() => true),
}));

const { deposit, emailOutbox, notification, parcel, setting } = schema;

const SCAN = new Date('2026-10-26T09:00:00Z');
const DEPOSIT = new Date('2026-10-28T09:00:00Z');

let client: PGlite;
let db: TestDb;
let brevo: Awaited<ReturnType<typeof startFakeBrevo>>;
let mailer: ReturnType<typeof brevoMailer>;
let finance: string;
let legal: string;

const any = () => asAnyDb(db);
const actor = {
  organizationId: ORGANIZATION_ID,
  userId: AGENT_ID,
  name: 'Julie',
};
const pickup = (place: string) => ({
  place,
  hours: { mon: '', tue: '', wed: '', thu: '', fri: '' },
  instructions: `Consignes ${place}`,
});

beforeAll(async () => {
  ({ client, db } = await openTestDb());
  brevo = await startFakeBrevo();
  mailer = brevoMailer({
    apiKey: 'test-key',
    from: { email: 'courrier@plateforme.test', name: 'Courrier' },
    fetch: brevo.fetch,
  });
  finance = await addDepartment(db, 'Finance');
  legal = await addDepartment(db, 'Juridique');
  await db
    .update(schema.department)
    .set({ pickup: pickup('Salle Finance') })
    .where(eq(schema.department.id, finance));
  await db
    .update(schema.department)
    .set({ pickup: pickup('Salle Juridique') })
    .where(eq(schema.department.id, legal));
}, 60_000);

afterAll(async () => {
  await brevo.close();
  await client.close();
});

beforeEach(async () => {
  brevo.sent.length = 0;
  vi.mocked(serverMailEnabled).mockReturnValue(true);
  await db.delete(emailOutbox);
  await db.delete(deposit);
  await db.delete(notification);
  await db.delete(parcel);
  await db.delete(setting);
});

async function setProfile(values: Partial<OperatingProfile>) {
  await db.delete(setting);
  await db.insert(setting).values({
    id: newId(),
    organizationId: ORGANIZATION_ID,
    key: 'operatingProfile',
    value: {
      ...DEFAULT_OPERATING_PROFILE,
      shuttleActsAsDepartment: false,
      depositConfirmation: 'count',
      ...values,
    },
  });
}

async function addParcel(values: Partial<typeof parcel.$inferInsert>) {
  const person = values.personId ?? (await addPerson(db, finance));
  const row = {
    ...parcelRow(),
    status: 'en_route' as const,
    departmentId: finance,
    personId: person,
    carrier: 'UPS',
    tracking: '1Z999AA10123456784',
    ...values,
  };
  await db.insert(parcel).values(row);
  return row.id;
}

async function ask(parcelId: string, now = SCAN) {
  const [row] = await db.select().from(parcel).where(eq(parcel.id, parcelId));
  const id = newId();
  await db.insert(notification).values({
    id,
    organizationId: ORGANIZATION_ID,
    type: 'avis',
    personId: row!.personId,
    recipients: ['ignored@example.test'],
    parcelIds: [parcelId],
    status: 'prepared',
    channel: 'server',
    preparedAt: now,
    preparedBy: AGENT_ID,
  });
  return id;
}

async function round(now = SCAN) {
  await prepareServerMails(any(), { now });
  await db.update(emailOutbox).set({ nextAttemptAt: now });
  return drainEmailOutbox(any(), mailer, { now: () => now });
}

async function deposited(
  parcelIds: string[],
  now = DEPOSIT,
  department = finance,
) {
  const id = newId();
  await db.insert(deposit).values({
    id,
    organizationId: ORGANIZATION_ID,
    departmentId: department,
    shuttleId: AGENT_ID,
    parcelIds,
    announced: parcelIds.length,
    postedAt: now,
  });
  await db.transaction((tx) =>
    confirmDeposit(
      tx as never,
      actor,
      department,
      { depositId: id, counted: parcelIds.length, gap: null },
      { now },
    ),
  );
}

const parcelOf = async (id: string) =>
  (await db.select().from(parcel).where(eq(parcel.id, id)))[0]!;
const mailOf = async (id: string) =>
  (await db.select().from(notification).where(eq(notification.id, id)))[0]!;

describe('profile « au dépôt »', () => {
  beforeEach(() => setProfile({ emailMoment: 'deposit' }));

  it('sends nothing before the deposit is confirmed, whatever a device asks, and says why', async () => {
    const onItsWay = await addParcel({});
    const atDesk = await addParcel({ status: 'recu' });
    const mails = [await ask(onItsWay), await ask(atDesk)];

    await round();

    expect(brevo.sent).toHaveLength(0);
    for (const id of mails) {
      const mail = await mailOf(id);
      expect(mail.status).toBe('failed');
      expect(mail.failedReason).toContain('déposé');
    }
    expect((await parcelOf(onItsWay)).status).toBe('en_route');
    expect((await parcelOf(atDesk)).status).toBe('recu');
    expect(await db.select().from(schema.pickupCode)).toHaveLength(0);
  });

  it('tells the employee once confirmed, with the place and instructions of the department', async () => {
    const id = await addParcel({});
    await deposited([id]);
    expect((await parcelOf(id)).status).toBe('depose');

    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(1);
    expect(brevo.sent[0]!.textContent).toContain('Salle Finance');
    expect(brevo.sent[0]!.textContent).toContain('Consignes Salle Finance');
    const row = await parcelOf(id);
    expect(row.status).toBe('notifie');
    expect(row.depositedAt).toEqual(DEPOSIT);
    expect(row.notifiedAt).toEqual(DEPOSIT);
  });

  it('runs its reminders from the deposit', async () => {
    await setProfile({ emailMoment: 'deposit', reminders: 'required' });
    const id = await addParcel({ receivedAt: SCAN });
    await deposited([id]);
    await round(DEPOSIT);
    brevo.sent.length = 0;

    expect(
      await requestDueReminders(any(), new Date('2026-10-29T09:00:00Z')),
    ).toBe(0);
    expect(
      await requestDueReminders(any(), new Date('2026-10-30T09:00:00Z')),
    ).toBe(1);
  });

  it('asks nothing of the server when it does not send: the parcels wait for the phone', async () => {
    vi.mocked(serverMailEnabled).mockReturnValue(false);
    const id = await addParcel({});
    await deposited([id]);

    expect((await parcelOf(id)).status).toBe('depose');
    expect(await db.select().from(notification)).toHaveLength(0);
  });

  it('asks no mail for a parcel held back by a gap', async () => {
    const [kept, missing] = [await addParcel({}), await addParcel({})];
    const id = newId();
    await db.insert(deposit).values({
      id,
      organizationId: ORGANIZATION_ID,
      departmentId: finance,
      shuttleId: AGENT_ID,
      parcelIds: [kept, missing],
      announced: 2,
      postedAt: DEPOSIT,
    });
    await confirmDeposit(
      any(),
      actor,
      finance,
      {
        depositId: id,
        counted: 1,
        gap: { kind: 'missing', parcelIds: [missing] },
      },
      { now: DEPOSIT },
    );
    const asked = await db.select().from(notification);
    expect(asked).toHaveLength(1);
    expect(asked[0]!.parcelIds).toEqual([kept]);
    expect((await parcelOf(missing)).status).toBe('a_regulariser');
  });

  it('names the new department after a parcel is sent elsewhere', async () => {
    const id = await addParcel({
      status: 'a_regulariser',
      personId: await addPerson(db, null),
      lastNotifiedAt: SCAN,
    });
    await settleParcel(
      any(),
      actor,
      { parcelId: id, action: 'department', departmentId: legal },
      DEPOSIT,
    );
    const moved = await parcelOf(id);
    expect(moved.status).toBe('en_route');
    expect(moved.lastNotifiedAt).toBeNull();

    await deposited([id], DEPOSIT, legal);
    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(1);
    expect(brevo.sent[0]!.textContent).toContain('Salle Juridique');
    expect(brevo.sent[0]!.textContent).not.toContain('Salle Finance');
  });
});

describe('a parcel given to someone else in the same department', () => {
  it('tells the new recipient at the deposit: the trace was another’s', async () => {
    await setProfile({ emailMoment: 'scan' });
    const id = await addParcel({
      status: 'a_regulariser',
      lastNotifiedAt: SCAN,
    });
    const colleague = await addPerson(db, finance);
    await settleParcel(
      any(),
      actor,
      { parcelId: id, action: 'person', personId: colleague },
      DEPOSIT,
    );
    expect((await parcelOf(id)).lastNotifiedAt).toBeNull();

    await deposited([id]);
    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(1);
    expect((await parcelOf(id)).status).toBe('notifie');
  });
});

describe('a recipient corrected on the way', () => {
  it('tells the new one at the deposit, even from a stale copy of the trace', async () => {
    await setProfile({ emailMoment: 'scan' });
    const id = await addParcel({ lastNotifiedAt: SCAN });
    const colleague = await addPerson(db, finance);
    const {
      serverXid: _xid,
      organizationId: _org,
      ...row
    } = await parcelOf(id);
    void _xid;
    void _org;
    const { results } = await push(any(), accessOf('company_admin'), {
      ops: [
        {
          opId: newId(),
          entity: 'parcel',
          entityId: id,
          type: 'upsert',
          patch: { ...row, personId: colleague },
          clientTs: SCAN,
        },
      ],
    });
    expect(results[0]!.status).toBe(200);
    expect((await parcelOf(id)).lastNotifiedAt).toBeNull();

    await deposited([id]);
    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(1);
    expect((await parcelOf(id)).status).toBe('notifie');
  });
});

describe('profile « au scan »', () => {
  beforeEach(() => setProfile({ emailMoment: 'scan', reminders: 'required' }));

  it('tells at the scan, keeps it on its way, and the deposit sends nothing more', async () => {
    const id = await addParcel({});
    await ask(id);
    await round();

    expect(brevo.sent).toHaveLength(1);
    const onTour = await parcelOf(id);
    expect(onTour.status).toBe('en_route');
    expect(onTour.lastNotifiedAt).toEqual(SCAN);

    brevo.sent.length = 0;
    await deposited([id]);
    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(0);
    const told = await parcelOf(id);
    expect(told.status).toBe('notifie');
    expect(told.notifiedAt).toEqual(DEPOSIT);
  });

  it('runs its reminders from the deposit, not from the mail at the scan', async () => {
    const id = await addParcel({});
    await ask(id);
    await round();
    await deposited([id]);

    expect(
      await requestDueReminders(any(), new Date('2026-10-29T09:00:00Z')),
    ).toBe(0);
    expect(
      await requestDueReminders(any(), new Date('2026-10-30T09:00:00Z')),
    ).toBe(1);
  });

  it('tells at the deposit the one nobody could tell at the scan', async () => {
    const id = await addParcel({});
    await deposited([id]);
    await round(DEPOSIT);

    expect(brevo.sent).toHaveLength(1);
    expect((await parcelOf(id)).status).toBe('notifie');
  });

  it('still has a way out once the company has no tour: told, the parcel waits to be handed over', async () => {
    const told = await addParcel({ lastNotifiedAt: SCAN });
    const notTold = await addParcel({});

    await saveOperatingProfile(
      any(),
      ORGANIZATION_ID,
      {
        ...DEFAULT_OPERATING_PROFILE,
        shuttleActsAsDepartment: true,
      },
      AGENT_ID,
    );

    expect((await parcelOf(told)).status).toBe('notifie');
    expect((await parcelOf(notTold)).status).toBe('en_route');
    expect(brevo.sent).toHaveLength(0);
  });
});

function pushed(
  parcelId: string,
  personId: string,
  access: ReturnType<typeof accessOf>,
) {
  const op = (
    entity: SyncOp['entity'],
    entityId: string,
    patch: object,
  ): SyncOp => ({
    opId: newId(),
    entity,
    entityId,
    type: 'upsert',
    patch: patch as SyncOp['patch'],
    clientTs: SCAN,
  });
  const mail = newId();
  return {
    mail,
    run: async () => {
      const {
        serverXid: _xid,
        organizationId: _org,
        ...row
      } = await parcelOf(parcelId);
      void _xid;
      void _org;
      return push(any(), access, {
        ops: [
          op('notification', mail, {
            type: 'avis',
            personId,
            contactId: null,
            recipients: ['nora@example.test'],
            cc: [],
            parcelIds: [parcelId],
            templateId: null,
            status: 'sent',
            target: null,
            preparedAt: SCAN,
            preparedBy: AGENT_ID,
            openedAt: SCAN,
            sentAt: SCAN,
            failedReason: null,
          }),
          op('parcel', parcelId, {
            ...row,
            status: 'notifie',
            statusSeq: row.statusSeq + 1,
            notifiedAt: SCAN,
            lastNotifiedAt: null,
          }),
        ],
      });
    },
  };
}

describe('a mail sent through the phone of an old version', () => {
  it('on tour: accepted and traced, the parcel stays « Reçu », the deposit tells no one twice', async () => {
    await setProfile({ emailMoment: 'deposit' });
    const person = await addPerson(db, finance);
    const id = await addParcel({ status: 'recu', personId: person });
    const { mail, run } = pushed(id, person, accessOf('company_admin'));

    const { results } = await run();

    expect(results.map((row) => row.status)).toEqual([200, 200]);
    expect((await mailOf(mail)).status).toBe('sent');
    const row = await parcelOf(id);
    expect(row.status).toBe('recu');
    expect(row.notifiedAt).toBeNull();
    expect(row.lastNotifiedAt).toEqual(SCAN);

    await db
      .update(parcel)
      .set({ status: 'en_route', statusSeq: row.statusSeq + 1 })
      .where(eq(parcel.id, id));
    await deposited([id]);
    expect((await parcelOf(id)).status).toBe('notifie');
    await round(DEPOSIT);
    expect(brevo.sent).toHaveLength(0);
  });

  it('Petit site: the op in a queue passes as it always did', async () => {
    await setProfile({ shuttleActsAsDepartment: true });
    const person = await addPerson(db, finance);
    const id = await addParcel({ status: 'recu', personId: person });
    const { run } = pushed(id, person, accessOf('company_admin'));

    const { results } = await run();

    expect(results.map((row) => row.status)).toEqual([200, 200]);
    const row = await parcelOf(id);
    expect(row.status).toBe('notifie');
    expect(row.notifiedAt).toEqual(SCAN);
  });

  it('no profile at all: as before too', async () => {
    const person = await addPerson(db, finance);
    const id = await addParcel({ status: 'recu', personId: person });
    const { results } = await pushed(
      id,
      person,
      accessOf('company_admin'),
    ).run();
    expect(results.map((row) => row.status)).toEqual([200, 200]);
    expect((await parcelOf(id)).status).toBe('notifie');
  });

  it('refuses a device that writes « Notifié » out of a tour', async () => {
    await setProfile({ emailMoment: 'scan' });
    const person = await addPerson(db, finance);
    const id = await addParcel({ personId: person, lastNotifiedAt: SCAN });
    const { results } = await push(any(), accessOf('company_admin'), {
      ops: [
        {
          opId: newId(),
          entity: 'parcel',
          entityId: id,
          type: 'upsert',
          patch: { status: 'notifie', notifiedAt: SCAN },
          clientTs: SCAN,
        },
      ],
    });
    expect(results[0]!.status).not.toBe(200);
    expect((await parcelOf(id)).status).toBe('en_route');
  });
});

describe('a request of the server, Petit site', () => {
  it('leaves the parcel « Reçu » notified, as in production today', async () => {
    await setProfile({ shuttleActsAsDepartment: true });
    const id = await addParcel({ status: 'recu' });
    await ask(id);
    await round();
    expect(brevo.sent).toHaveLength(1);
    const row = await parcelOf(id);
    expect(row.status).toBe('notifie');
    expect(row.notifiedAt).toEqual(SCAN);
  });
});

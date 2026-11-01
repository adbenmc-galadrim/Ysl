import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import { mergeContact } from '#/features/directory/contacts';
import { pullChanges } from '#/features/sync/pull';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  listParcelsOfCode,
  recordHandover,
  type HandoverRefusedError,
} from '#/features/handover/record-handover';
import { findActivePickupCode } from '#/features/handover/pickup-lookup';
import {
  departmentOfParcels,
  drawSecrets,
  pickupCodeWrites,
  recallSecrets,
} from '#/features/mail/pickup-code';
import { groupByRecipient } from '#/features/mail/recipients';
import { prepareNotification } from '#/features/mail/notifications';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

const FINANCE = newId();
const LEGAL = newId();

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const nora = personRow({
  firstName: 'Nora',
  lastName: 'Haddad',
  email: 'nora@example.com',
  departmentId: FINANCE,
});

async function group(parcels: ReturnType<typeof parcelRow>[]) {
  return groupByRecipient(parcels, await loadRecipientContext(db, parcels));
}

describe('one mail and one code per department', () => {
  it('writes two mails for parcels of two departments', async () => {
    await db.directoryPerson.put(nora);
    const here = parcelRow({ personId: nora.id, departmentId: FINANCE });
    const moved = parcelRow({ personId: nora.id, departmentId: LEGAL });

    const mails = await group([here, moved]);

    expect(mails.map((mail) => mail.departmentId).sort()).toEqual(
      [FINANCE, LEGAL].sort(),
    );
    expect(mails.map((mail) => mail.parcels.length)).toEqual([1, 1]);
  });

  it('keeps one mail when nothing has a department, as before the conversion', async () => {
    const before = personRow({ email: 'avant@example.com' });
    await db.directoryPerson.put(before);

    const mails = await group([
      parcelRow({ personId: before.id }),
      parcelRow({ personId: before.id }),
    ]);

    expect(mails).toHaveLength(1);
    expect(mails[0]?.key).toBe('avant@example.com');
    expect(mails[0]?.departmentId).toBeNull();
  });

  it('reads the person’s department on a parcel the server has not answered for', async () => {
    await db.directoryPerson.put(nora);
    const parcel = parcelRow({ personId: nora.id });
    await db.parcel.put(parcel);

    expect((await group([parcel]))[0]?.departmentId).toBe(FINANCE);
    expect(await departmentOfParcels(db, [parcel.id])).toBe(FINANCE);
  });

  it('replaces the open code of the same department, not of another', async () => {
    const finance = await pickupCodeRow({
      personId: nora.id,
      departmentId: FINANCE,
    });
    const legal = await pickupCodeRow({
      personId: nora.id,
      departmentId: LEGAL,
      pinHash: 'autre',
    });
    await db.pickupCode.bulkPut([finance, legal]);
    const [secret] = await drawSecrets(db, 1, { now: NOW });

    const writes = await pickupCodeWrites(
      db,
      { personId: nora.id, contactId: null, departmentId: FINANCE },
      secret!,
      { now: NOW },
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]?.row).toMatchObject({ id: finance.id, deletedAt: NOW });
    expect(writes[1]?.row).toMatchObject({
      personId: nora.id,
      departmentId: FINANCE,
    });
  });

  it('stamps the code of a prepared mail with the department of its parcels', async () => {
    await db.directoryPerson.put(nora);
    const parcel = parcelRow({ personId: nora.id, departmentId: FINANCE });
    await db.parcel.put(parcel);
    const [pickup] = await drawSecrets(db, 1, { now: NOW });

    await prepareNotification(
      db,
      {
        type: 'avis',
        personId: nora.id,
        recipients: [nora.email],
        parcelIds: [parcel.id],
        templateId: null,
        target: null,
        pickup,
      },
      { userId: 'agent-1', now: NOW },
    );

    const [code] = await db.pickupCode.toArray();
    expect(code?.departmentId).toBe(FINANCE);
  });

  it('a reminder quotes the code of its own department', async () => {
    const legal = await pickupCodeRow({
      personId: nora.id,
      departmentId: LEGAL,
    });
    await db.pickupCode.put(legal);

    const [other] = await recallSecrets(
      db,
      [{ personId: nora.id, contactId: null, departmentId: FINANCE }],
      { now: NOW },
    );
    const [same] = await recallSecrets(
      db,
      [{ personId: nora.id, contactId: null, departmentId: LEGAL }],
      { now: NOW },
    );

    expect(other?.codeId).toBeUndefined();
    expect(same?.codeId).toBe(legal.id);
  });
});

describe('a handover on a code', () => {
  const input = (code: string, parcelIds: string[]) => ({
    kind: 'person' as const,
    id: nora.id,
    via: 'pin' as const,
    at: NOW.getTime(),
    code,
    parcelIds,
  });

  async function seed() {
    await db.directoryPerson.put(nora);
    const here = parcelRow({
      personId: nora.id,
      departmentId: FINANCE,
      status: 'notifie',
      notifiedAt: NOW,
    });
    const elsewhere = parcelRow({
      personId: nora.id,
      departmentId: LEGAL,
      status: 'notifie',
      notifiedAt: NOW,
    });
    await db.parcel.bulkPut([here, elsewhere]);
    const code = await pickupCodeRow({
      personId: nora.id,
      departmentId: FINANCE,
    });
    await db.pickupCode.put(code);
    return { here, elsewhere, code };
  }

  it('refuses a parcel of another department', async () => {
    const { elsewhere, code } = await seed();

    await expect(
      recordHandover(db, input(code.id, [elsewhere.id]), {
        agentId: 'agent-1',
        now: NOW,
      }),
    ).rejects.toMatchObject({
      reason: 'mismatch',
    } satisfies Partial<HandoverRefusedError>);
  });

  it('refuses offline a copy left here of a department this iPhone no longer holds', async () => {
    const { code } = await seed();
    await db.department.put({
      id: LEGAL,
      name: 'Juridique',
      receptionPoint: null,
      replyEmail: null,
      pickup: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });

    expect(
      (await findActivePickupCode(db, 'token', code.tokenHash, NOW)).status,
    ).toBe('unknown');
    await db.department.put({
      id: FINANCE,
      name: 'Finance',
      receptionPoint: null,
      replyEmail: null,
      pickup: null,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
    });
    expect(
      (await findActivePickupCode(db, 'token', code.tokenHash, NOW)).status,
    ).toBe('active');
  });

  it('lists only what the code opens, and all for a code of before', async () => {
    const { here, elsewhere, code } = await seed();
    const person = { kind: 'person' as const, id: nora.id };

    expect(
      (await listParcelsOfCode(db, person, code.id)).map((p) => p.id),
    ).toEqual([here.id]);
    await db.pickupCode.update(code.id, { departmentId: null });
    expect(
      (await listParcelsOfCode(db, person, code.id)).map((p) => p.id).sort(),
    ).toEqual([here.id, elsewhere.id].sort());
  });

  it('closes the code once its own department has nothing left, whatever waits elsewhere', async () => {
    const { here, code } = await seed();

    await recordHandover(db, input(code.id, [here.id]), {
      agentId: 'agent-1',
      now: NOW,
    });

    expect((await db.pickupCode.get(code.id))?.usedAt).toEqual(NOW);
  });
});

describe('a handover by name', () => {
  const byName = (parcelIds: string[]) => ({
    kind: 'person' as const,
    id: nora.id,
    via: 'manuel' as const,
    at: NOW.getTime(),
    parcelIds,
  });
  const waitingIn = (departmentId: string) =>
    parcelRow({
      personId: nora.id,
      departmentId,
      status: 'notifie',
      notifiedAt: NOW,
    });

  it('closes the code of each department left empty, not of one with a parcel left', async () => {
    await db.directoryPerson.put(nora);
    const financeLeft = waitingIn(FINANCE);
    const financeTaken = waitingIn(FINANCE);
    const legalTaken = waitingIn(LEGAL);
    await db.parcel.bulkPut([financeLeft, financeTaken, legalTaken]);
    const finance = await pickupCodeRow({
      personId: nora.id,
      departmentId: FINANCE,
    });
    const legal = await pickupCodeRow({
      personId: nora.id,
      departmentId: LEGAL,
    });
    await db.pickupCode.bulkPut([finance, legal]);

    await recordHandover(db, byName([financeTaken.id, legalTaken.id]), {
      agentId: 'agent-1',
      now: NOW,
    });

    expect((await db.pickupCode.get(finance.id))?.usedAt).toBeNull();
    expect((await db.pickupCode.get(legal.id))?.usedAt).toEqual(NOW);
  });

  it('reads the person’s department on a parcel the server has not answered for', async () => {
    await db.directoryPerson.put(nora);
    const fresh = parcelRow({
      personId: nora.id,
      status: 'notifie',
      notifiedAt: NOW,
    });
    await db.parcel.put(fresh);
    const code = await pickupCodeRow({
      personId: nora.id,
      departmentId: FINANCE,
    });
    await db.pickupCode.put(code);

    await recordHandover(db, byName([fresh.id]), {
      agentId: 'agent-1',
      now: NOW,
    });

    expect((await db.pickupCode.get(code.id))?.usedAt).toEqual(NOW);
  });
});

describe('a contact merged into a person', () => {
  it('leaves the person’s code of another department open', async () => {
    const contact = contactRow({ name: 'Nora' });
    await db.contact.put(contact);
    await db.directoryPerson.put(nora);
    const older = new Date(NOW.getTime() - 60_000);
    const legal = await pickupCodeRow({
      personId: nora.id,
      departmentId: LEGAL,
      createdAt: older,
    });
    const finance = await pickupCodeRow({
      personId: null,
      contactId: contact.id,
      departmentId: FINANCE,
    });
    await db.pickupCode.bulkPut([legal, finance]);

    await mergeContact(db, contact.id, nora.id, {
      agentId: 'agent-1',
      now: NOW,
    });

    expect(await db.pickupCode.get(legal.id)).toMatchObject({
      deletedAt: null,
      personId: nora.id,
    });
    expect(await db.pickupCode.get(finance.id)).toMatchObject({
      deletedAt: null,
      personId: nora.id,
      contactId: null,
    });
  });
});

describe('offline, on the device of a department', () => {
  it('does not know the code of another department, which never reached it', async () => {
    const generation = newId();
    const finance = await pickupCodeRow({
      personId: nora.id,
      departmentId: FINANCE,
    });
    const legalHash = 'b'.repeat(64);
    await pullChanges(db, () =>
      Promise.resolve({
        generation,
        reset: false,
        rows: [{ entity: 'pickup_code', row: finance }],
        next: null,
        cursor: 10,
      }),
    );

    expect(
      await findActivePickupCode(db, 'token', finance.tokenHash, NOW),
    ).toMatchObject({ status: 'active' });
    expect(await findActivePickupCode(db, 'token', legalHash, NOW)).toEqual({
      status: 'unknown',
    });
  });

  it('announces the departments and stores them', async () => {
    const seen: unknown[] = [];
    const id = newId();
    await pullChanges(db, (input) => {
      seen.push(input.departments);
      return Promise.resolve({
        generation: newId(),
        reset: false,
        rows: [
          {
            entity: 'department',
            row: { id, name: 'Finance', deletedAt: null },
          },
        ],
        next: null,
        cursor: 10,
      });
    });

    expect(seen).toEqual([true]);
    expect((await db.department.get(id))?.name).toBe('Finance');
  });
});

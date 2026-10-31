import 'fake-indexeddb/auto';
import {
  DEFAULT_OPERATING_PROFILE,
  OPERATING_PROFILE_KEY,
  type OperatingProfile,
  SMALL_SITE_OPERATING_PROFILE,
} from '@repo/contract/operating-profile';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addTypedDraft,
  finishBatch,
  openBatch,
  typedDraft,
  updateDraft,
} from '#/features/batch/store';
import { countBatch } from '#/features/batch/summary';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftRecipient,
} from '#/features/db/schema';
import { loadPendingMails } from '#/features/mail/pending-mails';
import {
  assignDepartment,
  assignRecipient,
  completeTracking,
} from '#/features/parcels/complete';
import { editOf, saveParcelEdit } from '#/features/parcels/edit';
import { reviewOf } from '#/features/review/model';
import {
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const TRACKED = {
  carrier: 'UPS',
  tracking: '1ZE6344W0499230622',
  trackingNorm: '1ZE6344W0499230622',
};
const ON_TOUR: OperatingProfile = {
  ...DEFAULT_OPERATING_PROFILE,
  shuttleActsAsDepartment: false,
};

const toCard = (id: string): DraftRecipient => ({
  kind: 'person',
  id,
  name: 'Camille Morel',
  source: 'agent',
});

let db: CourrierDatabase;

const useProfile = (value: OperatingProfile) =>
  db.setting.put({
    id: 'operating-1',
    key: OPERATING_PROFILE_KEY,
    value,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt: null,
    updatedBy: 'admin-1',
  });

const addDepartment = (
  id: string,
  name: string,
  deletedAt: Date | null = null,
) =>
  db.department.put({
    id,
    name,
    receptionPoint: null,
    replyEmail: null,
    pickup: null,
    createdAt: NOW,
    updatedAt: NOW,
    deletedAt,
  });

/** One parcel the review would call ready, saved as a batch. */
async function saved(extra: Partial<DraftParcel>) {
  const batch = await openBatch(db, NOW);
  const draft = typedDraft(batch.id, TRACKED, NOW);
  await addTypedDraft(db, draft);
  await updateDraft(db, draft.id, { trackingConfirmed: true, ...extra });
  const [id] = await finishBatch(db, {
    batchId: batch.id,
    agentId: 'agent-1',
    now: NOW,
  });
  return (await db.parcel.get(id!))!;
}

beforeEach(async () => {
  db = await openTestDatabase();
  await addDepartment('finance', 'Finance');
  await addDepartment('legal', 'Juridique');
  await db.directoryPerson.bulkPut([
    personRow({ id: 'in-finance', departmentId: 'finance', email: 'f@t.test' }),
    personRow({ id: 'nowhere', departmentId: null, email: 'n@t.test' }),
  ]);
});

describe('a batch saved under a shuttle acting as department', () => {
  it.each([
    ['the small site', SMALL_SITE_OPERATING_PROFILE],
    ['no profile on this device', null],
  ])(
    'with %s, stays received, its department the server’s',
    async (_, value) => {
      if (value) await useProfile(value);
      const parcel = await saved({ recipient: toCard('in-finance') });
      expect(parcel.status).toBe('recu');
      expect(parcel).not.toHaveProperty('departmentId');
      expect(
        (await db.outbox.toArray())
          .filter((op) => op.entity === 'event')
          .map((op) => op.patch.type),
      ).toEqual([]);
      expect(
        (await loadPendingMails(db)).map((mail) => mail.parcels.length),
      ).toEqual([1]);
    },
  );

  it('keeps a recipient without a department received', async () => {
    await useProfile(SMALL_SITE_OPERATING_PROFILE);
    expect((await saved({ recipient: toCard('nowhere') })).status).toBe('recu');
  });
});

describe('a batch saved with a tour', () => {
  beforeEach(() => useProfile(ON_TOUR));

  it('leaves on tour with the department of the recipient, and traces it', async () => {
    const parcel = await saved({ recipient: toCard('in-finance') });
    expect(parcel).toMatchObject({
      status: 'en_route',
      departmentId: 'finance',
    });
    const events = (await db.event.toArray()).map((row) => row.detail);
    expect(events).toContainEqual({ from: 'recu', to: 'en_route' });
    expect(countBatch([parcel]).onTour).toBe(1);
  });

  it('goes to the department chosen at the review', async () => {
    const parcel = await saved({
      recipient: toCard('in-finance'),
      departmentId: 'legal',
    });
    expect(parcel).toMatchObject({ status: 'en_route', departmentId: 'legal' });
  });

  it('prepares no mail yet', async () => {
    await saved({ recipient: toCard('in-finance') });
    expect(await loadPendingMails(db)).toEqual([]);
  });

  it('waits « À compléter » without a department', async () => {
    const parcel = await saved({ recipient: toCard('nowhere') });
    expect(parcel.status).toBe('a_completer');
    expect(parcel.departmentId ?? null).toBeNull();
  });

  it('does not send a parcel to an archived department', async () => {
    await addDepartment('closed', 'Fermé', NOW);
    const parcel = await saved({
      recipient: toCard('in-finance'),
      departmentId: 'closed',
    });
    expect(parcel).toMatchObject({
      status: 'en_route',
      departmentId: 'finance',
    });
  });

  it('takes a contact’s department from its word', async () => {
    await db.contact.put({
      id: 'c-1',
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      name: 'Coursier',
      email: null,
      department: ' juridique ',
      usageCount: 0,
      notifyVia: null,
    } as never);
    const parcel = await saved({
      recipient: {
        kind: 'contact',
        id: 'c-1',
        name: 'Coursier',
        source: 'agent',
      },
    });
    expect(parcel).toMatchObject({ status: 'en_route', departmentId: 'legal' });
  });
});

describe('a profile this device cannot read', () => {
  it('keeps the parcel received', async () => {
    await db.setting.put({
      id: 'operating-1',
      key: OPERATING_PROFILE_KEY,
      value: { shuttleActsAsDepartment: 'plus tard' },
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      updatedBy: 'admin-1',
    });
    expect((await saved({ recipient: toCard('in-finance') })).status).toBe(
      'recu',
    );
  });
});

describe('the review with a tour', () => {
  const draft = (extra: Partial<DraftParcel>): DraftParcel => ({
    ...typedDraft('b', TRACKED, NOW),
    trackingConfirmed: true,
    recipient: toCard('nowhere'),
    ...extra,
  });

  it('asks for a department only when the company has a tour', () => {
    expect(reviewOf(draft({})).group).toBe('ready');
    const asked = reviewOf(draft({}), () => null);
    expect(asked.group).toBe('toCheck');
    expect(asked.steps).toEqual([{ field: 'department' }]);
    expect(reviewOf(draft({}), () => 'finance').group).toBe('ready');
  });

  it('leaves a passed parcel to complete', () => {
    expect(reviewOf(draft({ reviewSkipped: true }), () => null).group).toBe(
      'toComplete',
    );
  });
});

describe('completing a parcel with a tour', () => {
  const options = { agentId: 'agent-1', now: NOW };
  const statuses = async () =>
    (await db.outbox.toArray())
      .filter((op) => op.entity === 'parcel')
      .map((op) => op.patch.status);

  beforeEach(() => useProfile(ON_TOUR));

  it('passes by « Reçu », one write at a time', async () => {
    const parcel = parcelRow({ status: 'a_completer', ...TRACKED });
    await db.parcel.put(parcel);
    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: 'in-finance' },
      { ...options, seesTracking: true },
    );
    expect(await statuses()).toEqual(['recu', 'en_route']);
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'en_route',
      statusSeq: 2,
      departmentId: 'finance',
    });
  });

  it('stays « À compléter » without a department, then leaves with one', async () => {
    const parcel = parcelRow({ status: 'a_completer', ...TRACKED });
    await db.parcel.put(parcel);
    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: 'nowhere' },
      { ...options, seesTracking: true },
    );
    expect((await db.parcel.get(parcel.id))?.status).toBe('a_completer');
    // The number stays a doubt until the agent vouches for it: a department does not.
    expect(await assignDepartment(db, parcel.id, 'legal', options)).toBe(
      'a_completer',
    );
    expect(
      await completeTracking(
        db,
        parcel.id,
        { kind: 'tracked', tracking: TRACKED.tracking, carrier: 'UPS' },
        options,
      ),
    ).toBe('en_route');
    expect(await db.parcel.get(parcel.id)).toMatchObject({
      status: 'en_route',
      departmentId: 'legal',
    });
  });

  it('leaves as soon as a department is all it lacks', async () => {
    const parcel = parcelRow({
      status: 'a_completer',
      type: 'sans_suivi',
      personId: 'nowhere',
      carrier: null,
    });
    await db.parcel.put(parcel);
    expect(await assignDepartment(db, parcel.id, 'legal', options)).toBe(
      'en_route',
    );
  });

  it('leaves once its number is completed', async () => {
    const parcel = parcelRow({
      status: 'a_completer',
      personId: 'in-finance',
      tracking: null,
      trackingNorm: null,
      carrier: null,
    });
    await db.parcel.put(parcel);
    expect(
      await completeTracking(
        db,
        parcel.id,
        { kind: 'tracked', tracking: TRACKED.tracking, carrier: 'UPS' },
        options,
      ),
    ).toBe('en_route');
  });

  it('comes off its tour when the form takes its recipient away', async () => {
    const parcel = parcelRow({
      status: 'en_route',
      personId: 'in-finance',
      departmentId: 'finance',
      ...TRACKED,
    });
    await db.parcel.put(parcel);
    await saveParcelEdit(
      db,
      parcel.id,
      { ...editOf(parcel), recipient: { kind: 'none' } },
      options,
    );
    expect(await statuses()).toEqual(['recu', 'a_completer']);
    expect((await db.parcel.get(parcel.id))?.status).toBe('a_completer');
  });

  it('is unchanged for the small site', async () => {
    await useProfile(SMALL_SITE_OPERATING_PROFILE);
    const parcel = parcelRow({ status: 'a_completer', ...TRACKED });
    await db.parcel.put(parcel);
    await assignRecipient(
      db,
      parcel.id,
      { kind: 'person', id: 'nowhere' },
      { ...options, seesTracking: true },
    );
    expect(await statuses()).toEqual(['recu']);
    expect((await db.parcel.get(parcel.id))?.status).toBe('recu');
  });
});

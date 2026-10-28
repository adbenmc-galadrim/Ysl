import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { newPickupToken } from '@repo/contract/pickup';
import { newId } from '@repo/shared/id';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  contactEntries,
  mergeContact,
  mergeTarget,
  saveContact,
} from '#/features/directory/contacts';
import {
  lookupPickupPin,
  lookupPickupText,
} from '#/features/handover/pickup-lookup';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
  pickupCodeRow,
} from './helpers/local-rows';

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const marc = () =>
  contactRow({
    name: 'Marc Petit',
    nameNorm: 'marc petit',
    email: 'marc.petit@prestataire.fr',
    department: 'Prestataire',
    usageCount: 2,
  });

describe('contactEntries', () => {
  it('lists the live contacts by name, with their department, e-mail or « Sans e-mail »', () => {
    const nina = contactRow({ name: 'Nina Roux', nameNorm: 'nina roux' });
    const gone = contactRow({ name: 'Ancien', deletedAt: NOW });

    expect(
      contactEntries([nina, marc(), gone]).map((e) => [e.name, e.detail]),
    ).toEqual([
      ['Marc Petit', 'Prestataire'],
      ['Nina Roux', 'Sans e-mail'],
    ]);
    expect(contactEntries([nina, marc()], 'presta')).toHaveLength(1);
  });
});

describe('a contact told through someone (YSL-72)', () => {
  it('says who was told for them last, instead of « Sans e-mail »', () => {
    const sophie = personRow({ firstName: 'Sophie', lastName: 'Martin' });
    const nina = contactRow({
      name: 'Nina Roux',
      nameNorm: 'nina roux',
      notifyVia: `person:${sophie.id}`,
    });

    expect(contactEntries([nina], '', [sophie]).map((e) => e.detail)).toEqual([
      'Prévenu via Sophie Martin',
    ]);
    expect(contactEntries([nina]).map((e) => e.detail)).toEqual([
      'Sans e-mail',
    ]);
  });
});

describe('mergeTarget', () => {
  it('finds the directory card of the same e-mail, or of the same name for a contact without one', () => {
    const card = personRow({
      firstName: 'Marc',
      lastName: 'Petit',
      nameNorm: 'marc petit',
      email: 'Marc.Petit@prestataire.fr',
    });
    const homonym = personRow({
      firstName: 'Marc',
      lastName: 'Petit',
      nameNorm: 'marc petit',
      email: 'marc.petit@studio.fr',
    });

    expect(mergeTarget(marc(), [card])?.id).toBe(card.id);
    expect(
      mergeTarget({ email: null, nameNorm: 'marc petit' }, [card])?.id,
    ).toBe(card.id);
    expect(
      mergeTarget({ email: null, nameNorm: 'marc petit' }, [card, homonym]),
    ).toBeNull();
  });
});

describe('saveContact', () => {
  it('refuses the e-mail of another contact, keeps one a directory card holds', async () => {
    const temp = contactRow({ name: 'Nina Roux', nameNorm: 'nina roux' });
    const other = marc();
    await db.contact.bulkPut([temp, other]);
    await db.directoryPerson.put(personRow());
    const draft = { name: 'Nina Roux', email: '', department: '' };

    expect(
      await saveContact(db, temp.id, {
        ...draft,
        email: 'MARC.PETIT@prestataire.fr',
      }),
    ).toMatchObject({ kind: 'duplicate', contact: { id: other.id } });
    expect(
      await saveContact(db, temp.id, { ...draft, email: 'nina@' }),
    ).toEqual({ kind: 'invalid', field: 'email' });
    expect(
      await saveContact(
        db,
        temp.id,
        { ...draft, email: ' Camille@example.com', department: 'Studio' },
        { now: NOW },
      ),
    ).toMatchObject({ kind: 'saved' });
    expect(await db.contact.get(temp.id)).toMatchObject({
      email: 'camille@example.com',
      department: 'Studio',
    });
  });
});

describe('mergeContact', () => {
  it('moves the parcels and learned names to the card, retires the contact, and writes nothing the second time', async () => {
    const temp = marc();
    const card = personRow({ email: 'marc.petit@prestataire.fr' });
    const parcel = parcelRow({
      personId: null,
      contactId: temp.id,
      department: 'Prestataire',
      status: 'notifie',
    });
    const alias = {
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      nameNorm: 'm petit',
      personId: null,
      contactId: temp.id,
      confirmations: 2,
    };
    await db.contact.put(temp);
    await db.directoryPerson.put(card);
    await db.parcel.put(parcel);
    await db.recipientAlias.put(alias);
    const options = { agentId: 'agent-1', now: NOW };

    expect(await mergeContact(db, temp.id, card.id, options)).toBe(1);

    expect(await db.parcel.get(parcel.id)).toMatchObject({
      personId: card.id,
      contactId: null,
      department: 'Prestataire',
      status: 'notifie',
    });
    expect(await db.recipientAlias.get(alias.id)).toMatchObject({
      personId: card.id,
      contactId: null,
      confirmations: 2,
    });
    expect((await db.contact.get(temp.id))?.deletedAt).toEqual(NOW);
    const events = await db.event.toArray();
    expect(events.map((row) => readParcelEvent(row.type, row.detail))).toEqual([
      { type: 'parcel.edited', fields: ['recipient'] },
    ]);
    const queued = await db.outbox.count();

    expect(await mergeContact(db, temp.id, card.id, options)).toBe(0);
    expect(await db.outbox.count()).toBe(queued);
  });

  const day = 24 * 60 * 60 * 1000;

  it('moves the contact’s open code to the card, so its QR and PIN still open', async () => {
    const temp = marc();
    const card = personRow({ email: 'marc.petit@prestataire.fr' });
    const token = newPickupToken();
    const code = await pickupCodeRow({ contactId: temp.id }, { token });
    const old = await pickupCodeRow(
      { contactId: temp.id, usedAt: NOW },
      { now: new Date(NOW.getTime() - 3 * day) },
    );
    await db.contact.put(temp);
    await db.directoryPerson.put(card);
    await db.pickupCode.bulkPut([code, old]);
    const later = new Date(NOW.getTime() + 60_000);

    await mergeContact(db, temp.id, card.id, {
      agentId: 'agent-1',
      now: later,
    });

    expect(await db.pickupCode.get(code.id)).toMatchObject({
      personId: card.id,
      contactId: null,
      deletedAt: null,
    });
    expect(await db.pickupCode.get(old.id)).toEqual(old);
    const match = await lookupPickupText(db, token, later);
    expect(match.status === 'active' && match.code.personId).toBe(card.id);
  });

  it('keeps the latest of two open codes on the card, and withdraws the other', async () => {
    const temp = marc();
    const card = personRow({ email: 'marc.petit@prestataire.fr' });
    const older = await pickupCodeRow(
      { personId: card.id },
      { now: new Date(NOW.getTime() - 2 * day) },
    );
    const latest = await pickupCodeRow({ contactId: temp.id }, { pin: '1234' });
    const stale = await pickupCodeRow(
      { contactId: temp.id },
      { now: new Date(NOW.getTime() - 40 * day) },
    );
    const mine = await pickupCodeRow({ personId: card.id }, { pin: '5555' });
    const theirs = await pickupCodeRow(
      { contactId: temp.id },
      { pin: '6666', now: new Date(NOW.getTime() - day) },
    );
    await db.contact.put(temp);
    await db.directoryPerson.put(card);
    const later = new Date(NOW.getTime() + 60_000);
    const options = { agentId: 'agent-1', now: later };

    await db.pickupCode.bulkPut([older, latest, stale]);
    await mergeContact(db, temp.id, card.id, options);
    const open = (await db.pickupCode.toArray()).filter(
      (row) => !row.deletedAt && !row.usedAt,
    );

    expect(open.map((row) => [row.id, row.personId])).toEqual(
      expect.arrayContaining([
        [latest.id, card.id],
        [stale.id, null],
      ]),
    );
    expect(open).toHaveLength(2);
    expect((await db.pickupCode.get(older.id))?.deletedAt).toEqual(later);
    expect((await lookupPickupPin(db, '1234', later)).status).toBe('active');

    const other = contactRow({ name: 'Marc P.', nameNorm: 'marc p' });
    await db.contact.put(other);
    await db.pickupCode.bulkPut([mine, { ...theirs, contactId: other.id }]);
    await db.pickupCode.update(latest.id, { usedAt: NOW });
    await mergeContact(db, other.id, card.id, options);

    expect((await db.pickupCode.get(mine.id))?.deletedAt).toBeNull();
    expect((await db.pickupCode.get(theirs.id))?.deletedAt).toEqual(later);
    expect((await lookupPickupPin(db, '6666', later)).status).toBe('replaced');
  });
});

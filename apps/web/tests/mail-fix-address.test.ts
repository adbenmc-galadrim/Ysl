import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import { cardOf, checkAddress, fixAddress } from '#/features/mail/fix-address';
import { addressOf } from '#/features/mail/recipients';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const options = { agentId: 'agent-1', now: NOW };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

describe('fixing an address', () => {
  it('writes a contact’s new address and drops the one typed on its parcels', async () => {
    const contact = contactRow({
      name: 'Marc Petit',
      email: 'm.petit@prestataire',
    });
    const parcel = parcelRow({
      contactId: contact.id,
      notificationEmail: 'm.petit@prestataire',
    });
    await db.contact.put(contact);
    await db.parcel.put(parcel);
    const card = await cardOf(db, { personId: null, contactId: contact.id });

    const fixed = await fixAddress(
      db,
      {
        card,
        parcelIds: [parcel.id],
        address: ' Marc.Petit@Prestataire.fr ',
        onCard: true,
      },
      options,
    );

    expect(fixed).toEqual({
      kind: 'fixed',
      address: 'marc.petit@prestataire.fr',
      wrote: 'card',
    });
    expect((await db.contact.get(contact.id))?.email).toBe(
      'marc.petit@prestataire.fr',
    );
    const after = (await db.parcel.get(parcel.id))!;
    expect(after.notificationEmail).toBeNull();
    const context = {
      people: new Map(),
      contacts: new Map([[contact.id, (await db.contact.get(contact.id))!]]),
    };
    expect(addressOf(after, context)).toBe('marc.petit@prestataire.fr');
    const ops = await db.outbox.toArray();
    expect(ops.map((op) => op.entity)).toEqual(['contact', 'parcel', 'event']);
  });

  it('refuses an address another card already holds', async () => {
    const nora = personRow({
      firstName: 'Nora',
      lastName: 'Haddad',
      email: 'nora@example.com',
    });
    const atelier = contactRow({
      name: 'Atelier',
      email: 'atelier@example.com',
    });
    const marc = contactRow({ name: 'Marc Petit' });
    await db.directoryPerson.put(nora);
    await db.contact.bulkPut([atelier, marc]);
    const card = await cardOf(db, { personId: null, contactId: marc.id });

    expect(await checkAddress(db, card, 'NORA@example.com', true)).toEqual({
      kind: 'duplicate',
      name: 'Nora Haddad',
    });
    expect(await checkAddress(db, card, 'atelier@example.com', true)).toEqual({
      kind: 'duplicate',
      name: 'Atelier',
    });
    expect(await checkAddress(db, card, 'atelier@example.com', false)).toEqual({
      kind: 'ok',
      address: 'atelier@example.com',
    });
    expect(await checkAddress(db, card, 'atelier@example', true)).toEqual({
      kind: 'invalid',
    });
  });

  it('sends a taken address to the parcels, never to a second card', async () => {
    const nora = personRow({ email: 'nora@example.com' });
    const marc = contactRow({ name: 'Marc Petit' });
    const parcel = parcelRow({ contactId: marc.id });
    await db.directoryPerson.put(nora);
    await db.contact.put(marc);
    await db.parcel.put(parcel);
    const card = await cardOf(db, { personId: null, contactId: marc.id });

    const fixed = await fixAddress(
      db,
      {
        card,
        parcelIds: [parcel.id],
        address: 'nora@example.com',
        onCard: true,
      },
      options,
    );

    expect(fixed).toMatchObject({ wrote: 'parcels' });
    expect((await db.contact.get(marc.id))?.email).toBeNull();
    expect((await db.parcel.get(parcel.id))?.notificationEmail).toBe(
      'nora@example.com',
    );
  });

  it('corrects a person the app added, never one synced from the company', async () => {
    const paul = personRow({
      firstName: 'Paul',
      lastName: 'Mercier',
      email: 'p.mercier@example',
    });
    const synced = personRow({ email: 'ines@example', source: 'entra' });
    const parcel = parcelRow({ personId: synced.id });
    await db.directoryPerson.bulkPut([paul, synced]);
    await db.parcel.put(parcel);

    const own = await cardOf(db, { personId: paul.id, contactId: null });
    expect(
      await checkAddress(db, own, 'paul.mercier@example.com', true),
    ).toEqual({ kind: 'ok', address: 'paul.mercier@example.com' });
    await fixAddress(
      db,
      {
        card: own,
        parcelIds: [],
        address: 'paul.mercier@example.com',
        onCard: true,
      },
      options,
    );
    expect((await db.directoryPerson.get(paul.id))?.email).toBe(
      'paul.mercier@example.com',
    );

    const company = await cardOf(db, { personId: synced.id, contactId: null });
    const fixed = await fixAddress(
      db,
      {
        card: company,
        parcelIds: [parcel.id],
        address: 'ines@example.com',
        onCard: true,
      },
      options,
    );
    expect(fixed).toMatchObject({ wrote: 'parcels' });
    expect((await db.directoryPerson.get(synced.id))?.email).toBe(
      'ines@example',
    );
    expect((await db.parcel.get(parcel.id))?.notificationEmail).toBe(
      'ines@example.com',
    );
  });

  it('writes on the parcels only when the box is unticked', async () => {
    const marc = contactRow({ name: 'Marc Petit', email: 'marc@old.example' });
    const parcel = parcelRow({ contactId: marc.id });
    await db.contact.put(marc);
    await db.parcel.put(parcel);
    const card = await cardOf(db, { personId: null, contactId: marc.id });

    const fixed = await fixAddress(
      db,
      {
        card,
        parcelIds: [parcel.id],
        address: 'marc@new.example',
        onCard: false,
      },
      options,
    );

    expect(fixed).toMatchObject({ wrote: 'parcels' });
    expect((await db.contact.get(marc.id))?.email).toBe('marc@old.example');
    expect((await db.parcel.get(parcel.id))?.notificationEmail).toBe(
      'marc@new.example',
    );
  });

  it('refuses a person the address of a contact', async () => {
    const paul = personRow({ firstName: 'Paul', lastName: 'Mercier' });
    const atelier = contactRow({
      name: 'Atelier',
      email: 'atelier@example.com',
    });
    await db.directoryPerson.put(paul);
    await db.contact.put(atelier);
    const card = await cardOf(db, { personId: paul.id, contactId: null });

    expect(await checkAddress(db, card, 'Atelier@example.com', true)).toEqual({
      kind: 'duplicate',
      name: 'Atelier',
    });
  });

  it('sends again to the address a person already shares with a contact', async () => {
    const nora = personRow({ email: 'nora@example.com' });
    const alias = contactRow({ name: 'N. Haddad', email: 'Nora@example.com' });
    await db.directoryPerson.put(nora);
    await db.contact.put(alias);
    const card = await cardOf(db, { personId: nora.id, contactId: null });

    expect(await checkAddress(db, card, 'nora@example.com', true)).toEqual({
      kind: 'ok',
      address: 'nora@example.com',
    });
  });
});

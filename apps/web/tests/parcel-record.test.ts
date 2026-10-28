import 'fake-indexeddb/auto';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CourrierDatabase,
  LocalEvent,
  OutboxOp,
} from '#/features/db/schema';
import { parcelEvent } from '#/features/parcels/events';
import { loadParcelRecord } from '#/features/parcels/api/parcel-record';
import { editOf, saveParcelEdit } from '#/features/parcels/edit';
import {
  describeRecord,
  formatTracking,
  type ParcelRecord,
} from '#/features/parcels/record';
import { changeParcelStatus } from '#/features/parcels/status';
import { saveContact } from '#/features/directory/contacts';
import { groupByRecipient } from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import {
  contactRow,
  handoverRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const options = { now: NOW, t, showUnsent: true };
const agent = { agentId: 'agent-1' };

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

async function record(id: string): Promise<ParcelRecord> {
  const loaded = await loadParcelRecord(db, id);
  if (!loaded) throw new Error('missing');
  return loaded;
}

const at = (hours: number, minutes = 0) =>
  new Date(2026, 9, 24, hours, minutes);

describe('describeRecord', () => {
  it('names the recipient, the place and the tracking number, and offers to notify', async () => {
    const person = personRow();
    await db.directoryPerson.put(person);
    const row = parcelRow({ personId: person.id });
    await db.parcel.put(row);

    const view = describeRecord(await record(row.id), options);

    expect(view).toMatchObject({
      recipient: 'Camille Morel',
      place: 'Studio',
      tracking: '1Z E63 44W 04 9923 0622',
      carrier: 'UPS',
      state: { title: 'Reçu à 10 h 42' },
      sync: 'synced',
    });
    expect(view.steps.map((step) => step.state)).toEqual([
      'current',
      'todo',
      'todo',
    ]);
    expect(view.action).toEqual({ kind: 'notify' });
  });

  it('says « Hors annuaire » and « Sans e-mail » for a contact without an address, until one is added', async () => {
    const marc = contactRow({
      name: 'Marc Petit',
      nameNorm: 'marc petit',
      department: 'Prestataire',
    });
    await db.contact.put(marc);
    const row = parcelRow({ personId: null, contactId: marc.id });
    await db.parcel.put(row);
    const email = async () =>
      describeRecord(await record(row.id), options).details.find(
        (item) => item.label === 'E-mail',
      )?.value;

    expect(describeRecord(await record(row.id), options)).toMatchObject({
      recipient: 'Marc Petit',
      place: 'Hors annuaire, Prestataire',
    });
    expect(await email()).toBe('Sans e-mail');

    await saveContact(db, marc.id, {
      name: 'Marc Petit',
      email: 'marc.petit@prestataire.fr',
      department: 'Prestataire',
    });

    expect(await email()).toBe('marc.petit@prestataire.fr');
    const parcels = await db.parcel.toArray();
    const [mail] = groupByRecipient(
      parcels,
      await loadRecipientContext(db, parcels),
    );
    expect(mail).toMatchObject({
      contactId: marc.id,
      address: 'marc.petit@prestataire.fr',
    });
  });

  it('tells the history newest first, the reception last', async () => {
    const row = parcelRow({ readName: 'C. MOREL' });
    await db.parcel.put(row);
    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), weightKg: '2', notes: 'Fragile' },
      { ...agent, now: at(11) },
    );
    await db.outbox.clear();

    const view = describeRecord(await record(row.id), options);

    expect(
      view.history?.map(({ title, detail }) => ({ title, detail })),
    ).toEqual([
      { title: 'Modifié : note, poids', detail: 'Aujourd’hui à 11 h 00' },
      { title: 'Reçu', detail: 'Aujourd’hui à 10 h 42' },
    ]);
  });

  it('says the step back that was taken, and offers the next one', async () => {
    const row = parcelRow({ personId: 'p-1' });
    await db.parcel.put(row);
    await changeParcelStatus(db, row.id, 'notifie', { ...agent, now: at(11) });
    await changeParcelStatus(db, row.id, 'recu', { ...agent, now: at(11, 30) });
    await changeParcelStatus(db, row.id, 'notifie', {
      ...agent,
      now: at(11, 45),
    });

    const view = describeRecord(await record(row.id), options);

    expect(view.history?.map((entry) => entry.title)).toEqual([
      'Notifié',
      'Notification annulée',
      'Notifié',
      'Reçu',
    ]);
    expect(view.action).toEqual({
      kind: 'stepBack',
      from: 'notifie',
      to: 'recu',
    });
  });

  it('says when the last reminder left and how many went', async () => {
    const day = (date: number) => new Date(2026, 9, date, 10);
    const row = parcelRow({
      personId: 'p-1',
      status: 'notifie',
      receivedAt: day(15),
      notifiedAt: day(16),
      lastNotifiedAt: day(22),
    });
    await db.parcel.put(row);
    const mail = (date: number, kind: 'avis' | 'relance') =>
      parcelEvent(
        row.id,
        { type: 'parcel.notified', notificationId: newId(), kind },
        { agentId: 'agent-1', now: day(date) },
      ).row as LocalEvent;
    await db.event.bulkPut([
      mail(16, 'avis'),
      mail(20, 'relance'),
      mail(22, 'relance'),
    ]);

    const view = describeRecord(await record(row.id), options);

    expect(view.state).toMatchObject({
      icon: 'mail',
      title: 'Relance envoyée le 22 oct. à 10 h 00',
      description: 'Relancé 2 fois, en attente de retrait.',
    });
    expect(view.history?.map((entry) => entry.title)).toEqual([
      'Relance envoyée',
      'Relance envoyée',
      'Notifié par e-mail',
      'Reçu',
    ]);

    const late = describeRecord(await record(row.id), {
      ...options,
      now: new Date(2026, 9, 27, 12),
    });
    expect(late.state).toMatchObject({
      icon: 'clock',
      description: 'En attente depuis 11 jours, relancé 2 fois',
    });
  });

  it('says who was told for a recipient without an address: through a contact, or in person (F25)', async () => {
    const marc = contactRow({ name: 'Marc Petit', nameNorm: 'marc petit' });
    await db.contact.put(marc);
    const relayed = parcelRow({
      contactId: marc.id,
      status: 'notifie',
      notifiedAt: at(11),
    });
    const told = parcelRow({
      contactId: marc.id,
      status: 'notifie',
      notifiedAt: at(11, 30),
    });
    const mailId = newId();
    await db.parcel.bulkPut([relayed, told]);
    await db.notification.put({
      id: mailId,
      createdAt: at(11),
      updatedAt: at(11),
      deletedAt: null,
      type: 'avis',
      personId: null,
      contactId: marc.id,
      recipients: ['sophie.martin@example.com'],
      cc: [],
      parcelIds: [relayed.id],
      templateId: null,
      status: 'sent',
      target: 'mailto',
      preparedAt: at(11),
      preparedBy: 'agent-1',
      openedAt: at(11),
      sentAt: at(11),
      failedReason: null,
      relayName: 'Sophie Martin',
    });
    await db.event.bulkPut(
      [
        parcelEvent(
          relayed.id,
          { type: 'parcel.notified', notificationId: mailId, kind: 'avis' },
          { agentId: 'agent-1', now: at(11) },
        ),
        parcelEvent(
          told.id,
          { type: 'parcel.informed', kind: 'avis' },
          { agentId: 'agent-1', now: at(11, 30) },
        ),
      ].map(({ row }) => row as LocalEvent),
    );

    const viaContact = describeRecord(await record(relayed.id), options);
    const inPerson = describeRecord(await record(told.id), options);

    expect(viaContact.details).toContainEqual({
      label: 'Prévenu',
      value: 'Via Sophie Martin',
    });
    expect(viaContact.history?.[0]?.title).toBe('Notifié via Sophie Martin');
    expect(inPerson.details).toContainEqual({
      label: 'Prévenu',
      value: 'De vive voix, aujourd’hui à 11 h 30',
    });
    expect(inPerson.history?.map((entry) => entry.title)).toEqual([
      'Prévenu de vive voix',
      'Reçu',
    ]);
  });

  it('shows a handover with its date, and no undo of it here', async () => {
    const row = parcelRow({
      personId: 'p-1',
      status: 'remis',
      receivedAt: new Date(2026, 9, 20, 8),
      notifiedAt: new Date(2026, 9, 20, 9),
      deliveredAt: new Date(2026, 9, 21, 12, 5),
      deliveredBy: 'agent-2',
    });
    await db.parcel.put(row);

    const view = describeRecord(await record(row.id), options);

    expect(view.state.title).toBe('Remis le 21 oct. à 12 h 05');
    expect(view.details).toContainEqual({
      label: 'Remis',
      value: 'Le 21 oct. à 12 h 05',
    });
    expect(view.history?.map((entry) => entry.title)).toEqual([
      'Remis',
      'Notifié',
      'Reçu',
    ]);
    expect(view.action).toBeUndefined();
  });

  it('keeps the handover on the record: to whom, when, which agent, how', async () => {
    const nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
    const at = new Date(2026, 9, 24, 11, 20);
    const row = parcelRow({
      personId: nora.id,
      status: 'remis',
      deliveredAt: at,
      deliveredBy: 'agent-1',
    });
    const handover = handoverRow({
      parcelIds: [row.id],
      personId: nora.id,
      delegateName: 'Lucas Martin',
      at,
    });
    await db.directoryPerson.put(nora);
    await db.parcel.put(row);
    await db.handover.put(handover);
    await db.event.put(
      parcelEvent(
        row.id,
        { type: 'parcel.delivered', handoverId: handover.id, method: 'pin' },
        { agentId: 'agent-1', now: at },
      ).row as LocalEvent,
    );

    const view = describeRecord(await record(row.id), options);

    expect(view.handover?.items).toEqual([
      { label: 'Remis à', value: 'Nora Haddad' },
      { label: 'Retiré par', value: 'Lucas Martin' },
      { label: 'Quand', value: 'Aujourd’hui à 11 h 20' },
      { label: 'Agent', value: 'Karim Benali' },
      { label: 'Méthode', value: 'Code vérifié' },
      { label: 'Synchronisation', value: 'À jour' },
    ]);
    expect(view.history?.[0]?.title).toBe(
      'Remis à Nora Haddad par Karim (code vérifié)',
    );
  });

  it('tells a signed handover on another iPhone: signed, the signature on the agent’s iPhone', async () => {
    const nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
    await db.directoryPerson.put(nora);
    const row = parcelRow({
      personId: nora.id,
      status: 'remis',
      deliveredAt: NOW,
      deliveredBy: 'agent-2',
    });
    const handover = handoverRow({
      parcelIds: [row.id],
      personId: nora.id,
      method: 'signature',
      agentId: 'agent-2',
      hasSignature: true,
    });
    await db.parcel.put(row);
    await db.handover.put(handover);

    const view = describeRecord(await record(row.id), options);

    expect(view.handover?.items).toContainEqual({
      label: 'Méthode',
      value: 'Signée',
    });
    expect(view.handover?.items).toContainEqual({
      label: 'Signature',
      value: 'Sur l’iPhone de l’agent',
    });
    expect(view.handover?.items.map((item) => item.label)).not.toContain(
      'Photo',
    );
  });

  it('says « Un agent » without a name, and when the handover was cancelled', async () => {
    const row = parcelRow({ personId: 'p-1', status: 'notifie' });
    const handover = handoverRow({
      parcelIds: [row.id],
      personId: 'p-1',
      method: 'manuel',
      agentName: null,
      at: at(10),
      cancelledAt: at(10, 5),
    });
    await db.parcel.put(row);
    await db.handover.put(handover);
    await db.outbox.add({
      opId: newId(),
      entity: 'handover',
      entityId: handover.id,
      type: 'upsert',
      patch: {},
      clientTs: NOW,
      state: 'queued',
      attempts: 0,
      lastError: null,
    });

    const items = describeRecord(await record(row.id), options).handover?.items;

    expect(items).toContainEqual({ label: 'Agent', value: 'Un agent' });
    expect(
      describeRecord(await record(row.id), { ...options, me: 'agent-1' })
        .handover?.items,
    ).toContainEqual({ label: 'Agent', value: 'Vous' });
    expect(items).toContainEqual({
      label: 'Méthode',
      value: 'Sans vérification',
    });
    expect(items).toContainEqual({
      label: 'Synchronisation',
      value: 'Non envoyé',
    });
    expect(items?.at(-1)).toEqual({
      label: 'Annulée',
      value: 'Aujourd’hui à 10 h 05',
    });
  });

  it('shows no handover card before the parcel is handed over', async () => {
    const row = parcelRow();
    await db.parcel.put(row);

    expect(
      describeRecord(await record(row.id), options).handover,
    ).toBeUndefined();
  });

  it('puts a refused change before one only waiting', async () => {
    const row = parcelRow();
    await db.parcel.put(row);
    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), notes: 'A' },
      { ...agent, now: NOW },
    );
    const [op] = await db.outbox.where('entity').equals('parcel').toArray();
    await db.outbox.update((op as OutboxOp).seq, {
      state: 'rejected',
      lastError: 'Données invalides, à corriger sur l’appareil.',
    });

    const view = describeRecord(await record(row.id), options);

    expect(view.sync).toBe('rejected');
    expect(view.notice).toMatchObject({
      tone: 'red',
      description: 'Données invalides, à corriger sur l’appareil.',
    });
    expect(view.details).toContainEqual({
      label: 'Synchronisation',
      value: 'Refusé',
    });
  });

  it('keeps quiet about a change about to leave while online', async () => {
    const row = parcelRow();
    await db.parcel.put(row);
    await saveParcelEdit(
      db,
      row.id,
      { ...editOf(row), notes: 'A' },
      { ...agent, now: NOW },
    );

    const online = describeRecord(await record(row.id), {
      ...options,
      showUnsent: false,
    });
    const offline = describeRecord(await record(row.id), options);

    expect(online.notice).toBeUndefined();
    expect(offline.notice).toMatchObject({ tone: 'orange' });
    expect(offline.history?.[0]).toMatchObject({ tone: 'orange' });
  });

  it('tells why an imported parcel needs a look', async () => {
    const flags = [
      [
        ['tracking-rejected', 'status-unknown'],
        'Importé de la v1, tracking douteux',
      ],
      [['status-unknown'], 'Importé de la v1, statut inconnu'],
      [['recipient-missing'], 'Importé de la v1, sans destinataire'],
      [[], 'Importé de la v1'],
    ] as const;
    for (const [list, title] of flags) {
      const row = parcelRow({ status: 'a_completer' });
      await db.parcel.put(row);
      await db.event.put({
        id: newId(),
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        entity: 'parcel',
        entityId: row.id,
        type: 'parcel.imported',
        actorId: 'admin-1',
        at: at(11),
        detail: { flags: [...list] },
      });

      const view = describeRecord(await record(row.id), options);

      expect(view.history?.[0]?.title).toBe(title);
    }
  });

  it('asks to complete a parcel without a recipient', async () => {
    const row = parcelRow({ status: 'a_completer', readName: 'C. MOREL' });
    await db.parcel.put(row);

    const view = describeRecord(await record(row.id), options);

    expect(view).toMatchObject({
      recipient: 'Destinataire inconnu',
      place: 'Nom lu sur l’étiquette : C. MOREL',
      action: { kind: 'complete' },
    });
  });

  it('finds nothing for a deleted parcel', async () => {
    const row = parcelRow({ deletedAt: NOW });
    await db.parcel.put(row);

    expect(await loadParcelRecord(db, row.id)).toBeNull();
  });
});

describe('formatTracking', () => {
  it('groups a UPS number as UPS prints it, the others by four', () => {
    expect(formatTracking('1ZE6344W0499230622')).toBe(
      '1Z E63 44W 04 9923 0622',
    );
    expect(formatTracking('6A12345678901')).toBe('6A12 3456 7890 1');
  });
});

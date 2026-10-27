import 'fake-indexeddb/auto';
import { DEFAULT_TEMPLATES, renderMail } from '@repo/contract/mail';
import { damageColumns } from '@repo/contract/parcel-damage';
import { EMPTY_PICKUP } from '@repo/contract/settings';
import { newId } from '@repo/shared/id';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase } from '#/features/db/schema';
import {
  markFailed,
  markOpened,
  markSent,
  prepareNotification,
} from '#/features/mail/notifications';
import { drawPins, pinHash } from '#/features/mail/pickup-code';
import {
  groupByRecipient,
  mailsAbout,
  recipientValues,
  type RecipientMail,
} from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

let db: CourrierDatabase;

beforeEach(async () => {
  db = await openTestDatabase();
});

const nora = personRow({
  firstName: 'Nora',
  lastName: 'Haddad',
  nameNorm: 'nora haddad',
  email: 'Nora.Haddad@example.com',
});

async function group(parcels: ReturnType<typeof parcelRow>[]) {
  return groupByRecipient(parcels, await loadRecipientContext(db, parcels));
}

describe('one e-mail per recipient', () => {
  it('gathers a person’s received parcels, and a contact of the same address with them', async () => {
    const twin = contactRow({
      name: 'N. Haddad',
      email: 'nora.haddad@example.com',
    });
    await db.directoryPerson.put(nora);
    await db.contact.put(twin);
    const first = parcelRow({
      contactId: twin.id,
      receivedAt: new Date(2026, 9, 24, 9),
    });
    const second = parcelRow({
      personId: nora.id,
      receivedAt: new Date(2026, 9, 24, 10),
    });

    const mails = await group([second, first]);

    expect(mails).toHaveLength(1);
    expect(mails[0]).toMatchObject({
      personId: nora.id,
      contactId: null,
      name: 'Nora Haddad',
      address: 'Nora.Haddad@example.com',
    });
    expect(mails[0]?.parcels.map((parcel) => parcel.id)).toEqual([
      first.id,
      second.id,
    ]);
  });

  it('writes to the address typed on a parcel, apart from the person’s other mail', async () => {
    await db.directoryPerson.put(nora);
    const own = parcelRow({ personId: nora.id });
    const forwarded = parcelRow({
      personId: nora.id,
      notificationEmail: 'assistante@example.com',
    });

    const mails = await group([own, forwarded]);

    expect(mails.map((mail) => mail.address).sort()).toEqual([
      'Nora.Haddad@example.com',
      'assistante@example.com',
    ]);
  });

  it('leaves out parcels notified, deleted, still to complete or with nobody on them', async () => {
    await db.directoryPerson.put(nora);
    const mails = await group([
      parcelRow({ personId: nora.id, status: 'notifie', notifiedAt: NOW }),
      parcelRow({ personId: nora.id, deletedAt: NOW }),
      parcelRow({ personId: nora.id, status: 'a_completer' }),
      parcelRow({ readName: 'Nora H.' }),
    ]);

    expect(mails).toEqual([]);
  });

  it('keeps a contact without an address as its own block, with no address to write to', async () => {
    const marc = contactRow({ name: 'Marc Petit' });
    const atelier = contactRow({ name: 'Atelier' });
    await db.contact.bulkPut([marc, atelier]);

    const mails = await group([
      parcelRow({ contactId: marc.id }),
      parcelRow({ contactId: atelier.id }),
      parcelRow({ contactId: marc.id }),
    ]);

    expect(
      mails.map((mail) => [mail.name, mail.address, mail.parcels.length]),
    ).toEqual([
      ['Atelier', null, 1],
      ['Marc Petit', null, 2],
    ]);
    expect(mails[1]).toMatchObject({
      firstName: 'Marc',
      lastName: 'Marc Petit',
    });
  });
});

describe('the mails of one parcel’s recipient', () => {
  it('offers every mail of that person, an address typed on another parcel included', async () => {
    await db.directoryPerson.put(nora);
    const camille = personRow();
    await db.directoryPerson.put(camille);
    const opened = parcelRow({ personId: nora.id });
    const forwarded = parcelRow({
      personId: nora.id,
      notificationEmail: 'assistante@example.com',
    });
    const other = parcelRow({ personId: camille.id });

    const mails = mailsAbout(
      await group([opened, forwarded, other]),
      opened.id,
    );

    expect(mails.map((mail) => mail.address).sort()).toEqual([
      'Nora.Haddad@example.com',
      'assistante@example.com',
    ]);
  });
});

describe('the e-mail of one recipient', () => {
  const pickup = {
    ...EMPTY_PICKUP,
    place: 'Rez-de-chaussée, comptoir courrier',
    hours: { ...EMPTY_PICKUP.hours, mon: '9 h à 18 h' },
  };

  it('lists every parcel as a bullet and warns only about the damage the agent flagged', () => {
    const mail: RecipientMail = {
      key: 'nora',
      personId: nora.id,
      contactId: null,
      name: 'Nora Haddad',
      firstName: 'Nora',
      lastName: 'Haddad',
      address: nora.email,
      parcels: [
        parcelRow({
          carrier: 'Amazon',
          tracking: 'TBA0000004471',
          receivedAt: new Date(2026, 9, 24, 10, 15),
        }),
        parcelRow({
          tracking: '1ZE6344W0499230622',
          receivedAt: new Date(2026, 9, 14, 8),
          ...damageColumns({
            reason: 'mouille',
            note: 'coin',
            notifyRecipient: true,
            carrierReserve: false,
            at: NOW,
          }),
        }),
        parcelRow({
          carrier: 'DHL',
          tracking: '1234567890',
          ...damageColumns({
            reason: 'ouvert',
            note: null,
            notifyRecipient: false,
            carrierReserve: false,
            at: NOW,
          }),
        }),
      ],
    };

    const rendered = renderMail(
      DEFAULT_TEMPLATES.avis,
      recipientValues(mail, {
        pickup,
        agent: 'Karim',
        replyTo: null,
        code: '0427',
        now: NOW,
        t,
      }),
    );

    expect(rendered.missing).toEqual([]);
    expect(rendered.body).toContain('Bonjour Nora,');
    expect(rendered.body).toContain('Votre code de retrait : 0427');
    expect(rendered.body).toContain(
      [
        '• Amazon ···4471, reçu à 10 h 15',
        '• UPS ···0622, reçu le 14 oct.',
        '• DHL ···7890, reçu à 10 h 42',
        'Arrivé abîmé : UPS ···0622, mouillé (coin)',
      ].join('\n'),
    );
    expect(rendered.body).not.toContain('DHL ···7890, ouvert');
  });
});

describe('the pickup code', () => {
  it('draws PINs no live code uses, all different', async () => {
    await db.pickupCode.put({
      id: newId(),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      personId: nora.id,
      contactId: null,
      tokenHash: 'token',
      pinHash: await pinHash('0001'),
      expiresAt: new Date(NOW.getTime() + 1000),
      usedAt: null,
    });
    const draws = [1, 2, 2, 3];

    const pins = await drawPins(db, 2, {
      random: () => draws.shift()!,
      now: NOW,
    });

    expect(pins).toEqual(['0002', '0003']);
  });
});

describe('a mail from the tap to the confirmation', () => {
  async function prepare(parcelIds: string[], pin = '4821') {
    return prepareNotification(
      db,
      {
        type: 'avis',
        personId: nora.id,
        recipients: [nora.email],
        parcelIds,
        templateId: null,
        target: 'mailto',
        pickupPin: pin,
      },
      { userId: 'agent-1', now: NOW },
    );
  }

  it('makes the quoted code the person’s, retiring the open one before it', async () => {
    const parcel = parcelRow({ personId: nora.id });
    await db.parcel.put(parcel);
    await prepare([parcel.id], '1111');
    const before = await db.outbox.count();

    await prepare([parcel.id], '4821');

    const codes = await db.pickupCode
      .where('personId')
      .equals(nora.id)
      .toArray();
    const open = codes.filter((code) => !code.deletedAt);
    expect(open).toHaveLength(1);
    expect(open[0]?.pinHash).toBe(await pinHash('4821'));
    expect(JSON.stringify(codes)).not.toContain('4821');
    const ops = (await db.outbox.toArray()).slice(before);
    expect(
      ops.map((op) => [op.entity, op.patch.deletedAt ? 'retired' : 'live']),
    ).toEqual([
      ['pickup_code', 'retired'],
      ['pickup_code', 'live'],
      ['notification', 'live'],
    ]);
  });

  it('notifies every parcel once the agent says the mail left', async () => {
    const parcels = [
      parcelRow({ personId: nora.id }),
      parcelRow({ personId: nora.id }),
    ];
    await db.parcel.bulkPut(parcels);
    const mail = await prepare(parcels.map((parcel) => parcel.id));
    expect((await markOpened(db, mail.id, { now: NOW })).status).toBe('opened');

    await markSent(db, mail.id, { userId: 'agent-1', now: NOW });

    const rows = await db.parcel.bulkGet(parcels.map((parcel) => parcel.id));
    expect(rows.map((row) => row?.status)).toEqual(['notifie', 'notifie']);
    const events = await db.event.toArray();
    expect(events.map((event) => [event.type, event.entityId])).toEqual(
      parcels.map((parcel) => ['parcel.notified', parcel.id]),
    );
  });

  it('leaves the parcels received when the agent says it did not go', async () => {
    const parcel = parcelRow({ personId: nora.id });
    await db.parcel.put(parcel);
    const mail = await prepare([parcel.id]);
    await markOpened(db, mail.id, { now: NOW });

    await markFailed(db, mail.id, 'Non envoyé', { now: NOW });

    expect((await db.parcel.get(parcel.id))?.status).toBe('recu');
    expect(await db.event.count()).toBe(0);
  });
});

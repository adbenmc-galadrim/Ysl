import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  formatAgo,
  homeState,
  toParcelRow,
  type RecipientContext,
} from '#/features/parcels/model';
import { awaitsNotice, groupByRecipient } from '#/features/mail/recipients';
import { contactRow, NOW, parcelRow, personRow } from './helpers/local-rows';

const t = createTranslator('fr');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
/** A day of October 2026, at 10 a.m.: NOW is Saturday the 24th. */
const day = (date: number) => new Date(2026, 9, date, 10);
const parcel = parcelRow;
const camille = personRow();
const livreur = contactRow();

const context: RecipientContext = {
  people: new Map([[camille.id, camille]]),
  contacts: new Map([[livreur.id, livreur]]),
};

describe('homeState', () => {
  it('maps every status to its place on the home list', () => {
    expect(homeState(parcel({ status: 'a_completer' }), NOW)).toBe(
      'incomplete',
    );
    expect(homeState(parcel({ status: 'recu' }), NOW)).toBe('toNotify');
    expect(homeState(parcel({ status: 'en_route' }), NOW)).toBe('onTour');
    expect(homeState(parcel({ status: 'depose' }), NOW)).toBe('deposited');
    expect(homeState(parcel({ status: 'a_regulariser' }), NOW)).toBe(
      'toSettle',
    );
    expect(
      homeState(parcel({ status: 'notifie', notifiedAt: hoursAgo(47) }), NOW),
    ).toBe('notified');
    expect(
      homeState(
        parcel({ status: 'remis', deliveredAt: hoursAgo(2), deliveredBy: 'a' }),
        NOW,
      ),
    ).toBe('handedOver');
  });

  it('leaves out yesterday’s handovers, returns and deleted rows', () => {
    const yesterday = new Date(2026, 9, 23, 18, 0);
    expect(
      homeState(
        parcel({ status: 'remis', deliveredAt: yesterday, deliveredBy: 'a' }),
        NOW,
      ),
    ).toBeUndefined();
    expect(homeState(parcel({ status: 'retourne' }), NOW)).toBeUndefined();
    expect(homeState(parcel({ deletedAt: NOW }), NOW)).toBeUndefined();
  });

  it('calls a reminder due on the second working day, not 48 hours later', () => {
    // NOW is Saturday 24 October: a notice of Thursday is due on Monday.
    const thursday = parcel({ status: 'notifie', notifiedAt: day(22) });
    expect(homeState(thursday, NOW)).toBe('notified');
    expect(toParcelRow(thursday, context, NOW, t)).toMatchObject({
      remindDue: false,
      status: 'Notifié il y a 2 jours',
    });
    const wednesday = parcel({ status: 'notifie', notifiedAt: day(21) });
    expect(toParcelRow(wednesday, context, NOW, t)).toMatchObject({
      state: 'notified',
      remindDue: true,
      status: 'Notifié il y a 3 jours, à relancer',
    });
  });

  it('is « en souffrance » from the fifth working day without reminders', () => {
    expect(
      homeState(parcel({ status: 'notifie', notifiedAt: day(19) }), NOW),
    ).toBe('notified');
    const friday = parcel({ status: 'notifie', notifiedAt: day(16) });
    expect(toParcelRow(friday, context, NOW, t)).toMatchObject({
      state: 'late',
      remindDue: true,
      status: 'En attente depuis 8 jours',
    });
  });

  it('counts the reminders from the sent mails, two working days after the last', () => {
    const reminded = parcel({
      status: 'notifie',
      notifiedAt: day(16),
      lastNotifiedAt: day(22),
    });
    const recent = new Map([[reminded.id, [day(20), day(22)]]]);
    expect(toParcelRow(reminded, context, NOW, t, recent)).toMatchObject({
      state: 'notified',
      remindDue: false,
      status: 'Relancé il y a 2 jours',
    });
    const older = new Map([[reminded.id, [day(19), day(20)]]]);
    expect(
      toParcelRow(
        { ...reminded, lastNotifiedAt: day(20) },
        context,
        NOW,
        t,
        older,
      ),
    ).toMatchObject({
      state: 'late',
      remindDue: false,
      status: 'En attente depuis 8 jours, relancé 2 fois',
    });
  });

  it('counts a later notification as one reminder without the mails', () => {
    const reminded = parcel({
      status: 'notifie',
      notifiedAt: day(16),
      lastNotifiedAt: day(20),
    });
    expect(toParcelRow(reminded, context, NOW, t)).toMatchObject({
      state: 'late',
      status: 'En attente depuis 8 jours, relancé 1 fois',
    });
  });
});

describe('toParcelRow', () => {
  it('names the person of the directory before anything else', () => {
    const row = toParcelRow(
      parcel({ personId: camille.id, readName: 'C. MOREL' }),
      context,
      NOW,
      t,
    );
    expect(row).toMatchObject({
      recipient: 'Camille Morel',
      department: 'Studio',
      carrier: 'UPS',
      last4: '0622',
      state: 'toNotify',
      status: 'Reçu à 10 h 42',
      detail: 'Studio, UPS ···0622',
      tracking: '1ZE6344W0499230622',
    });
    expect(row?.note).toBeUndefined();
  });

  it('counts the boxes of a parcel in several pieces instead of its number', () => {
    const row = toParcelRow(
      parcel({ personId: camille.id, pieceN: 3, pieceTotal: 3 }),
      context,
      NOW,
      t,
    );
    expect(row?.detail).toBe('Studio, 3 colis UPS');
    expect(row?.pieces).toBe(3);
    const partial = toParcelRow(
      parcel({ personId: camille.id, pieceN: 1, pieceTotal: 3 }),
      context,
      NOW,
      t,
    );
    expect(partial?.detail).toBe('Studio, 1 sur 3 colis UPS');
  });

  it('says « Sans e-mail » in orange and offers « Prévenir » for a parcel to notify nobody can be written to', () => {
    const pierre = personRow({
      firstName: 'Pierre',
      lastName: 'Roy',
      email: '',
    });
    const people = { ...context, people: new Map([[pierre.id, pierre]]) };
    const toNotify = toParcelRow(
      parcel({ personId: pierre.id }),
      people,
      NOW,
      t,
    );
    expect(toNotify).toMatchObject({
      note: 'Sans e-mail',
      noteTone: 'orange',
      noAddress: true,
    });
    const typed = toParcelRow(
      parcel({ personId: pierre.id, notificationEmail: 'pierre@example.com' }),
      people,
      NOW,
      t,
    );
    expect(typed).toMatchObject({ noAddress: false });
    expect(typed?.note).toBeUndefined();
    const notified = toParcelRow(
      parcel({ contactId: livreur.id, status: 'notifie', notifiedAt: NOW }),
      context,
      NOW,
      t,
    );
    expect(notified).toMatchObject({ note: 'Sans e-mail', noAddress: false });
    expect(notified?.noteTone).toBeUndefined();
    expect(
      toParcelRow(parcel({ personId: camille.id }), context, NOW, t)?.noAddress,
    ).toBe(false);
  });

  it('falls back to the contact, said « Sans e-mail » without an address, then to the name read on the label', () => {
    const contact = toParcelRow(
      parcel({ contactId: livreur.id, readName: 'ATELIER RG' }),
      context,
      NOW,
      t,
    );
    expect(contact).toMatchObject({
      recipient: 'Atelier Rive gauche',
      department: '',
    });
    expect(contact?.note).toBe('Sans e-mail');
    const gone = { ...livreur, deletedAt: NOW };
    expect(
      toParcelRow(
        parcel({ contactId: livreur.id }),
        { ...context, contacts: new Map([[livreur.id, gone]]) },
        NOW,
        t,
      )?.note,
    ).toBeUndefined();

    const unknown = toParcelRow(
      parcel({
        status: 'a_completer',
        readName: 'L. FONTAIN',
        carrier: 'Colissimo',
        tracking: '6A12345677505',
      }),
      context,
      NOW,
      t,
    );
    expect(unknown).toMatchObject({
      recipient: 'Destinataire inconnu',
      state: 'incomplete',
      status: '',
      detail: 'Colissimo ···7505',
      note: 'Nom lu sur l’étiquette : L. FONTAIN',
    });
  });

  it('says in red what a parcel « À compléter » still lacks', () => {
    const row = (overrides: Parameters<typeof parcel>[0]) =>
      toParcelRow(
        parcel({ status: 'a_completer', personId: camille.id, ...overrides }),
        context,
        NOW,
        t,
      )?.status;
    expect(row({ tracking: null, carrier: null })).toBe('Numéro non lu');
    expect(row({ carrier: null })).toBe('Transporteur inconnu');
    expect(row({})).toBe('Numéro à vérifier');
    expect(row({ personId: null, tracking: null, carrier: null })).toBe(
      'Numéro non lu',
    );
  });

  it('hides the app’s own number of a parcel « Sans suivi »', () => {
    expect(
      toParcelRow(
        parcel({ type: 'sans_suivi', carrier: null, tracking: 'INT7K2Q9MXA' }),
        context,
        NOW,
        t,
      ),
    ).toMatchObject({ last4: '', detail: 'Sans suivi' });
  });

  it('describes a parcel without tracking by its kind', () => {
    const row = toParcelRow(
      parcel({ type: 'sans_suivi', carrier: null, tracking: null }),
      context,
      NOW,
      t,
    );
    expect(row).toMatchObject({
      carrier: 'Sans suivi',
      last4: '',
      detail: 'Sans suivi',
    });
  });

  it('tells how long ago the recipient was notified', () => {
    const notified = (notifiedAt: Date) =>
      toParcelRow(parcel({ status: 'notifie', notifiedAt }), context, NOW, t)
        ?.status;
    expect(notified(new Date(NOW.getTime() - 25 * 60_000))).toBe(
      'Notifié il y a 25 min',
    );
    expect(notified(hoursAgo(2))).toBe('Notifié il y a 2 h');
    expect(formatAgo(new Date(2026, 9, 23, 23, 0), NOW, t)).toBe('hier');
    expect(formatAgo(new Date(2026, 9, 22, 23, 0), NOW, t)).toBe(
      'il y a 2 jours',
    );
    expect(formatAgo(hoursAgo(30), hoursAgo(30), t)).toBe('à l’instant');
  });

  it('gives the handover time of the day', () => {
    const row = toParcelRow(
      parcel({
        status: 'remis',
        deliveredAt: new Date(2026, 9, 24, 9, 12),
        deliveredBy: 'agent-1',
      }),
      context,
      NOW,
      t,
    );
    expect(row).toMatchObject({
      state: 'handedOver',
      status: 'Remis à 9 h 12',
    });
  });
});

describe('a parcel « Reçu » in a company that runs tours', () => {
  it('waits to leave, not to be notified', () => {
    const received = parcel({ status: 'recu', personId: camille.id });
    expect(homeState(received, NOW, undefined, true)).toBe('toDispatch');
    expect(awaitsNotice(received, { tour: true, atScan: false })).toBe(false);
    expect(groupByRecipient([received], { ...context, tour: true })).toEqual(
      [],
    );
    expect(homeState(received, NOW)).toBe('toNotify');
    expect(awaitsNotice(received)).toBe(true);
  });
});

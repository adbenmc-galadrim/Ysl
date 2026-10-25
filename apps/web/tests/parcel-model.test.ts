import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  DAY_MS,
  formatAgo,
  homeState,
  LATE_AFTER_MS,
  toParcelRow,
  type RecipientContext,
} from '#/features/parcels/model';
import { contactRow, NOW, parcelRow, personRow } from './helpers/local-rows';

const t = createTranslator('fr');
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3600_000);
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
    expect(
      homeState(parcel({ status: 'notifie', notifiedAt: hoursAgo(47) }), NOW),
    ).toBe('notified');
    expect(
      homeState(parcel({ status: 'notifie', notifiedAt: hoursAgo(49) }), NOW),
    ).toBe('late');
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

  it('counts the wait from the last notification, the days from the first', () => {
    const reminded = parcel({
      status: 'notifie',
      notifiedAt: new Date(NOW.getTime() - LATE_AFTER_MS - DAY_MS),
      lastNotifiedAt: hoursAgo(20),
    });
    expect(homeState(reminded, NOW)).toBe('notified');
    expect(toParcelRow(reminded, context, NOW, t)?.status).toBe('Notifié hier');

    const stillLate = parcel({
      status: 'notifie',
      notifiedAt: new Date(NOW.getTime() - 5 * DAY_MS),
      lastNotifiedAt: new Date(NOW.getTime() - 3 * DAY_MS),
    });
    expect(homeState(stillLate, NOW)).toBe('late');
    expect(toParcelRow(stillLate, context, NOW, t)?.status).toBe(
      'En attente depuis 5 jours, relancé il y a 3 jours',
    );
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

  it('falls back to the contact, then to the name read on the label', () => {
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
    expect(contact?.note).toBeUndefined();

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

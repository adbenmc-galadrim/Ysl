import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { lotOutcomes } from '#/features/batch/outcomes';
import type { RecipientMail } from '#/features/mail/recipients';
import { parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);

function mail(address: string | null, parcels = 1): RecipientMail {
  return {
    key: address ?? 'contact:x',
    personId: null,
    contactId: 'x',
    name: 'Marc Petit',
    firstName: 'Marc',
    lastName: 'Petit',
    address,
    parcels: Array.from({ length: parcels }, () => parcelRow()),
  };
}

const NOTHING = { mails: [], toComplete: [], damaged: 0, pieces: 0 };

describe('the card of « Lot enregistré »', () => {
  it('counts the mails ready apart from the recipients without an e-mail', () => {
    const { rows, ready } = lotOutcomes(
      {
        ...NOTHING,
        mails: [mail('a@example.com', 2), mail('b@example.com'), mail(null)],
      },
      { online: true, t },
    );

    expect(ready).toBe(2);
    expect(rows.map((row) => [row.title, row.detail])).toEqual([
      ['2 e-mails prêts', '3 colis pour 2 personnes'],
      [
        '1 destinataire sans e-mail',
        'Ajouter l’adresse, prévenir un contact ou de vive voix',
      ],
    ]);
    expect(rows.map((row) => row.target?.to)).toEqual(['mails', 'otherWay']);
  });

  it('opens the record of a lone parcel to complete, and Colis for several', () => {
    const one = parcelRow({ status: 'a_completer' });
    expect(
      lotOutcomes({ ...NOTHING, toComplete: [one] }, { online: true, t })
        .rows[0],
    ).toMatchObject({
      title: '1 à compléter',
      target: { to: 'record', parcelId: one.id },
    });
    expect(
      lotOutcomes(
        { ...NOTHING, toComplete: [one, parcelRow({ status: 'a_completer' })] },
        { online: true, t },
      ).rows[0],
    ).toMatchObject({ title: '2 à compléter', target: { to: 'home' } });
  });

  it('says offline only when a mail is ready to leave', () => {
    const offline = (mails: RecipientMail[]) =>
      lotOutcomes({ ...NOTHING, mails }, { online: false, t }).rows.map(
        (row) => row.title,
      );
    expect(offline([mail('a@example.com')])).toContain('Hors ligne');
    expect(offline([mail(null)])).not.toContain('Hors ligne');
  });

  it('shows the reserve and the pieces only when there are some', () => {
    expect(lotOutcomes(NOTHING, { online: true, t }).rows).toEqual([]);
    expect(
      lotOutcomes(
        { ...NOTHING, damaged: 1, pieces: 2 },
        { online: true, t },
      ).rows.map((row) => row.title),
    ).toEqual(['1 avec réserve', '2 en plusieurs pièces']);
  });
});

import { readFileSync } from 'node:fs';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  readV1File,
  unguard,
  v1Carrier,
  v1Date,
  v1Status,
} from '#features/imports/v1-rows';

const t = createTranslator(DEFAULT_LOCALE);

const sample = readFileSync(
  new URL('./fixtures/v1-history.csv', import.meta.url),
  'utf8',
);

describe('unguard', () => {
  it('drops the quote the exports put before a formula only', () => {
    expect(unguard("'=SUM(A1)")).toBe('=SUM(A1)');
    expect(unguard("'+33 6 12")).toBe('+33 6 12');
    expect(unguard("'-2")).toBe('-2');
    expect(unguard("'@moi")).toBe('@moi');
    expect(unguard("'\tx")).toBe('\tx');
    expect(unguard("l'accueil")).toBe("l'accueil");
    expect(unguard("'Hélène'")).toBe("'Hélène'");
  });
});

describe('v1Status', () => {
  it('maps the v1 statuses, accents and case aside', () => {
    expect(v1Status('Recu')).toBe('recu');
    expect(v1Status('Reçu')).toBe('recu');
    expect(v1Status('NOTIFIE')).toBe('notifie');
    expect(v1Status('Notifié')).toBe('notifie');
    expect(v1Status('Remis')).toBe('remis');
    expect(v1Status('en  attente')).toBe('a_completer');
    expect(v1Status('Retourne')).toBe('retourne');
  });

  it('knows no other status, so none turns into Recu in silence', () => {
    expect(v1Status('Perdu')).toBeUndefined();
    expect(v1Status('Recus')).toBeUndefined();
  });
});

describe('v1Carrier', () => {
  it('names the carrier context of the v1 list', () => {
    expect(v1Carrier('UPS', t)).toBe('ups');
    expect(v1Carrier('FedEx', t)).toBe('fedex');
    expect(v1Carrier('DHL', t)).toBe('dhl-express');
    expect(v1Carrier('La Poste', t)).toBe('la-poste');
    expect(v1Carrier('Colis Privé', t)).toBe('colis-prive');
    expect(v1Carrier('Autre', t)).toBe('other');
    expect(v1Carrier('Coursier du coin', t)).toBeUndefined();
    expect(v1Carrier('', t)).toBeUndefined();
  });
});

describe('v1Date', () => {
  it('reads the ISO dates of the v1', () => {
    expect(v1Date('2026-03-02T08:15:00.000Z')).toEqual(
      new Date('2026-03-02T08:15:00.000Z'),
    );
  });

  it('reads the French dates of the v2 export in Paris time', () => {
    expect(v1Date('06/03/2026 14:05')).toEqual(
      new Date('2026-03-06T13:05:00.000Z'),
    );
    expect(v1Date('15/07/2026 14:05')).toEqual(
      new Date('2026-07-15T12:05:00.000Z'),
    );
    expect(v1Date('6/3/2026')).toEqual(new Date('2026-03-05T23:00:00.000Z'));
  });

  it('refuses what is no date', () => {
    expect(v1Date('')).toBeNull();
    expect(v1Date('hier')).toBeNull();
    expect(v1Date('31/02/2026')).toBeNull();
    expect(v1Date('2026-13-45')).toBeNull();
  });
});

describe('readV1File', () => {
  it('refuses a file without the tracking and recipient columns', () => {
    expect(readV1File('nom;email\nA;a@example.com', t)).toEqual({ ok: false });
    expect(readV1File('', t)).toEqual({ ok: false });
  });

  it('reads the sample v1 export', () => {
    const file = readV1File(sample, t);
    if (!file.ok) throw new Error('sample refused');
    const byLine = new Map(file.rows.map((row) => [row.line, row]));

    expect(file.rows.map((row) => row.line)).toEqual([
      2, 3, 4, 5, 6, 11, 12, 13,
    ]);
    expect(file.skips).toEqual([
      expect.objectContaining({ line: 7, reason: 'duplicate-in-file' }),
      expect.objectContaining({ line: 8, reason: 'duplicate-in-file' }),
      expect.objectContaining({ line: 9, reason: 'date-invalid' }),
      expect.objectContaining({ line: 10, reason: 'tracking-missing' }),
    ]);

    expect(byLine.get(2)).toMatchObject({
      recipient: 'Hélène Dupré',
      sender: 'Maison Lefèvre; Paris',
      notes: 'Fragile, "haut" en haut',
      carrier: 'UPS',
      status: 'recu',
      flags: [],
    });
    expect(byLine.get(4)).toMatchObject({
      status: 'remis',
      deliveredAt: new Date('2026-03-04T15:00:00.000Z'),
      pieces: 2,
      notes: "Laissé à l'accueil\r\nsignature au dos",
    });
    expect(byLine.get(5)).toMatchObject({
      status: 'a_completer',
      carrier: 'DHL Express',
      notes: '=HYPERLINK("x")',
      flags: [],
    });
    expect(byLine.get(11)).toMatchObject({
      status: 'remis',
      receivedAt: new Date('2026-03-06T13:05:00.000Z'),
      deliveredAt: new Date('2026-03-07T08:30:00.000Z'),
      flags: [],
    });
  });

  it('marks the false FedEx tracking of the v1 and keeps it out of Notifié', () => {
    const file = readV1File(sample, t);
    if (!file.ok) throw new Error('sample refused');
    expect(file.rows.find((row) => row.line === 3)).toMatchObject({
      tracking: '7185713569',
      status: 'a_completer',
      flags: ['tracking-rejected'],
    });
  });

  it('marks an unknown status and a row without recipient', () => {
    const file = readV1File(sample, t);
    if (!file.ok) throw new Error('sample refused');
    expect(file.rows.find((row) => row.line === 6)).toMatchObject({
      status: 'a_completer',
      flags: ['status-unknown'],
      unknownStatus: 'Perdu',
    });
    expect(file.rows.find((row) => row.line === 12)).toMatchObject({
      status: 'a_completer',
      flags: ['recipient-missing'],
    });
  });

  it('keeps a handed over parcel handed over when its tracking is doubtful', () => {
    const file = readV1File(
      [
        'id;date_reception;date_remise;statut;transporteur;tracking;destinataire;email',
        '1;2026-01-05T09:00:00Z;;Remis;FedEx;7185713569;Ana Ruiz;ana@example.com',
        '2;2026-01-05T09:00:00Z;;Remis;;7185713569;;',
      ].join('\n'),
      t,
    );
    if (!file.ok) throw new Error('refused');
    expect(file.rows[0]).toMatchObject({
      status: 'remis',
      deliveredAt: new Date('2026-01-05T09:00:00Z'),
      flags: ['tracking-rejected'],
    });
    expect(file.skips).toEqual([
      expect.objectContaining({ line: 3, reason: 'duplicate-in-file' }),
    ]);
  });

  it('reads a comma file whose optional columns are missing', () => {
    const file = readV1File(
      'tracking,destinataire,date_reception\n1ZE6344W0499230622,Ana Ruiz,2026-01-05T09:00:00Z',
      t,
    );
    expect(file).toMatchObject({
      ok: true,
      rows: [{ line: 2, carrier: 'UPS', status: 'recu', flags: [] }],
    });
  });
});

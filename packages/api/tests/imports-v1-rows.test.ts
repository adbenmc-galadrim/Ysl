import { readFileSync } from 'node:fs';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { textCell, toCsv } from '#features/exports/csv';
import {
  formatExportDate,
  PARCELS_CSV_HEADER,
} from '#features/exports/service';
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

  it('unwraps the number the v2 export writes as ="…"', () => {
    expect(unguard('="7185713569"')).toBe('7185713569');
    expect(unguard('="0012"')).toBe('0012');
    expect(unguard('=1+1')).toBe('=1+1');
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

  it('reads an ISO date without a zone in Paris time too', () => {
    expect(v1Date('2026-03-02T08:15:00')).toEqual(
      new Date('2026-03-02T07:15:00.000Z'),
    );
    expect(v1Date('2026-07-15 14:05')).toEqual(
      new Date('2026-07-15T12:05:00.000Z'),
    );
    expect(v1Date('2026-03-02T08:15:00+02:00')).toEqual(
      new Date('2026-03-02T06:15:00.000Z'),
    );
    expect(v1Date('2026-03-02 08:15:00+02:00')).toEqual(
      new Date('2026-03-02T06:15:00.000Z'),
    );
  });

  it('refuses what is no date', () => {
    expect(v1Date('')).toBeNull();
    expect(v1Date('hier')).toBeNull();
    expect(v1Date('31/02/2026')).toBeNull();
    expect(v1Date('2026-13-45')).toBeNull();
    expect(v1Date('06/03/2026 14:75')).toBeNull();
    expect(v1Date('2026-03-06 24:10')).toBeNull();
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
      2, 3, 4, 6, 7, 12, 13, 14,
    ]);
    expect(file.skips).toEqual([
      expect.objectContaining({ line: 8, reason: 'duplicate-in-file' }),
      expect.objectContaining({ line: 9, reason: 'duplicate-in-file' }),
      expect.objectContaining({ line: 10, reason: 'date-invalid' }),
      expect.objectContaining({ line: 11, reason: 'tracking-missing' }),
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
    expect(byLine.get(6)).toMatchObject({
      status: 'a_completer',
      carrier: 'DHL Express',
      notes: '=HYPERLINK("x")',
      flags: [],
    });
    expect(byLine.get(12)).toMatchObject({
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
    expect(file.rows.find((row) => row.line === 7)).toMatchObject({
      status: 'a_completer',
      flags: ['status-unknown'],
      unknownStatus: 'Perdu',
    });
    expect(file.rows.find((row) => row.line === 13)).toMatchObject({
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

  it('marks a recipient no name can be read from, so the row stays importable', () => {
    const file = readV1File(
      [
        'id;date_reception;statut;transporteur;tracking;destinataire;email',
        '1;2026-01-05T09:00:00Z;Notifie;UPS;1ZE6344W0499230622;-;',
        '2;2026-01-06T09:00:00Z;Remis;UPS;1ZE6344W0499230622;?;',
      ].join('\n'),
      t,
    );
    if (!file.ok) throw new Error('refused');
    expect(file.rows).toMatchObject([
      { status: 'a_completer', flags: ['recipient-missing'] },
      {
        status: 'a_completer',
        deliveredAt: null,
        flags: ['recipient-missing'],
      },
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

describe('readV1File on a file of the v2 export (#60)', () => {
  const received = new Date('2026-10-26T13:32:00Z');
  const delivered = new Date('2026-10-27T08:05:00Z');
  const v2Columns = ['Remis', 'Colis', '', '', '', '', '', ''];
  const csv = toCsv(PARCELS_CSV_HEADER, [
    [
      '01920000-0000-7000-8000-000000000001',
      formatExportDate(received),
      formatExportDate(delivered),
      'Remis',
      'FedEx',
      textCell('877974873338'),
      "Zoé O'Neil",
      'zoe.oneil@example.com',
      'Studio',
      '=Maison Lefèvre',
      '1',
      '-fragile; "haut"\nen haut',
      ...v2Columns,
    ],
    [
      '01920000-0000-7000-8000-000000000002',
      formatExportDate(received),
      '',
      'En attente',
      'FedEx',
      textCell('7185713569'),
      'Éloïse Martin',
      'eloise.martin@example.com',
      'RH',
      '',
      '1',
      '',
      ...v2Columns,
    ],
    [
      '01920000-0000-7000-8000-000000000003',
      formatExportDate(received),
      '',
      'Retourne',
      'UPS',
      textCell('1ZE6344W0499230622'),
      '@Hélène Dupré',
      '',
      '',
      '',
      '1',
      '',
      ...v2Columns,
    ],
  ]);

  it('reads back the trackings, dates and guarded cells it wrote', () => {
    expect(csv).toContain('"=""877974873338"""');
    expect(csv).toContain("'=Maison Lefèvre");
    expect(csv).toContain('26/10/2026 14:32');
    const file = readV1File(csv, t);
    if (!file.ok) throw new Error('export refused');

    expect(file.skips).toEqual([]);
    expect(file.rows).toMatchObject([
      {
        line: 2,
        sourceId: '01920000-0000-7000-8000-000000000001',
        tracking: '877974873338',
        trackingNorm: '877974873338',
        carrier: 'FedEx',
        receivedAt: received,
        deliveredAt: delivered,
        status: 'remis',
        sender: '=Maison Lefèvre',
        notes: '-fragile; "haut"\nen haut',
        flags: [],
      },
      {
        line: 4,
        tracking: '7185713569',
        status: 'a_completer',
        flags: ['tracking-rejected'],
      },
      {
        line: 5,
        tracking: '1ZE6344W0499230622',
        recipient: '@Hélène Dupré',
        status: 'retourne',
        flags: [],
      },
    ]);
  });
});

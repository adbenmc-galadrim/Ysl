import 'fake-indexeddb/auto';
import { GS } from '@repo/contract/codes';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CourrierDatabase, LocalExtraction } from '#/features/db/schema';
import { diagnosticText, initials } from '#/features/diagnostic/copy';
import { loadReading } from '#/features/diagnostic/load';
import { describeReading } from '#/features/diagnostic/model';
import { draftOf } from './helpers/drafts';
import { NOW, openTestDatabase, parcelRow } from './helpers/local-rows';

const t = createTranslator(DEFAULT_LOCALE);
const DHL = '5413337112';
const DAY = 24 * 60 * 60 * 1000;

/** A DHL Express label: number read twice without a key, names that disagree. */
const extraction = (
  overrides: Partial<LocalExtraction> = {},
): LocalExtraction => ({
  parcelId: 'p',
  version: 1,
  fields: {
    tracking: {
      value: DHL,
      confidence: 0.89,
      level: 'to-verify',
      flags: ['unkeyed'],
      sources: [
        { kind: '1d', format: 'Code128', confidence: 0.85, value: DHL },
        { kind: 'ocr', format: 'text', confidence: 0.65, value: DHL },
      ],
    },
    recipient: {
      value: 'CAMILLE MOREL',
      confidence: 0.82,
      level: 'to-verify',
      flags: ['conflict'],
      sources: [
        {
          kind: '2d',
          format: 'Aztec',
          confidence: 0.97,
          value: 'CAMILLE MOREL',
        },
      ],
      candidates: [
        {
          value: 'CAMILLE MOREL',
          confidence: 0.97,
          sources: [
            {
              kind: '2d',
              format: 'Aztec',
              confidence: 0.97,
              value: 'CAMILLE MOREL',
            },
          ],
        },
        {
          value: 'JEAN DUPUIS',
          confidence: 0.65,
          sources: [
            {
              kind: 'ocr',
              format: 'block',
              confidence: 0.65,
              value: 'JEAN DUPUIS',
            },
          ],
        },
      ],
    },
  },
  codes: [
    { format: 'Code128', text: DHL },
    { format: 'DataMatrix', text: `XQ4${GS}9P2` },
  ],
  ocrText: `DHL EXPRESS\nSHIP TO\nJEAN DUPUIS\nWAYBILL ${DHL}`,
  durations: { codesMs: 120, ocrMs: 900, fusionMs: 3 },
  provenance: 'device',
  createdAt: new Date(2026, 9, 20, 9, 0),
  ...overrides,
});

const stored = (row = extraction()) =>
  describeReading(
    { kind: 'stored', extraction: row, photoId: null },
    { t, now: NOW },
  );

describe('describeReading — one card per field', () => {
  it('shows two sources that agree and the cap of a number without a key', () => {
    const view = stored();
    if (view.kind !== 'reading') throw new Error('no reading');
    expect(view.fields[0]).toMatchObject({
      id: 'champ-tracking',
      label: 'Suivi',
      value: '5413 3371 12',
      status: 'warning',
      statusLabel: 'À vérifier',
      confidence: '0,89',
      sources: [
        { rank: '4', label: 'Code 1D Code128', confidence: '0,85' },
        { rank: '6', label: 'Texte imprimé', confidence: '0,65' },
      ],
      adjustments: [
        { label: 'Concordance de 2 sources', delta: '+0,10' },
        { label: 'Plafond sans clé de contrôle (0,89)', delta: '−0,06' },
      ],
    });
  });

  it('shows a contradiction, its malus and the value set aside', () => {
    const view = stored();
    if (view.kind !== 'reading') throw new Error('no reading');
    expect(view.fields[1]).toMatchObject({
      id: 'champ-recipient',
      sources: [{ rank: '1', label: 'Code 2D Aztec' }],
      adjustments: [{ label: 'Contradiction entre sources', delta: '−0,15' }],
      others: [{ value: 'JEAN DUPUIS', confidence: '0,65' }],
    });
  });

  it('marks the printed lines that fed a field, and tells unknown codes', () => {
    const view = stored();
    if (view.kind !== 'reading') throw new Error('no reading');
    expect(view.lines).toEqual([
      { text: 'DHL EXPRESS' },
      { text: 'SHIP TO' },
      { text: 'JEAN DUPUIS', mark: 'Destinataire' },
      { text: `WAYBILL ${DHL}`, mark: 'Suivi' },
    ]);
    expect(view.codes[1]).toEqual({
      format: 'DataMatrix',
      text: 'XQ4·9P2',
      parser: 'Non reconnu',
      recognized: false,
    });
    expect(view.facts.map((f) => f.value)).toEqual([
      '120 ms',
      '900 ms',
      '3 ms',
      '1',
    ]);
  });

  it('has nothing to show for a number typed by hand', () => {
    expect(stored(extraction({ codes: [], ocrText: null }))).toEqual({
      kind: 'empty',
      reason: 'never',
    });
  });
});

describe('loadReading — where the reading is, or why there is none', () => {
  let db: CourrierDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });

  it('reads the row kept at « Terminer »', async () => {
    await db.extraction.put(extraction());
    expect(await loadReading(db, 'p', NOW)).toMatchObject({ kind: 'stored' });
  });

  it('scores a draft of the batch in progress on the spot', async () => {
    await db.draftParcel.put(
      draftOf({ id: 'd', symbols: [{ format: 'Code128', text: DHL }] }),
    );
    expect(await loadReading(db, 'd', NOW)).toMatchObject({
      kind: 'draft',
      extraction: { parcelId: 'd', codes: [{ text: DHL }] },
    });
  });

  it('tells imported, purged and read elsewhere apart', async () => {
    const imported = parcelRow({ batchId: null });
    const old = parcelRow({
      batchId: 'b',
      receivedAt: new Date(NOW.getTime() - 31 * DAY),
    });
    const recent = parcelRow({
      batchId: 'b',
      receivedAt: new Date(NOW.getTime() - 2 * DAY),
    });
    await db.parcel.bulkPut([imported, old, recent]);
    expect(await loadReading(db, imported.id, NOW)).toEqual({
      kind: 'none',
      reason: 'never',
    });
    expect(await loadReading(db, old.id, NOW)).toEqual({
      kind: 'none',
      reason: 'purged',
    });
    expect(await loadReading(db, recent.id, NOW)).toEqual({
      kind: 'none',
      reason: 'elsewhere',
    });
  });
});

describe('diagnosticText — the copy for support', () => {
  it('keeps the scores and drops what is personal', () => {
    const text = diagnosticText(extraction(), { t, now: NOW });
    expect(text).toContain('Suivi : 5413 3371 12 — À vérifier (0,89)');
    expect(text).toContain('  [4] Code 1D Code128 : 0,85');
    expect(text).toContain('  Plafond sans clé de contrôle (0,89) : −0,06');
    expect(text).toContain('Destinataire : C. M. — À vérifier (0,82)');
    expect(text).toContain('  ≠ J. D. (0,65)');
    expect(text).toContain('Version des règles 1');
    expect(text).toContain('Fusion 3 ms');
    expect(text).toContain('DataMatrix — Non reconnu — 7 caractères');
    expect(text).not.toMatch(/CAMILLE|MOREL|DUPUIS|WAYBILL|XQ4/);
  });

  it('cuts a name to its initials', () => {
    expect(initials('  camille  Morel ')).toBe('C. M.');
  });
});

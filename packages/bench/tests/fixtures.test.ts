import { describe, expect, it } from 'vitest';
import type { CodeSymbol } from '@repo/contract/codes';
import { extractFields } from '@repo/contract/extract';
import {
  chronopostAztec,
  colissimoAztec,
  dpdAztec,
  fedexPdf417,
  laPosteDataMatrix,
  upsMaxiCode,
} from '@repo/corpus/src/synthetic/codes.ts';
import { recipientAddress } from '@repo/corpus/identities';
import {
  annotate,
  plan,
  type Planned,
} from '@repo/corpus/src/synthetic/plan.ts';
import { measure } from '#measure';
import { fieldStats, type LabelResult, objectives } from '#metrics';

const SEED = 20261022;
const PER_CARRIER = 12;

/** The codes each synthetic template prints, as text: no image in CI. */
const symbolsOf = (p: Planned): CodeSymbol[] => {
  const t = p.tracking.value;
  const code128 = (text: string) => ({ format: 'Code128', text });
  switch (p.carrier) {
    case 'colissimo':
      return [
        { format: 'Aztec', text: colissimoAztec(p) },
        code128(`%00${recipientAddress.postcode}11${t.slice(0, 12)}25025`),
      ];
    case 'chronopost':
      return [{ format: 'Aztec', text: chronopostAztec(p) }, code128(t)];
    case 'la-poste':
      return [{ format: 'DataMatrix', text: laPosteDataMatrix(p) }];
    case 'dhl-express':
      return [
        code128(t),
        code128(`2LFR${recipientAddress.postcode}+51000000`),
        code128(`JJD01460001${t}`),
      ];
    case 'ups':
      return [
        { format: 'MaxiCode', text: upsMaxiCode(p) },
        code128(`421250${recipientAddress.postcode}`),
        code128(t),
      ];
    case 'fedex':
      return [
        { format: 'PDF417', text: fedexPdf417(p) },
        code128(
          `9622${String(p.seed).padStart(10, '0').slice(0, 10)}0000${t}`.slice(
            0,
            34,
          ),
        ),
      ];
    case 'dpd':
      return [
        { format: 'Aztec', text: dpdAztec(p) },
        code128(`%00${recipientAddress.postcode}${t}101250`),
      ];
    case 'gls':
      return [code128(t)];
  }
};

const results: LabelResult[] = plan(SEED, PER_CARRIER).map((p) => {
  const label = annotate(p);
  return {
    id: label.id,
    source: 'synthetic',
    carrier: label.carrier,
    policy: 'text',
    reviewed: true,
    pdfSpecimen: false,
    trackingKnown: true,
    difficulties: [],
    formats: [],
    steps: [],
    decodeMs: 0,
    extractMs: 0,
    fields: measure(label, extractFields({ symbols: symbolsOf(p) })),
  };
});

const wrong = (field: string, only = '-wrong') =>
  results
    .flatMap((r) => r.fields.map((f) => ({ id: r.id, ...f })))
    .filter((f) => f.field === field && f.status.endsWith(only))
    .map((f) => `${f.id}: ${f.expected} → ${f.proposed} (${f.status})`);

describe('synthetic corpus as text fixtures', () => {
  it('covers 96 labels', () => {
    expect(results).toHaveLength(96);
  });

  it('O1: never proposes a wrong tracking as sure', () => {
    expect(wrong('tracking')).toEqual([]);
    const o1 = objectives(results).find((o) => o.id === 'O1')!;
    expect(o1.met).toBe(true);
  });

  it('O2: prefills the right tracking on at least 95 % of the labels', () => {
    const stats = fieldStats(results, 'tracking');
    expect(stats.exact).toBeGreaterThanOrEqual(0.95);
    expect(stats.sureOk).toBeGreaterThanOrEqual(6 * PER_CARRIER);
  });

  it('names the carrier without a false sure', () => {
    expect(wrong('carrier', 'sure-wrong')).toEqual([]);
    expect(fieldStats(results, 'carrier').exact).toBeGreaterThanOrEqual(0.95);
  });

  it('reads recipient, pieces and weight from the 2D codes without error', () => {
    for (const field of ['recipient', 'sender', 'pieces', 'weightKg']) {
      expect(wrong(field)).toEqual([]);
    }
    const recipient = fieldStats(results, 'recipient');
    expect(recipient.sureOk).toBe(4 * PER_CARRIER);
    expect(fieldStats(results, 'sender').sureOk).toBe(PER_CARRIER);
  });
});

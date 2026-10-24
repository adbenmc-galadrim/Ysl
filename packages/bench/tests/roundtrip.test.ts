import { beforeAll, describe, expect, it } from 'vitest';
import { type ReadableFormat, readSymbols } from '@repo/barcode';
import { initZxingNode } from '@repo/barcode/node';
import { extractFields } from '@repo/contract/extract';
import {
  colissimoAztec,
  dpdAztec,
  fedexPdf417,
  laPosteDataMatrix,
  upsMaxiCode,
} from '@repo/corpus/src/synthetic/codes.ts';
import { barcode, type Symbology } from '@repo/corpus/src/synthetic/barcode.ts';
import {
  annotate,
  plan,
  type Planned,
} from '@repo/corpus/src/synthetic/plan.ts';
import sharp from 'sharp';
import { rasterOf } from '#image';
import { measure } from '#measure';

const planned = plan(20261022, 1);
const byCarrier = (carrier: Planned['carrier']) =>
  planned.find((p) => p.carrier === carrier)!;

const roundTrip = async (
  p: Planned,
  bcid: Symbology,
  content: string,
  format: ReadableFormat,
) => {
  const png = await sharp(await barcode(bcid, content))
    .flatten({ background: '#ffffff' })
    .extend({ top: 60, bottom: 60, left: 60, right: 60, background: '#ffffff' })
    .png()
    .toBuffer();
  const symbols = await readSymbols(await rasterOf(png), {
    formats: [format],
    isPure: bcid === 'maxicode',
  });
  expect(symbols.map((s) => s.format)).toEqual([format]);
  expect(symbols[0]!.text).toBe(content);
  const outcomes = measure(annotate(p), extractFields({ symbols }));
  return Object.fromEntries(outcomes.map((o) => [o.field, o.status]));
};

describe('bwip-js → zxing-wasm → extractFields', () => {
  beforeAll(() => initZxingNode());

  it('keeps the ISO 15434 separators through an Aztec (Colissimo)', async () => {
    const p = byCarrier('colissimo');
    expect(
      await roundTrip(p, 'azteccode', colissimoAztec(p), 'Aztec'),
    ).toMatchObject({
      tracking: 'sure-ok',
      carrier: 'sure-ok',
      recipient: 'sure-ok',
      pieces: 'sure-ok',
      weightKg: 'sure-ok',
    });
  });

  it('reads the DPD Aztec', async () => {
    const p = byCarrier('dpd');
    expect(await roundTrip(p, 'azteccode', dpdAztec(p), 'Aztec')).toMatchObject(
      {
        tracking: 'sure-ok',
        carrier: 'sure-ok',
      },
    );
  });

  it('reads the FedEx PDF417 with its sender', async () => {
    const p = byCarrier('fedex');
    expect(
      await roundTrip(p, 'pdf417', fedexPdf417(p), 'PDF417'),
    ).toMatchObject({
      tracking: 'sure-ok',
      sender: 'sure-ok',
    });
  });

  it('recomposes the UPS tracking from a pure MaxiCode', async () => {
    const p = byCarrier('ups');
    expect(
      await roundTrip(p, 'maxicode', upsMaxiCode(p), 'MaxiCode'),
    ).toMatchObject({
      tracking: 'sure-ok',
      carrier: 'sure-ok',
      pieces: 'sure-ok',
    });
  });

  it('reads the La Poste Data Matrix', async () => {
    const p = byCarrier('la-poste');
    expect(
      await roundTrip(p, 'datamatrix', laPosteDataMatrix(p), 'DataMatrix'),
    ).toMatchObject({ tracking: 'sure-ok', carrier: 'sure-ok' });
  });
});

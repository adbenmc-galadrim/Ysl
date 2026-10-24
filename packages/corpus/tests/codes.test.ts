import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { parseCode } from '@repo/contract/codes';
import { validateTracking } from '@repo/contract/tracking';
import { barcode } from '#synthetic/barcode';
import {
  chronopostAztec,
  colissimoAztec,
  dpdAztec,
  fedexPdf417,
  laPosteDataMatrix,
  upsMaxiCode,
} from '#synthetic/codes';
import { plan, type Planned, type SyntheticCarrier } from '#synthetic/plan';

const builders = {
  colissimo: colissimoAztec,
  chronopost: chronopostAztec,
  dpd: dpdAztec,
  fedex: fedexPdf417,
  ups: upsMaxiCode,
  'la-poste': laPosteDataMatrix,
} satisfies Partial<Record<SyntheticCarrier, (p: Planned) => string>>;

const planned = plan(7, 4);
const byCarrier = (carrier: SyntheticCarrier) =>
  planned.filter((p) => p.carrier === carrier);

describe('synthetic 2D codes read back by the parsers', () => {
  it.each(Object.keys(builders) as (keyof typeof builders)[])(
    '%s: the tracking of the plan comes back sure with its carrier',
    (carrier) => {
      for (const p of byCarrier(carrier)) {
        const code = parseCode(builders[carrier](p));
        expect(code?.carrier).toBe(carrier);
        const [tracking] = code!.trackings;
        expect(tracking?.value).toBe(p.tracking.value);
        expect(validateTracking(tracking!.value, tracking).status).toBe('sure');
      }
    },
  );

  it.each(['colissimo', 'chronopost', 'dpd', 'fedex'] as const)(
    '%s: recipient, pieces and weight come back without OCR',
    (carrier) => {
      for (const p of byCarrier(carrier)) {
        const code = parseCode(builders[carrier](p));
        expect(code?.recipient?.name).toBe(p.recipient.toUpperCase());
        expect(code?.recipient?.postalCode).toBe('75007');
        expect(code?.recipient?.country).toBe('FR');
        expect(code?.pieces).toEqual(p.pieces);
        expect(code?.weightKg).toBe(p.weightKg);
      }
    },
  );

  it('fedex: the sender travels in the 06 envelope', () => {
    const p = byCarrier('fedex')[0]!;
    expect(parseCode(fedexPdf417(p))?.sender?.name).toBe(
      p.sender.name.toUpperCase(),
    );
  });

  it('ups: the shipper account comes from the MaxiCode', () => {
    const p = byCarrier('ups')[0]!;
    expect(parseCode(upsMaxiCode(p))?.shipperAccount).toBe(
      p.tracking.value.slice(2, 8),
    );
  });

  it('the templates draw their 2D codes from these constructors', async () => {
    const source = await readFile(
      new URL('../src/synthetic/templates.ts', import.meta.url),
      'utf8',
    );
    const calls = [
      ...source.matchAll(
        /barcode\(\s*'(azteccode|pdf417|maxicode|datamatrix)',\s*(\w+\(p\)|`[^`]*`)/g,
      ),
    ];
    expect(calls.map(([, bcid, content]) => `${bcid}:${content}`)).toEqual([
      'azteccode:colissimoAztec(p)',
      'azteccode:chronopostAztec(p)',
      'datamatrix:laPosteDataMatrix(p)',
      'maxicode:upsMaxiCode(p)',
      'pdf417:fedexPdf417(p)',
      'azteccode:dpdAztec(p)',
      expect.stringMatching(/^datamatrix:`\$\{p\.tracking\.value\}\|/),
      expect.stringMatching(/^datamatrix:`\$\{p\.recipient\}\|/),
    ]);
  });

  it('bwip-js encodes every constructor with its separators', async () => {
    const symbologies = {
      colissimo: 'azteccode',
      chronopost: 'azteccode',
      dpd: 'azteccode',
      fedex: 'pdf417',
      ups: 'maxicode',
      'la-poste': 'datamatrix',
    } as const;
    for (const carrier of Object.keys(builders) as (keyof typeof builders)[]) {
      const p = byCarrier(carrier)[0]!;
      await expect(
        barcode(symbologies[carrier], builders[carrier](p)),
      ).resolves.toBeInstanceOf(Buffer);
    }
  });
});

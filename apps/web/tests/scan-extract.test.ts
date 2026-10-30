import { describe, expect, it } from 'vitest';
import { missingFormats } from '#/features/scan/expected-formats';
import { extractTracking } from '#/features/scan/extract';

describe('extractTracking', () => {
  it('names the carrier of a valid 1D code', () => {
    expect(
      extractTracking([{ format: 'Code128', text: '1Z E63 44W 04 9923 0622' }]),
    ).toMatchObject({
      context: 'ups',
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      trackingNorm: '1ZE6344W0499230622',
    });
  });

  it('reads the Geopost code behind the Colissimo number', () => {
    const geopost = '%0012345' + '11' + '8J02299079' + '75' + '012345';
    expect(
      extractTracking([{ format: 'Code128', text: geopost }]),
    ).toMatchObject({ context: 'colissimo', tracking: '8J02299079750' });
  });

  it('reads the tracking of a structured 2D code with its carrier', () => {
    const GS = '\u001d';
    const aztec = `[)>\u001e01${GS}02${GS}0075007${GS}250${GS}801${GS}118J0229907975${GS}GEOP`;
    expect(extractTracking([{ format: 'Aztec', text: aztec }])).toMatchObject({
      context: 'colissimo',
      carrier: 'Colissimo',
      tracking: '8J02299079750',
    });
  });

  it('prefers a sure number over one to verify', () => {
    const toVerify = { format: 'Code128', text: '5413337112' };
    expect(extractTracking([toVerify])).toMatchObject({
      context: 'dhl-express',
    });
    const found = extractTracking([
      toVerify,
      { format: 'Code128', text: '1ZE6344W0499230622' },
    ]);
    expect(found).toMatchObject({ context: 'ups' });
  });

  it('prefers a number that names its carrier over a bare SSCC', () => {
    const found = extractTracking([
      { format: 'Code128', text: '(00)340434122150000874' },
      { format: 'Code128', text: '1ZE6344W0499230622' },
    ]);
    expect(found).toMatchObject({
      context: 'ups',
      tracking: '1ZE6344W0499230622',
    });
  });

  it('falls back to the 1D envelopes when a structured code has no tracking', () => {
    const GS = '\u001d';
    const maxicode = `[)>\u001e01${GS}9675007${GS}250${GS}004${GS}1Z99230623${GS}UPSN${GS}E6344W`;
    expect(
      extractTracking([
        { format: 'MaxiCode', text: maxicode },
        { format: 'Code128', text: '1ZE6344W0499230622' },
      ]),
    ).toMatchObject({ context: 'ups', tracking: '1ZE6344W0499230622' });
  });

  it('finds nothing in a code that is no tracking number', () => {
    expect(extractTracking([{ format: 'QRCode', text: 'https://x.y' }])).toBe(
      null,
    );
    expect(extractTracking([])).toBe(null);
  });
});

describe('missingFormats', () => {
  it('asks for the 2D symbol the carrier prints', () => {
    expect(missingFormats('ups', [{ format: 'Code128' }])).toEqual([
      'MaxiCode',
    ]);
    expect(
      missingFormats('ups', [{ format: 'Code128' }, { format: 'MaxiCode' }]),
    ).toEqual([]);
    expect(missingFormats('dhl-express', [{ format: 'Code128' }])).toEqual([
      'Code39',
      'DataMatrix',
    ]);
    expect(missingFormats(null, [])).toEqual([]);
    expect(missingFormats('gls', [{ format: 'Code128' }])).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { parseIso15434 } from '@repo/contract/codes';
import { validateTracking } from '@repo/contract/tracking';

const GS = '\u001d';
const RS = '\u001e';
const US = '\u001f';
const EOT = '\u0004';

const envelope = (...fields: string[]) => fields.join(GS);

const geopost = (
  version: string,
  postal: string,
  countryCode: string,
  service: string,
  tracking: string,
  network: string,
  tail = `${RS}07${GS}G03${GS}0${GS}0${GS}0${GS}${US}${US}+33612345678${US}${US}F~75007${US}${EOT}`,
) =>
  `[)>${RS}01${GS}` +
  envelope(
    version,
    postal,
    countryCode,
    service,
    tracking,
    network,
    '123456',
    '',
    '',
    '001/002',
    '00.50KG',
    'N',
    '24 RUE DE L UNIVERSITE',
    'PARIS',
    '',
    'CAMILLE MOREL',
  ) +
  GS +
  tail;

describe('ISO 15434 transport envelope (format 01)', () => {
  it('reads the Colissimo Aztec and rebuilds the ID13 with its key', () => {
    const code = parseIso15434(
      geopost('02', '0075007', '250', '801', '118J0229907975', 'GEOP'),
    );
    expect(code).toMatchObject({
      scheme: 'iso15434',
      carrier: 'colissimo',
      trackings: [{ value: '8J02299079750', context: 'colissimo' }],
      recipient: {
        name: 'CAMILLE MOREL',
        street: '24 RUE DE L UNIVERSITE',
        city: 'PARIS',
        postalCode: '75007',
        country: 'FR',
        phone: '+33612345678',
      },
      pieces: { index: 1, total: 2 },
      weightKg: 0.5,
      service: '801',
      shipperAccount: '123456',
    });
    const [tracking] = code!.trackings;
    expect(validateTracking(tracking!.value, tracking).status).toBe('sure');
  });

  it('tells Chronopost by its network code', () => {
    const code = parseIso15434(
      geopost('03', '75007', '250', '925', 'HA915306631JB', 'CHRO'),
    );
    expect(code?.carrier).toBe('chronopost');
    expect(code?.trackings).toEqual([
      { value: 'HA915306631JB', context: 'chronopost' },
    ]);
  });

  it('tells DPD from Colissimo on the GeoPost network by the tracking shape', () => {
    const code = parseIso15434(
      geopost('02', '10115', '276', '328', '10464000209404', 'GEOP'),
    );
    expect(code?.carrier).toBe('dpd');
    expect(code?.trackings).toEqual([
      { value: '10464000209404', context: 'dpd' },
    ]);
    expect(code?.recipient?.country).toBe('DE');
  });

  it('leaves the carrier open on a GeoPost code with an unknown tracking', () => {
    const code = parseIso15434(
      geopost('02', '75007', '250', '328', 'XX123', 'GEOP'),
    );
    expect(code?.carrier).toBeNull();
    expect(code?.trackings).toEqual([{ value: 'XX123' }]);
  });

  it('reads the FedEx PDF417 with its version glued to the postal code', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope(
        '0275007',
        '250',
        '020',
        '877974873338',
        'FDE',
        '510087000',
        '296',
        '',
        '1/1',
        '2.20LB',
        'N',
        '24 RUE DE L UNIVERSITE',
        'PARIS',
        'IDF',
        'CAMILLE MOREL',
      ) +
      `${RS}06${GS}10ZGD003${GS}11ZACME CORP${GS}12Z0123456789${GS}31Z12345678901234567890${RS}${EOT}`;
    const code = parseIso15434(text);
    expect(code).toMatchObject({
      carrier: 'fedex',
      trackings: [{ value: '877974873338', context: 'fedex' }],
      recipient: {
        name: 'CAMILLE MOREL',
        city: 'PARIS',
        region: 'IDF',
        postalCode: '75007',
        country: 'FR',
      },
      sender: { name: 'ACME CORP', phone: '0123456789' },
      pieces: { index: 1, total: 1 },
      weightKg: 0.998,
      service: '020',
      shipperAccount: '510087000',
    });
    expect(code?.fields['10Z']).toBe('GD003');
    expect(code?.fields['31Z']).toBe('12345678901234567890');
  });

  const ups = (tracking: string, account = 'E6344W', service = '004') =>
    `[)>${RS}01${GS}` +
    envelope(
      '9675007',
      '250',
      service,
      tracking,
      'UPSN',
      account,
      '296',
      '',
      '1/1',
      '3',
      'N',
      '',
      'PARIS',
      '',
    ) +
    `${RS}${EOT}`;

  it('rebuilds the UPS 1Z from the MaxiCode and keeps it when its key holds', () => {
    const code = parseIso15434(ups('1Z99230622'));
    expect(code).toMatchObject({
      carrier: 'ups',
      trackings: [{ value: '1ZE6344W0499230622', context: 'ups' }],
      shipperAccount: 'E6344W',
      weightKg: 1.361,
      recipient: { city: 'PARIS', postalCode: '75007', country: 'FR' },
    });
  });

  it('drops a rebuilt 1Z whose key fails but still names UPS', () => {
    const code = parseIso15434(ups('1Z99230623'));
    expect(code?.carrier).toBe('ups');
    expect(code?.trackings).toEqual([]);
  });

  it('rebuilds the 1Z from a 10-character field without the prefix', () => {
    const code = parseIso15434(ups('0412345679', 'AB12C3', '089'));
    expect(code?.trackings).toEqual([
      { value: '1ZAB12C30412345679', context: 'ups' },
    ]);
  });

  it('never applies the service rule to a field without the 1Z prefix', () => {
    expect(parseIso15434(ups('12345675', 'AB12C3', '089'))?.trackings).toEqual(
      [],
    );
  });

  it('takes a full 1Z as is', () => {
    const code = parseIso15434(ups('1ZE6344W0499230622', 'E6344W', '068'));
    expect(code?.trackings).toEqual([
      { value: '1ZE6344W0499230622', context: 'ups' },
    ]);
  });
});

describe('ISO 15434 tolerance', () => {
  it('returns null without the message header', () => {
    expect(parseIso15434('8J02299079750')).toBeNull();
    expect(parseIso15434(`[)>${RS}06${GS}11ZACME${RS}${EOT}`)).toBeNull();
    expect(parseIso15434('')).toBeNull();
  });

  it('returns null when the transport envelope has no version', () => {
    expect(
      parseIso15434(`[)>${RS}01${GS}${envelope('75007', '250', '801')}`),
    ).toBeNull();
  });

  it('omits every field that does not fit its shape', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope(
        '02',
        '',
        'FRA',
        '801',
        '118J0229907975',
        'GEOP',
        '',
        '',
        '',
        'A/B',
        '',
        'N',
        '',
        '',
        '',
        '',
      ) +
      `${RS}${EOT}`;
    const code = parseIso15434(text);
    expect(code).toEqual({
      scheme: 'iso15434',
      carrier: 'colissimo',
      trackings: [{ value: '8J02299079750', context: 'colissimo' }],
      service: '801',
      fields: {
        version: '02',
        country: 'FRA',
        service: '801',
        trackingNumber: '118J0229907975',
        scac: 'GEOP',
        pieces: 'A/B',
        addressValidation: 'N',
      },
    });
  });

  it('omits a piece count whose index exceeds its total', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope(
        '02',
        '75007',
        '250',
        '801',
        '118J0229907975',
        'GEOP',
        '',
        '',
        '',
        '3/2',
      ) +
      `${RS}${EOT}`;
    expect(parseIso15434(text)?.pieces).toBeUndefined();
  });

  it('still reads the tracking of an envelope cut after it', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope('03', '75007', '250', '925', 'HA915306631JB', 'CHRO');
    expect(parseIso15434(text)?.trackings).toEqual([
      { value: 'HA915306631JB', context: 'chronopost' },
    ]);
  });

  it('names FedEx behind the Ground SCAC codes', () => {
    for (const scac of ['RPSB', 'RPSC', 'FDEG']) {
      const text =
        `[)>${RS}01${GS}` +
        envelope('02', '75007', '250', '092', '9611020987654312345672', scac) +
        `${RS}${EOT}`;
      expect(parseIso15434(text)?.carrier).toBe('fedex');
    }
  });

  it('keeps the FedEx 34-digit code and its 12 last digits', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope(
        '02',
        '75007',
        '250',
        '020',
        '9622001560001234567100794808390594',
        'FDEG',
      ) +
      `${RS}${EOT}`;
    expect(parseIso15434(text)?.trackings).toEqual([
      { value: '794808390594', context: 'fedex' },
      { value: '9622001560001234567100794808390594', context: 'fedex' },
    ]);
  });

  it('reads the 12-digit number at the head of a 16-digit field', () => {
    const text =
      `[)>${RS}01${GS}` +
      envelope('02', '75007', '250', '020', '7946447901310441', 'FDE') +
      `${RS}${EOT}`;
    expect(parseIso15434(text)?.trackings).toEqual([
      { value: '794644790131', context: 'fedex' },
      { value: '7946447901310441', context: 'fedex' },
    ]);
  });
});

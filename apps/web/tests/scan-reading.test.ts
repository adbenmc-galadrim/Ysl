import { EOT, GS, RS } from '@repo/contract/codes';
import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { toScanReading } from '#/features/scan/reading';

const t = createTranslator('fr');

const symbol = (format: string, text: string, isValid = true) => ({
  format,
  text,
  isValid,
  position: {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 1, y: 0 },
    bottomRight: { x: 1, y: 1 },
    bottomLeft: { x: 0, y: 1 },
  },
  orientation: 0,
});

describe('toScanReading', () => {
  it('lists one mono field per symbol, labelled by its format', () => {
    const reading = toScanReading(
      { symbols: [symbol('Code128', 'AB123'), symbol('DataMatrix', 'XY9')] },
      t,
    );
    expect(reading).toEqual({
      kind: 'read',
      fields: [
        { label: 'Code 128', value: 'AB123', mono: true },
        { label: 'Data Matrix', value: 'XY9', mono: true },
      ],
    });
  });

  it('flags an invalid symbol as doubtful', () => {
    const reading = toScanReading(
      { symbols: [symbol('QRCode', 'x', false)] },
      t,
    );
    expect(reading).toMatchObject({
      kind: 'read',
      fields: [{ label: 'QR', status: 'warning' }],
    });
  });

  it('shows the name the OCR read when no code or no tracking was read', () => {
    const text = { ocrName: 'Camille Morel' };
    expect(toScanReading({ symbols: [] }, t, text)).toEqual({
      kind: 'read',
      fields: [
        { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
      ],
    });
    expect(toScanReading({ symbols: [] }, t, { ocrName: null })).toMatchObject({
      kind: 'unreadable',
    });
    expect(
      toScanReading({ symbols: [symbol('QRCode', 'hello')] }, t, text),
    ).toMatchObject({
      fields: [
        { label: 'QR', value: 'hello' },
        { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
      ],
    });
  });

  it('is unreadable without any symbol', () => {
    expect(toScanReading({ symbols: [] }, t)).toEqual({
      kind: 'unreadable',
      title: t('scan.noCode.title'),
      hint: t('scan.noCode.hint'),
    });
  });

  it('shows the ISO 15434 separators as visible dots', () => {
    const reading = toScanReading(
      { symbols: [symbol('DataMatrix', '[)>\u001e01\u001d750010\u0004')] },
      t,
    );
    expect(reading).toMatchObject({ fields: [{ value: '[)>·01·750010·' }] });
  });

  it('falls back to the raw format name', () => {
    const reading = toScanReading({ symbols: [symbol('Foo', 'x')] }, t);
    expect(reading).toMatchObject({ fields: [{ label: 'Foo' }] });
  });
});

describe('toScanReading with a structured 2D code', () => {
  const aztec = [
    `[)>${RS}01`,
    '02',
    '0075007',
    '250',
    '801',
    '118J0229907975',
    'GEOP',
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
  ].join(GS);

  it('shows carrier, tracking and recipient instead of the raw codes', () => {
    const reading = toScanReading(
      { symbols: [symbol('Code128', 'AB123'), symbol('Aztec', aztec)] },
      t,
    );
    expect(reading).toEqual({
      kind: 'read',
      fields: [
        { label: 'Transporteur', value: 'Colissimo' },
        { label: 'Suivi', value: '8J02299079750', mono: true },
        { label: 'Destinataire', value: 'CAMILLE MOREL' },
        { label: 'Colis', value: '1/2' },
        { label: 'Poids', value: '0,5 kg' },
      ],
    });
  });

  it.each([
    ['1D first', ['Code128', 'Aztec']],
    ['2D first', ['Aztec', 'Code128']],
  ])(
    'keeps the 2D fields when the 1D code of the same number is read %s',
    (_, order) => {
      const by: Record<string, string> = {
        Code128: '8J02299079750',
        Aztec: aztec,
      };
      const reading = toScanReading(
        { symbols: order.map((format) => symbol(format, by[format]!)) },
        t,
      );
      expect(reading).toMatchObject({
        fields: [
          { label: 'Transporteur', value: 'Colissimo' },
          { label: 'Suivi', value: '8J02299079750' },
          { label: 'Destinataire', value: 'CAMILLE MOREL' },
          { label: 'Colis', value: '1/2' },
          { label: 'Poids', value: '0,5 kg' },
        ],
      });
    },
  );

  it('takes the recipient of a structured code that lost its tracking', () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}004${GS}1Z99230623${GS}UPSN${GS}E6344W${GS}296${GS}${GS}1/1${GS}3${GS}N${GS}${GS}PARIS${RS}${EOT}`;
    const reading = toScanReading(
      {
        symbols: [
          symbol('MaxiCode', maxicode),
          symbol('Code128', '1ZE6344W0499230622'),
        ],
      },
      t,
    );
    expect(reading).toMatchObject({
      fields: [
        { label: 'Transporteur', value: 'UPS' },
        { label: 'Suivi', value: '1ZE6344W0499230622' },
        { label: 'Destinataire', status: 'warning' },
        { label: 'Colis', value: '1/1' },
        { label: 'Poids', value: '1,36 kg' },
      ],
    });
  });

  it('shows the recipient the OCR guessed with a doubt, never over a code', () => {
    const text = { ocrName: 'Camille Morel' };
    const guessed = toScanReading(
      { symbols: [symbol('Code128', '1ZE6344W0499230622')] },
      t,
      text,
    );
    expect(guessed).toMatchObject({
      fields: [
        { label: 'Transporteur', value: 'UPS' },
        { label: 'Suivi', value: '1ZE6344W0499230622' },
        { label: 'Destinataire', value: 'Camille Morel ?', status: 'warning' },
      ],
    });
    const missing = toScanReading(
      { symbols: [symbol('Code128', '1ZE6344W0499230622')] },
      t,
      { ocrName: null },
    );
    expect(missing).toMatchObject({
      fields: [{}, {}, { value: 'Non lu', status: 'warning' }],
    });
    const named = toScanReading({ symbols: [symbol('Aztec', aztec)] }, t, {
      ocrName: 'Camille Morel',
    });
    expect(named).toMatchObject({
      fields: [
        {},
        {},
        { label: 'Destinataire', value: 'CAMILLE MOREL' },
        {},
        {},
      ],
    });
    expect(named.kind === 'read' && named.fields[2]?.status).toBeUndefined();
  });

  it('flags a tracking the carrier rules do not vouch for', () => {
    const chrono = aztec
      .replace('118J0229907975', 'HA915306631JB')
      .replace('GEOP', 'XXXX');
    const reading = toScanReading({ symbols: [symbol('Aztec', chrono)] }, t);
    expect(reading.kind === 'read' && reading.fields.slice(0, 2)).toEqual([
      { label: 'Transporteur', value: 'Chronopost' },
      { label: 'Suivi', value: 'HA915306631JB', mono: true, status: 'warning' },
    ]);
  });

  it('keeps the raw rendering when a structured code has no tracking', () => {
    const maxicode = `[)>${RS}01${GS}9675007${GS}250${GS}004${GS}1Z99230623${GS}UPSN${GS}E6344W${RS}${EOT}`;
    const reading = toScanReading(
      { symbols: [symbol('MaxiCode', maxicode)] },
      t,
    );
    expect(reading).toMatchObject({
      fields: [
        {
          label: 'MaxiCode',
          value: '[)>·01·9675007·250·004·1Z99230623·UPSN·E6344W··',
        },
      ],
    });
  });

  it('keeps the raw rendering when no parser claims the symbol', () => {
    const reading = toScanReading(
      { symbols: [symbol('DataMatrix', 'A27610115123456789012')] },
      t,
    );
    expect(reading).toMatchObject({
      fields: [{ label: 'Data Matrix', value: 'A27610115123456789012' }],
    });
  });
});

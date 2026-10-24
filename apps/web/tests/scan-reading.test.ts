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

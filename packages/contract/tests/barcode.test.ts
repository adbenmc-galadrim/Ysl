import { describe, expect, it } from 'vitest';
import { trackingsInBarcode, validateTracking } from '@repo/contract/tracking';

describe('trackings carried by 1D barcodes', () => {
  it('takes the 12 last digits of the FedEx 34-digit code', () => {
    expect(trackingsInBarcode('9622001560001234567100794808390594')).toEqual([
      { value: '794808390594', context: 'fedex' },
      { value: '9622001560001234567100794808390594' },
    ]);
  });

  it('keeps the FedEx Ground 96 code and its 15 displayed digits', () => {
    expect(trackingsInBarcode('9611020987654312345672')).toEqual([
      { value: '9611020987654312345672', context: 'fedex' },
      { value: '987654312345672', context: 'fedex' },
    ]);
  });

  it('rebuilds the Colissimo ID13 from the Geopost code', () => {
    const [id13] = trackingsInBarcode('%0010000116C0000148195802250');
    expect(id13).toEqual({ value: '6C00001481952', context: 'colissimo' });
    expect(validateTracking(id13!.value, id13).status).toBe('sure');
  });

  it('accepts the DPD of §4.6 through its Geopost code alone', () => {
    const [dpd] = trackingsInBarcode('%750070110464000209404001250');
    expect(dpd).toEqual({ value: '10464000209404', context: 'dpd' });
    const verdict = validateTracking(dpd!.value, dpd);
    expect(`${verdict.status} ${verdict.carrier}`).toBe('sure dpd');
  });

  it('reads the SSCC behind the GS1 application identifier 00', () => {
    expect(trackingsInBarcode('(00)340434122150000874(02)1')[0]).toEqual({
      value: '00340434122150000874',
    });
    expect(trackingsInBarcode('00340434122150000874')).toEqual([
      { value: '00340434122150000874' },
    ]);
  });

  it('returns any other text normalised, and nothing for a blank one', () => {
    expect(trackingsInBarcode('1z e6344w 0499 230622')).toEqual([
      { value: '1ZE6344W0499230622' },
    ]);
    expect(trackingsInBarcode('   ')).toEqual([]);
  });
});

import { createTranslator } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  appendTyped,
  groupTyped,
  MAX_TYPED,
  typedEntry,
} from '#/features/scan/typed';

const t = createTranslator('fr');

describe('appendTyped', () => {
  it('keeps letters and digits only, in upper case', () => {
    expect(appendTyped('1z', 'e')).toBe('1ZE');
    expect(appendTyped('1ZE6 344W', '-')).toBe('1ZE6344W');
  });

  it('stops at the longest number a label carries', () => {
    const full = '9'.repeat(MAX_TYPED);
    expect(appendTyped(full, '1')).toBe(full);
  });
});

describe('groupTyped', () => {
  it('groups letters and digits alike by four', () => {
    expect(groupTyped('877974873338')).toBe('8779 7487 3338');
    expect(groupTyped('1ZE6344W0499230622')).toBe('1ZE6 344W 0499 2306 22');
    expect(groupTyped('8779')).toBe('8779');
  });
});

describe('typedEntry', () => {
  it('names the carrier whose format and key the number passes', () => {
    const entry = typedEntry('8779 7487 3338', t);
    expect(entry).toMatchObject({
      carrier: 'FedEx',
      context: 'fedex',
      tracking: '877974873338',
      trackingNorm: '877974873338',
      hint: { tone: 'green', text: 'Format FedEx reconnu' },
    });
  });

  it('accepts a number typed in lower case', () => {
    const entry = typedEntry('1ze6344w0499230622', t);
    expect(entry.carrier).toBe('UPS');
    expect(entry.hint?.tone).toBe('green');
  });

  it('only suggests a carrier whose key wants a context', () => {
    expect(typedEntry('5413337112', t)).toMatchObject({
      carrier: 'DHL Express',
      hint: { tone: 'orange', text: 'Format DHL Express probable' },
    });
  });

  it('keeps the number but no carrier when the key fails', () => {
    expect(typedEntry('7185713569', t)).toMatchObject({
      carrier: null,
      context: null,
      tracking: '7185713569',
      hint: { tone: 'red', text: 'Clé de contrôle incorrecte' },
    });
  });

  it('says nothing while the number matches no format', () => {
    expect(typedEntry('87797487', t).hint).toBeNull();
    expect(typedEntry('87797487', t).carrier).toBeNull();
    expect(typedEntry('', t).hint).toBeNull();
  });
});

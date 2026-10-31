import { describe, expect, it } from 'vitest';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  devicesLine,
  hasNextPage,
  pageRange,
} from '#/features/accounts/describe';

const t = createTranslator(DEFAULT_LOCALE);

describe('the pages of the accounts', () => {
  it('shows the range past 200 accounts', () => {
    expect(pageRange(5, 50, 205)).toBe('201–205 sur 205');
    expect(pageRange(1, 50, 0)).toBe('0 sur 0');
  });

  it('offers the next page while accounts remain, and only then', () => {
    expect(hasNextPage(4, 50, { total: 205 })).toBe(true);
    expect(hasNextPage(5, 50, { total: 205 })).toBe(false);
  });
});

describe('the devices of an account', () => {
  it('names each kind once', () => {
    expect(
      devicesLine(
        { deviceAgents: ['Mozilla (iPhone)', 'x iPhone', 'Macintosh', null] },
        t,
      ),
    ).toBe('iPhone, Mac, Ordinateur');
  });
});

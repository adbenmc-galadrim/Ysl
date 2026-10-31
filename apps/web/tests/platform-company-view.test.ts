import type { PlatformCompany } from '@repo/contract/platform';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  companyRow,
  companyStats,
  companyTabs,
  counted,
  matchesFilter,
} from '#/features/platform/company-view';

const t = createTranslator(DEFAULT_LOCALE);

const company = (
  name: string,
  suspendedAt: Date | null = null,
  accounts = 2,
): PlatformCompany => ({
  id: '01a1923c-0300-7725-8727-02e8ced92a86',
  name,
  createdAt: new Date('2026-10-01T10:00:00Z'),
  suspendedAt,
  profileModel: 'small_site',
  departments: 1,
  accounts,
});

describe('the back-office list', () => {
  const running = company('Atelier Lumen');
  const stopped = company('Studio Kerval', new Date(), 3);

  it('filters by state and name, whatever the case', () => {
    expect(matchesFilter(running, 'suspended', '')).toBe(false);
    expect(matchesFilter(stopped, 'suspended', '')).toBe(true);
    expect(matchesFilter(running, 'all', ' lumen')).toBe(true);
    expect(matchesFilter(running, 'all', 'kerval')).toBe(false);
  });

  it('counts each state, the same in the tabs and the figures', () => {
    expect(companyTabs([running, stopped], t).map((tab) => tab.count)).toEqual([
      2, 1, 1,
    ]);
    expect(companyStats([running, stopped], t).map((s) => s.value)).toEqual([
      '1',
      '5',
      '1',
    ]);
  });

  it('marks a suspended company and writes one account in the singular', () => {
    expect(companyRow(stopped, t).status).toBe('suspended');
    expect(counted('accounts', 1, t)).toBe('1 compte');
    expect(counted('accounts', 2, t)).toBe('2 comptes');
  });
});

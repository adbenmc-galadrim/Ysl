import type { PlatformCompany } from '@repo/contract/platform';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  activityFigure,
  activityLabel,
  companyRow,
  companyStats,
  companyTabs,
  counted,
  matchesFilter,
  matchesModel,
  sortedCompanies,
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
  parcelsThisMonth: 0,
  lastActivityAt: null,
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
    expect(
      companyStats(
        {
          companies: 2,
          suspendedCompanies: 1,
          accounts: 5,
          departments: 2,
          parcelsThisMonth: 1284,
        },
        t,
      ).map((s) => s.value),
    ).toEqual(['1', '5', '1\u202f284', '1']);
    expect(companyStats(undefined, t)[0]?.value).toBe('—');
  });

  it('marks a suspended company and writes one account in the singular', () => {
    expect(companyRow(stopped, t).status).toBe('suspended');
    expect(counted('accounts', 1, t)).toBe('1 compte');
    expect(counted('accounts', 2, t)).toBe('2 comptes');
  });

  it('filters by model, the companies without one included', () => {
    const none = { ...running, profileModel: null };
    expect(matchesModel(running, 'small_site')).toBe(true);
    expect(matchesModel(running, 'multi_departments')).toBe(false);
    expect(matchesModel(none, 'none')).toBe(true);
    expect(matchesModel(none, 'all')).toBe(true);
  });

  it('sorts by activity and by parcels, the never active last', () => {
    const recent = {
      ...running,
      name: 'Récente',
      lastActivityAt: new Date('2026-10-30T10:00:00Z'),
    };
    const busy = { ...running, name: 'Chargée', parcelsThisMonth: 9 };
    const names = (sort: 'activity' | 'parcels' | 'name') =>
      sortedCompanies([running, busy, recent], sort).map((c) => c.name);
    expect(names('activity')[0]).toBe('Récente');
    expect(names('parcels')[0]).toBe('Chargée');
    expect(names('name')).toEqual(['Atelier Lumen', 'Chargée', 'Récente']);
  });

  it('dates an activity on Paris calendar', () => {
    const now = new Date('2026-10-31T09:00:00Z');
    const label = (at: string | null) =>
      activityLabel(at ? new Date(at) : null, now, t);
    expect(label(null)).toBe('Aucune activité');
    expect(label('2026-10-31T08:55:00Z')).toBe('il y a 5 min');
    expect(label('2026-10-31T07:02:00Z')).toBe('aujourd’hui, 8:02');
    expect(label('2026-10-30T23:30:00Z')).toBe('aujourd’hui, 0:30');
    expect(label('2026-10-30T16:20:00Z')).toBe('hier, 17:20');
    expect(label('2026-10-21T08:00:00Z')).toBe('21 oct.');
    expect(activityFigure(null, now)).toBe('—');
    expect(activityFigure(new Date('2026-10-31T08:55:00Z'), now)).toBe('5 min');
    expect(activityFigure(new Date('2026-10-31T07:02:00Z'), now)).toBe('8:02');
    expect(activityFigure(new Date('2026-10-21T08:00:00Z'), now)).toBe('21 oct.');
  });
});

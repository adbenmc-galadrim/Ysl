import type { JournalEntry } from '@repo/contract/platform';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import {
  journalDays,
  journalLine,
  journalText,
} from '#/features/platform/journal-view';

const t = createTranslator(DEFAULT_LOCALE);
const NOW = new Date('2026-10-31T09:00:00Z');

const entry = (over: Partial<JournalEntry>): JournalEntry => ({
  id: '01a1923c-0300-7725-8727-02e8ced92a86',
  at: NOW,
  action: 'company_created',
  companyId: '01a1923c-0300-7725-8727-02e8ced92a87',
  companyName: 'Atelier Lumen',
  actorName: 'Sam Lefort',
  detail: {},
  ...over,
});

describe('the journal lines', () => {
  it('says what each action left, in figures', () => {
    expect(
      journalLine(
        entry({
          action: 'company_deleted',
          detail: { accounts: 1, departments: 2, parcels: 940 },
        }),
        NOW,
        t,
      ),
    ).toMatchObject({
      kind: 'deletion',
      company: 'Atelier Lumen',
      detail: '1 compte, 2 départements, 940 colis effacés',
      by: 'SL',
    });
    expect(
      journalText(
        entry({ action: 'company_renamed', detail: { previousName: 'Avant' } }),
        t,
      ),
    ).toBe('Entreprise renommée · Ancien nom : Avant');
    expect(journalText(entry({ action: 'company_suspended' }), t)).toBe(
      'Entreprise suspendue',
    );
  });

  it('heads the phone with today, yesterday, then months', () => {
    const days = journalDays(
      [
        entry({ at: NOW }),
        entry({ at: new Date('2026-10-30T09:00:00Z') }),
        entry({ at: new Date('2026-10-20T09:00:00Z') }),
        entry({ at: new Date('2026-10-02T09:00:00Z') }),
        entry({ at: new Date('2026-09-02T09:00:00Z') }),
        entry({ at: new Date('2025-11-02T09:00:00Z') }),
      ],
      NOW,
      t,
    );
    expect(days.map((day) => [day.title, day.lines.length])).toEqual([
      ['Aujourd’hui', 1],
      ['Hier', 1],
      ['Octobre', 2],
      ['Septembre', 1],
      ['Novembre 2025', 1],
    ]);
  });
});

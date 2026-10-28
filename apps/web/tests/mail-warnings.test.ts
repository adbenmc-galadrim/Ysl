import { MAIL_BODY_TESTED_MAX } from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { closestVariable, templateWarnings } from '#/features/mail/warnings';

const t = createTranslator(DEFAULT_LOCALE);
const rendered = {
  subject: 'Colis',
  body: 'Bonjour',
  unknown: [],
  missing: [],
  empty: [],
};

describe('templateWarnings', () => {
  it('says nothing about a template that renders whole', () => {
    expect(templateWarnings(rendered, t)).toEqual([]);
  });

  it('names an unknown variable and the one it most likely meant', () => {
    expect(closestVariable('Prenom')).toBe('prénom');
    expect(closestVariable('lien-pas-moi')).toBe('lien_pas_moi');
    expect(templateWarnings({ ...rendered, unknown: ['prenom'] }, t)).toEqual([
      {
        title: 'Variable inconnue : {prenom}',
        description:
          'Elle restera telle quelle dans l’e-mail. Vouliez-vous dire {prénom} ?',
      },
    ]);
  });

  it('points out the pickup missing from Réglages, not another empty value', () => {
    expect(
      templateWarnings(
        { ...rendered, missing: ['code'], empty: ['reserve'] },
        t,
      ),
    ).toEqual([]);
    expect(
      templateWarnings({ ...rendered, empty: ['horaires'] }, t)[0]?.title,
    ).toBe('Lieu ou horaires de retrait non renseignés');
  });

  it('warns past the longest body S5 tried', () => {
    const long = { ...rendered, body: 'x'.repeat(MAIL_BODY_TESTED_MAX + 1) };
    expect(templateWarnings(long, t)[0]?.title).toBe('Message très long');
    expect(
      templateWarnings(
        { ...rendered, body: 'x'.repeat(MAIL_BODY_TESTED_MAX) },
        t,
      ),
    ).toEqual([]);
  });
});

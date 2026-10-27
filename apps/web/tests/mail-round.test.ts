import { describe, expect, it } from 'vitest';
import { pageAfter, pickTemplate } from '#/features/mail/round';

describe('sending the mails one after the other', () => {
  it('moves on only once a mail has left', () => {
    expect(pageAfter(0, 3, 'sent')).toBe(1);
    expect(pageAfter(1, 3, 'sent')).toBe(2);
  });

  it('stops on a mail not sent or given up', () => {
    expect(pageAfter(1, 3, 'failed')).toBe(1);
  });

  it('stays on the last mail once it has left', () => {
    expect(pageAfter(2, 3, 'sent')).toBe(2);
  });
});

describe('the template a mail is written from', () => {
  const templates = [
    { id: 'relance', isDefault: false },
    { id: 'avis', isDefault: true },
    { id: 'court', isDefault: false },
  ];

  it('is the one picked on this round', () => {
    expect(pickTemplate(templates, 'court')?.id).toBe('court');
  });

  it('is the default one when none was picked, or the pick is gone', () => {
    expect(pickTemplate(templates, null)?.id).toBe('avis');
    expect(pickTemplate(templates, 'supprime')?.id).toBe('avis');
  });

  it('is the first one when none is the default', () => {
    expect(
      pickTemplate(
        templates.map((row) => ({ ...row, isDefault: false })),
        null,
      )?.id,
    ).toBe('relance');
  });
});

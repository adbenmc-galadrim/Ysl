import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { describe, expect, it } from 'vitest';
import { recordsText } from '#/features/mail/sender-records';

const t = createTranslator(DEFAULT_LOCALE);

describe('recordsText', () => {
  it('gives the IT team each record with its type, host and value', () => {
    expect(
      recordsText(
        [
          {
            kind: 'code',
            type: 'TXT',
            host: '@',
            value: 'brevo-code:1',
            configured: true,
          },
          {
            kind: 'dkim',
            type: 'CNAME',
            host: 'mail._domainkey',
            value: 'k=rsa',
            configured: false,
          },
        ],
        t,
      ),
    ).toBe(
      'Code de vérification · TXT sur @\nbrevo-code:1\n\nDKIM · CNAME sur mail._domainkey\nk=rsa',
    );
  });
});

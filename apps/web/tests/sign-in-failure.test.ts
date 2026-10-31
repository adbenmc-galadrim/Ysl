import { COMPANY_SUSPENDED } from '@repo/contract/auth';
import { describe, expect, it } from 'vitest';
import { classify } from '#/features/auth/sign-in-failure';

describe('classify', () => {
  it('tells a suspended company apart from a wrong password', () => {
    expect(classify({ status: 403, code: COMPANY_SUSPENDED })).toBe(
      'suspended',
    );
    expect(classify({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalid',
    );
  });
});

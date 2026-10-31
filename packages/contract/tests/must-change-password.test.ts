import { describe, expect, it } from 'vitest';
import { mustChangePassword } from '../src/auth';

const signedIn = (required: Date | string | null | undefined, opened: Date | string) => ({
  user: { passwordChangeRequiredAt: required },
  session: { createdAt: opened },
});

describe('mustChangePassword', () => {
  it('never concerns an account nobody asked it of', () => {
    expect(mustChangePassword(signedIn(null, new Date()))).toBe(false);
    expect(mustChangePassword(signedIn(undefined, new Date()))).toBe(false);
  });

  it('leaves a session opened before the request alone', () => {
    expect(
      mustChangePassword(
        signedIn(new Date('2026-11-01T10:00:00Z'), new Date('2026-11-01T09:00:00Z')),
      ),
    ).toBe(false);
  });

  it('holds a session opened after it', () => {
    expect(
      mustChangePassword(
        signedIn(new Date('2026-11-01T10:00:00Z'), new Date('2026-11-01T11:00:00Z')),
      ),
    ).toBe(true);
  });

  it('reads the dates of the session kept on the device, which are strings', () => {
    expect(
      mustChangePassword(
        signedIn('2026-11-01T10:00:00.000Z', '2026-11-01T11:00:00.000Z'),
      ),
    ).toBe(true);
  });
});

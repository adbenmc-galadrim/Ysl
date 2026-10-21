import type { Session } from '@repo/auth';
import type { AccountMeOutput } from '@repo/contract/account';
import { roleOf } from '#lib/trpc';

export function getAccount(session: Session): AccountMeOutput {
  const { id, name, email } = session.user;
  return { id, name, email, role: roleOf(session) };
}

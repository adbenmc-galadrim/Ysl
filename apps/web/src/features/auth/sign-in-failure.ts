import { COMPANY_SUSPENDED } from '@repo/contract/auth';

export type SignInFailure =
  | 'invalid'
  | 'suspended'
  | 'rateLimited'
  | 'network'
  | 'unknown';

export function classify(error: {
  status?: number;
  code?: string;
}): SignInFailure {
  if (error.status === 429) return 'rateLimited';
  if (error.code === COMPANY_SUSPENDED) return 'suspended';
  // A deactivated account gets the same message, so it reveals nothing.
  if (
    error.code === 'INVALID_EMAIL_OR_PASSWORD' ||
    error.code === 'BANNED_USER'
  ) {
    return 'invalid';
  }
  if (!error.status) return 'network';
  return 'unknown';
}

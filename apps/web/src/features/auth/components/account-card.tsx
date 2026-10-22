import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button } from '@repo/ui';
import { useQuery } from '@tanstack/react-query';
import { sessionQueryOptions } from '#/features/auth/api/session';
import { useSignOut } from '#/features/auth/api/sign-out';

const t = createTranslator(DEFAULT_LOCALE);

export function AccountCard() {
  const { data: session } = useQuery(sessionQueryOptions);
  const signOut = useSignOut();

  if (!session) return null;

  const role = toUserRole(session.user.role);

  return (
    <section
      aria-labelledby="account-heading"
      className="flex flex-col gap-4 rounded-card bg-white p-6"
    >
      <h2 id="account-heading" className="text-18 font-semibold">
        {t('auth.account.heading')}
      </h2>
      <div className="flex flex-col gap-1">
        <span className="text-16 font-semibold">{session.user.name}</span>
        <span className="text-14 text-muted">{session.user.email}</span>
      </div>
      <div className="flex items-center justify-between gap-4">
        <span className="text-16">{t('auth.account.role')}</span>
        <span className="text-16 font-semibold">{t(`auth.role.${role}`)}</span>
      </div>
      <Button
        variant="secondary"
        size="md"
        icon="logout"
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        {t('auth.signOut')}
      </Button>
    </section>
  );
}

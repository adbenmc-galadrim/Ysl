import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { PlatformChrome } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useSignOut } from '#/features/auth/api/sign-out';
import { useSession } from '#/features/auth/api/use-session';
import { initialsOf } from '#/features/settings/initials';

const t = createTranslator(DEFAULT_LOCALE);

/** The app's admin on a computer: its one section, and the way out. */
export function usePlatformChrome(): PlatformChrome {
  const session = useSession();
  const navigate = useNavigate();
  const signOut = useSignOut();
  return {
    nav: [
      {
        items: [
          {
            id: 'entreprises',
            label: t('platform.nav.companies'),
            icon: 'building',
          },
          { id: 'signOut', label: t('platform.signOut'), icon: 'logout' },
        ],
      },
    ],
    account: {
      initials: initialsOf(session.user.name),
      name: session.user.name,
      role: t('platform.account.role'),
    },
    onNavigate: (id) => {
      if (id === 'signOut') signOut.mutate({});
      else void navigate({ to: '/' });
    },
  };
}

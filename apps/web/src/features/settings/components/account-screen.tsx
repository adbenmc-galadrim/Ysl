import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import {
  Banner,
  Button,
  GroupedRow,
  GroupedSection,
  SettingsScreen,
} from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { SignOutBlockedError, useSignOut } from '#/features/auth/api/sign-out';
import { useSession } from '#/features/auth/api/use-session';

const t = createTranslator(DEFAULT_LOCALE);

/** Only refused changes hold the sign-out: a second tap gives them up. */
export function canDiscard(error: unknown): boolean {
  return (
    error instanceof SignOutBlockedError &&
    error.pending === 0 &&
    error.rejected > 0
  );
}

/** What stopped the sign-out: changes still on the phone, or the server. */
export function signOutMessage(error: unknown): string {
  if (error instanceof SignOutBlockedError) {
    if (error.pending === 0) {
      return error.rejected === 1
        ? t('auth.signOut.rejected.one')
        : t('auth.signOut.rejected.many', { count: error.rejected });
    }
    return error.pending === 1
      ? t('auth.signOut.blocked.one')
      : t('auth.signOut.blocked.many', { count: error.pending });
  }
  return t('auth.signOut.failed');
}

export function AccountScreen() {
  const navigate = useNavigate();
  const session = useSession();
  const signOut = useSignOut();
  const role = toUserRole(session.user.role);

  return (
    <SettingsScreen
      title={t('settings.account.title')}
      onBack={() => void navigate({ to: '/reglages' })}
    >
      <GroupedSection>
        <GroupedRow
          title={t('settings.account.name')}
          value={session.user.name}
        />
        <GroupedRow
          title={t('settings.account.email')}
          value={session.user.email}
        />
        <GroupedRow
          title={t('settings.account.role')}
          value={role ? t(`auth.role.${role}`) : ''}
        />
      </GroupedSection>
      <Button
        variant="outline"
        icon="logout"
        block
        disabled={signOut.isPending}
        onClick={() =>
          signOut.mutate({ discardRejected: canDiscard(signOut.error) })
        }
      >
        {canDiscard(signOut.error)
          ? t('auth.signOut.discard')
          : t('auth.signOut')}
      </Button>
      {signOut.isError ? (
        <div role="alert">
          <Banner
            tone={
              signOut.error instanceof SignOutBlockedError ? 'orange' : 'red'
            }
            icon={
              signOut.error instanceof SignOutBlockedError ? 'cloud' : 'alert'
            }
            title={signOutMessage(signOut.error)}
          />
        </div>
      ) : (
        <p className="px-4 text-center text-13 text-muted">
          {t('auth.signOut.wipe')}
        </p>
      )}
    </SettingsScreen>
  );
}

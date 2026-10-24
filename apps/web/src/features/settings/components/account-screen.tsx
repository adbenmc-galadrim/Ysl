import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { Button, GroupedRow, GroupedSection, SettingsScreen } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useSignOut } from '#/features/auth/api/sign-out';
import { useSession } from '#/features/auth/api/use-session';

const t = createTranslator(DEFAULT_LOCALE);

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
          value={t(`auth.role.${role}`)}
        />
      </GroupedSection>
      <Button
        variant="outline"
        icon="logout"
        block
        disabled={signOut.isPending}
        onClick={() => signOut.mutate()}
      >
        {t('auth.signOut')}
      </Button>
    </SettingsScreen>
  );
}

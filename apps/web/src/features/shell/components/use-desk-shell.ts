import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import type { CompanyShellProps } from '@repo/ui';
import { useNavigate } from '@tanstack/react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSession } from '#/features/auth/api/use-session';
import { db } from '#/features/db/database';
import { useCompanyName } from '#/features/directory/components/use-company-name';
import { initialsOf } from '#/features/settings/initials';
import {
  logoUrl,
  useCompanySettings,
} from '#/features/settings/use-company-settings';
import { DESK_PATH, deskNav, type DeskEntry } from '#/features/shell/role-nav';

const t = createTranslator(DEFAULT_LOCALE);

/** The department a department account belongs to: the only one it pulls. */
export function useOwnDepartmentName(): string {
  return (
    useLiveQuery(
      async () =>
        (await db.department.filter((row) => !row.deletedAt).first())?.name,
      [],
    ) ?? ''
  );
}

/** Sidebar and bar of the computer, the same on every page of the role. */
export function useDeskShell(): Pick<
  CompanyShellProps,
  'company' | 'nav' | 'account' | 'onNavigate'
> & { companyCrumb: string } {
  const navigate = useNavigate();
  const session = useSession();
  const company = useCompanyName();
  const { logoId } = useCompanySettings();
  const role = toUserRole(session.user.role);
  const own = useOwnDepartmentName();
  const department = role === 'department' ? own : '';
  const roleName = role ? t(`auth.role.${role}`) : '';
  return {
    company: {
      name: company,
      subtitle: `${roleName} ${department}`.trim(),
      initials: initialsOf(company),
      logoUrl: logoUrl(logoId),
    },
    nav: deskNav(role, t),
    account: {
      initials: initialsOf(session.user.name),
      name: session.user.name,
      role: department || roleName,
    },
    companyCrumb: department || company,
    onNavigate: (id) => void navigate({ to: DESK_PATH[id as DeskEntry] }),
  };
}

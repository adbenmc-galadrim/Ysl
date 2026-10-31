import { toUserRole } from '@repo/contract/auth';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { CompanyShell } from '@repo/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useSession } from '#/features/auth/api/use-session';
import { hasDesk } from '#/features/auth/route-access';
import { useDeskShell } from '#/features/shell/components/use-desk-shell';
import {
  activeDeskEntry,
  DESK_PATH,
  isDeskPage,
} from '#/features/shell/role-nav';
import { DESK_WIDTH, useMediaQuery } from '#/lib/use-media-query';

const t = createTranslator(DEFAULT_LOCALE);

function DeskFrame({
  pathname,
  children,
}: {
  pathname: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { companyCrumb, ...shell } = useDeskShell();
  const active = activeDeskEntry(pathname);
  const entry = shell.nav
    .flatMap((section) => section.items)
    .find((item) => item.id === active);
  return (
    <CompanyShell
      {...shell}
      active={active}
      breadcrumb={[companyCrumb, entry?.label ?? '']}
      flush={!isDeskPage(pathname)}
      searchPlaceholder={t('shell.search')}
      search={{
        value: '',
        onChange: () => void navigate({ to: '/recherche' }),
      }}
    >
      {children}
    </CompanyShell>
  );
}

/**
 * What surrounds a page: for the computer roles on a computer (D23), the
 * sidebar and its bar; a phone screen sits in it as it is, centred by
 * `Screen`. The directory draws the same shell itself, around its search.
 */
export function RoleFrame({ children }: { children: ReactNode }) {
  const session = useSession();
  const desk = useMediaQuery(DESK_WIDTH);
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  if (
    !desk ||
    !hasDesk(toUserRole(session.user.role)) ||
    pathname.startsWith(DESK_PATH.annuaire)
  ) {
    return <>{children}</>;
  }
  return <DeskFrame pathname={pathname}>{children}</DeskFrame>;
}

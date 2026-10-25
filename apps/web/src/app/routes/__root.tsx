import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  useRouterState,
} from '@tanstack/react-router';
import { env } from '@repo/shared/env/web';
import { useEffect, useRef, useState } from 'react';
import {
  currentDisplayContext,
  isIosBrowserTab,
} from '#/features/install/browser-tab';
import { InstallLanding } from '#/features/install/components/install-landing';
import { AppShell } from '#/features/shell/components/app-shell';
import { ErrorScreen } from '#/features/shell/components/error-screen';
import { NotFoundScreen } from '#/features/shell/components/not-found-screen';
import { followThemeColor } from '#/features/shell/theme-color';

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: env.PUBLIC_APP_NAME }] }),
  component: RootComponent,
  notFoundComponent: NotFoundScreen,
  errorComponent: ErrorScreen,
});

function RootComponent() {
  const [browserTab] = useState(() => isIosBrowserTab(currentDisplayContext()));
  // The landing page plays its animations on the document scroll.
  const landing = useRouterState({
    select: (state) => state.matches.some((m) => m.routeId === '/bienvenue'),
  });
  const shell = useRef<HTMLDivElement>(null);
  const locked = !browserTab && !landing;
  useEffect(() => {
    if (!locked || !shell.current) return;
    return followThemeColor(shell.current);
  }, [locked]);
  if (!locked) {
    return (
      <div className="flex min-h-screen flex-col">
        <HeadContent />
        {browserTab ? <InstallLanding /> : <Outlet />}
      </div>
    );
  }
  return (
    <AppShell ref={shell}>
      <HeadContent />
      <Outlet />
    </AppShell>
  );
}

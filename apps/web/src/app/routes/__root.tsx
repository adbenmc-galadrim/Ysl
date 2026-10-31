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
import {
  followThemeColor,
  paintSiteThemeColor,
} from '#/features/shell/theme-color';

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
  // The link opens in Safari: the password is chosen there, before any installation.
  const invitation = useRouterState({
    select: (state) => state.matches.some((m) => m.routeId === '/invitation'),
  });
  const shell = useRef<HTMLDivElement>(null);
  const locked = !browserTab && !landing;
  useEffect(() => {
    if (!locked) return paintSiteThemeColor();
    if (!shell.current) return;
    return followThemeColor(shell.current);
  }, [locked]);
  if (!locked) {
    return (
      <div data-shell="site" className="flex min-h-screen flex-col">
        <HeadContent />
        {browserTab && !invitation ? <InstallLanding /> : <Outlet />}
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

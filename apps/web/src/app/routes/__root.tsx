import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from '@tanstack/react-router';
import { env } from '@repo/shared/env/web';
import { useState } from 'react';
import {
  currentDisplayContext,
  isIosBrowserTab,
} from '#/features/install/browser-tab';
import { InstallLanding } from '#/features/install/components/install-landing';

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: env.PUBLIC_APP_NAME }] }),
  component: RootComponent,
});

function RootComponent() {
  const [browserTab] = useState(() => isIosBrowserTab(currentDisplayContext()));
  return (
    <div className="flex min-h-screen flex-col">
      <HeadContent />
      {browserTab ? <InstallLanding /> : <Outlet />}
    </div>
  );
}

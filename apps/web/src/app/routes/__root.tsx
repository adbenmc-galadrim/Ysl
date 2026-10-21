import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
} from '@tanstack/react-router';
import { env } from '@repo/shared/env/web';

export type RouterContext = {
  queryClient: QueryClient;
};

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({ meta: [{ title: env.PUBLIC_APP_NAME }] }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="flex min-h-screen flex-col">
      <HeadContent />
      <Outlet />
    </div>
  );
}

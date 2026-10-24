import { createRouter } from '@tanstack/react-router';
import { routeTree } from '#/app/routeTree.gen';
import { PendingScreen } from '#/features/shell/components/pending-screen';
import { queryClient } from '#/lib/query-client';
import { SKELETON_DELAY_MS } from '#/lib/use-delayed-pending';

export const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  defaultPendingComponent: PendingScreen,
  defaultPendingMs: SKELETON_DELAY_MS,
  defaultPendingMinMs: SKELETON_DELAY_MS,
  scrollRestoration: true,
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

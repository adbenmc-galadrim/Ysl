import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireSession } from '#/features/auth/guards';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { startSync } from '#/features/sync/sync';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    });
    startSync();
    return { session };
  },
  component: Outlet,
});

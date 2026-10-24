import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireSession } from '#/features/auth/guards';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => ({
    session: await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    }),
  }),
  component: Outlet,
});

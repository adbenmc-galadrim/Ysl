import { createFileRoute, Outlet } from '@tanstack/react-router';
import { requireSession } from '#/features/auth/guards';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => ({
    session: await requireSession(context.queryClient, location.href),
  }),
  component: Outlet,
});

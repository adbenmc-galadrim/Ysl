import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { requireSession } from '#/features/auth/guards';
import {
  currentDisplayContext,
  isInstalledApp,
} from '#/features/install/browser-tab';
import { startOfflinePrep } from '#/features/offline/prep';
import { isPrepared } from '#/features/offline/prepared';
import { startSync } from '#/features/sync/sync';

const PREP_PATH = '/preparation';

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async ({ context, location }) => {
    const session = await requireSession(context.queryClient, location.href, {
      installed: isInstalledApp(currentDisplayContext()),
    });
    startSync();
    startOfflinePrep();
    if (!isPrepared(localStorage) && location.pathname !== PREP_PATH) {
      throw redirect({ to: PREP_PATH });
    }
    return { session };
  },
  component: Outlet,
});

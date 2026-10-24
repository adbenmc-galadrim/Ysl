import { createFileRoute } from '@tanstack/react-router';
import { SyncScreen } from '#/features/sync/components/sync-screen';

export const Route = createFileRoute(
  '/_authenticated/reglages/synchronisation',
)({ component: SyncScreen });

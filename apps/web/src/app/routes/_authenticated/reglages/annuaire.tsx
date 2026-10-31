import { createFileRoute } from '@tanstack/react-router';
import { requireDirectoryKeeper } from '#/features/auth/guards';
import { DirectoryScreen } from '#/features/directory/components/directory-screen';

export const Route = createFileRoute('/_authenticated/reglages/annuaire')({
  beforeLoad: ({ context }) => requireDirectoryKeeper(context),
  component: DirectoryScreen,
});

import { createFileRoute } from '@tanstack/react-router';
import { DirectoryScreen } from '#/features/directory/components/directory-screen';

export const Route = createFileRoute('/_authenticated/reglages/annuaire')({
  component: DirectoryScreen,
});

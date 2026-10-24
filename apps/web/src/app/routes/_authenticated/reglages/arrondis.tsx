import { createFileRoute } from '@tanstack/react-router';
import { CornersScreen } from '#/features/settings/components/corners-screen';

export const Route = createFileRoute('/_authenticated/reglages/arrondis')({
  component: CornersScreen,
});

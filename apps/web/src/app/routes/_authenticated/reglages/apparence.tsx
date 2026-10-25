import { createFileRoute } from '@tanstack/react-router';
import { AppearanceScreen } from '#/features/settings/components/appearance-screen';

export const Route = createFileRoute('/_authenticated/reglages/apparence')({
  component: AppearanceScreen,
});

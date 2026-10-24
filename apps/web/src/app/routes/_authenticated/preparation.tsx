import { createFileRoute } from '@tanstack/react-router';
import { PrepScreen } from '#/features/offline/components/prep-screen';

export const Route = createFileRoute('/_authenticated/preparation')({
  component: PrepScreen,
});

import { createFileRoute } from '@tanstack/react-router';
import { HomeScreen } from '#/features/health/components/home-screen';

export const Route = createFileRoute('/')({
  component: HomeScreen,
});

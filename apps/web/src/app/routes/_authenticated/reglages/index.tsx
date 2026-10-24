import { createFileRoute } from '@tanstack/react-router';
import { ReglagesHome } from '#/features/settings/components/reglages-home';

export const Route = createFileRoute('/_authenticated/reglages/')({
  component: ReglagesHome,
});

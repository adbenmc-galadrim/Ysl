import { createFileRoute } from '@tanstack/react-router';
import { RelancesPage } from '#/features/mail/components/relances-page';

export const Route = createFileRoute('/_authenticated/relances')({
  component: RelancesPage,
});

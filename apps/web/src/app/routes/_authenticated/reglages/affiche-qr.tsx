import { createFileRoute } from '@tanstack/react-router';
import { PosterPage } from '#/features/deposits/components/poster-page';

export const Route = createFileRoute('/_authenticated/reglages/affiche-qr')({
  component: PosterPage,
});

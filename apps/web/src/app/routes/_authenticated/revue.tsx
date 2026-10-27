import { createFileRoute } from '@tanstack/react-router';
import { ReviewScreen } from '#/features/review/components/review-screen';

export const Route = createFileRoute('/_authenticated/revue')({
  component: ReviewScreen,
});

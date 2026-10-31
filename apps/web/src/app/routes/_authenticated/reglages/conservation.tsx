import { createFileRoute } from '@tanstack/react-router';
import { RetentionScreen } from '#/features/company/components/retention-screen';

export const Route = createFileRoute('/_authenticated/reglages/conservation')({
  component: RetentionScreen,
});

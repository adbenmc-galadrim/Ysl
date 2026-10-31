import { createFileRoute } from '@tanstack/react-router';
import { PrivacyScreen } from '#/features/retention/components/privacy-screen';

export const Route = createFileRoute('/_authenticated/reglages/donnees')({
  component: PrivacyScreen,
});

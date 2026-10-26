import { createFileRoute } from '@tanstack/react-router';
import { VerifyScreen } from '#/features/recipient/components/verify-screen';

export const Route = createFileRoute('/_authenticated/verifier')({
  component: VerifyScreen,
});

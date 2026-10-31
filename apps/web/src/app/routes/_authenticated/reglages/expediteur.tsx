import { createFileRoute } from '@tanstack/react-router';
import { SenderScreen } from '#/features/mail/components/sender-screen';

export const Route = createFileRoute('/_authenticated/reglages/expediteur')({
  component: SenderScreen,
});

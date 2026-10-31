import { createFileRoute } from '@tanstack/react-router';
import { InvitationPage } from '#/features/invitations/components/invitation-page';

export const Route = createFileRoute('/invitation')({
  component: InvitationPage,
});

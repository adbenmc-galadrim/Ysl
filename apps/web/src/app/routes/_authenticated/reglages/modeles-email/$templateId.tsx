import { createFileRoute } from '@tanstack/react-router';
import { EmailTemplatePage } from '#/features/mail/components/email-template-page';

export const Route = createFileRoute(
  '/_authenticated/reglages/modeles-email/$templateId',
)({ component: EmailTemplateRoute });

function EmailTemplateRoute() {
  const { templateId } = Route.useParams();
  return <EmailTemplatePage key={templateId} templateId={templateId} />;
}

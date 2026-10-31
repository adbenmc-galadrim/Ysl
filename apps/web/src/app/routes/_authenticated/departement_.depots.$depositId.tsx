import { createFileRoute } from '@tanstack/react-router';
import { DepartmentDepositPage } from '#/features/deposits/components/department-deposit-page';

function DepositRoute() {
  const { depositId } = Route.useParams();
  return <DepartmentDepositPage depositId={depositId} />;
}

export const Route = createFileRoute(
  '/_authenticated/departement_/depots/$depositId',
)({
  component: DepositRoute,
});

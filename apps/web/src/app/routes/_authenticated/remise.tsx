import { ScannerQrScreen } from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/remise')({
  component: RemisePage,
});

function RemisePage() {
  const navigate = useNavigate();
  return <ScannerQrScreen onClose={() => void navigate({ to: '/' })} />;
}

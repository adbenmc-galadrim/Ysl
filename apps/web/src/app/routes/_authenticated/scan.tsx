import { ScanScreen } from '@repo/ui';
import { createFileRoute, useNavigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/scan')({
  component: ScanPage,
});

function ScanPage() {
  const navigate = useNavigate();
  const close = () => void navigate({ to: '/' });
  return (
    <ScanScreen
      count={0}
      reading={{ kind: 'idle' }}
      onClose={close}
      onDone={close}
    />
  );
}

import { createFileRoute } from '@tanstack/react-router';
import { requireAdmin } from '#/features/auth/guards';
import { ImportV1Page } from '#/features/imports/components/import-v1-screen';

export const Route = createFileRoute('/_authenticated/reglages/import-v1')({
  beforeLoad: ({ context }) => requireAdmin(context),
  component: ImportV1Page,
});

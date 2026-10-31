import { createFileRoute } from '@tanstack/react-router';
import { ImportV1Page } from '#/features/imports/components/import-v1-screen';

export const Route = createFileRoute('/_authenticated/reglages/import-v1')({
  component: ImportV1Page,
});

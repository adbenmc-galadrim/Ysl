import { createFileRoute } from '@tanstack/react-router';
import { ExportScreen } from '#/features/exports/components/export-screen';

export const Route = createFileRoute('/_authenticated/reglages/export')({
  component: ExportScreen,
});

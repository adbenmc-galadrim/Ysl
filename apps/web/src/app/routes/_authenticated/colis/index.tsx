import { createFileRoute } from '@tanstack/react-router';
import { ColisPage } from '#/features/parcels/components/colis-page';

export const Route = createFileRoute('/_authenticated/colis/')({
  component: ColisPage,
});

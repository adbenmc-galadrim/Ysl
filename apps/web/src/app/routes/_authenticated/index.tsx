import { createFileRoute } from '@tanstack/react-router';
import { ColisHome } from '#/features/parcels/components/colis-home';

export const Route = createFileRoute('/_authenticated/')({
  component: ColisHome,
});

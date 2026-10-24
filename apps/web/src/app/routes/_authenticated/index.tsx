import { createFileRoute } from '@tanstack/react-router';
import { ReprendreLot } from '#/features/batch/components/reprendre-lot';
import { ColisHome } from '#/features/parcels/components/colis-home';

function HomePage() {
  return (
    <>
      <ColisHome />
      <ReprendreLot />
    </>
  );
}

export const Route = createFileRoute('/_authenticated/')({
  component: HomePage,
});

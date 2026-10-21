import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { PARCELS } from '#fixtures/parcels';
import { ColisScreen } from '#screens/colis/colis-screen';
import { RemettreActions } from '#screens/remise/remettre-actions';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Remise/Accueil avec Remettre',
  component: ColisScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The home list, with the handover shortcut in the bottom bar. */
export const AccueilAvecRemettre: Story = {
  name: 'Accueil avec Remettre',
  parameters: { reference: '09-zones-d-ombre/remise--accueil-avec-remettre' },
  args: {
    sync: 'synced',
    summary: '18 colis, dont 6 à traiter',
    actions: <RemettreActions />,
    sections: [
      {
        title: 'À compléter',
        parcels: [PARCELS.unknown],
        rowAction: () => (
          <Button variant="danger" size="xs" className="w-[81px]">
            Choisir
          </Button>
        ),
      },
      {
        title: 'À notifier',
        parcels: [PARCELS.camille],
        action: (
          <Button size="xs" className="w-[84px]">
            Notifier
          </Button>
        ),
      },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
      { title: 'Remis aujourd’hui', count: 12, parcels: [PARCELS.malik] },
    ],
  },
};

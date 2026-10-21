import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelThumb } from '#components/label-thumb';
import { INTERRUPTED_BATCH } from '#fixtures/batches';
import { Accueil } from '#screens/colis/colis-screen.stories';
import { ReprendreLotScreen } from '#screens/reception-zones/reprendre-lot-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Réception/Reprendre le lot',
  component: ReprendreLotScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ReprendreLotScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ReprendreLeLot: Story = {
  name: 'Reprendre le lot',
  parameters: { reference: '09-zones-d-ombre/reception--reprendre-le-lot' },
  args: {
    // The home as the Colis story draws it, so both stay in step.
    home: Accueil.args,
    ...INTERRUPTED_BATCH,
    // Boards alternate, as photos of different boxes would.
    thumbnail: (_, i) => (
      <LabelThumb
        width={52}
        height={64}
        radius={8}
        tone={i % 2 ? 'light' : 'mid'}
        className="h-auto w-full"
      />
    ),
  },
};

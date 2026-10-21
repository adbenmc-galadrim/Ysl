import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { IconTile } from '#components/icon-tile';
import { ListRow, ListRowValue } from '#components/list-row';

const meta = {
  title: 'Composants/ListRow',
  component: ListRow,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
  args: {
    leading: <IconTile icon="package" />,
    title: 'Camille Morel',
    lines: [{ text: 'Studio, UPS ···0622' }, { text: 'Reçu à 10 h 42' }],
  },
} satisfies Meta<typeof ListRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Chevron: Story = {};

export const AvecBouton: Story = {
  name: 'Avec bouton',
  args: {
    leading: <IconTile icon="alert" tone="red" />,
    title: 'Destinataire inconnu',
    titleTone: 'red',
    lines: [
      { text: 'Colissimo ···7505' },
      { text: 'Nom lu sur l’étiquette : L. FONTAIN', tone: 'red' },
    ],
    trailing: (
      <Button variant="danger" size="xs" className="w-[81px]">
        Choisir
      </Button>
    ),
  },
};

export const AvecValeur: Story = {
  name: 'Avec valeur',
  args: { trailing: <ListRowValue>Non envoyé</ListRowValue> },
};

export const AvecSeparateur: Story = {
  name: 'Avec séparateur',
  args: { separator: true },
};

import type { Meta, StoryObj } from '@storybook/react-vite';

import { RecipientPicker, ShuttleBar, ShuttleBottom, ShuttleScreen } from '#components/shuttle-parts';
import { RECIPIENT_RESULTS } from '#fixtures/multi-entreprises';

const meta = {
  title: 'Composants/ShuttleParts',
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Page: Story = {
  name: 'Page et barre',
  render: () => (
    <ShuttleScreen bottom={<ShuttleBottom icon="check">Enregistrer le lot</ShuttleBottom>}>
      <ShuttleBar title="Lot" skip />
    </ShuttleScreen>
  ),
};

export const Destinataire: Story = {
  name: 'Choisir le destinataire',
  render: () => <RecipientPicker query="fonta" results={RECIPIENT_RESULTS} />,
};

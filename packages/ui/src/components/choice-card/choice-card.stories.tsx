import type { Meta, StoryObj } from '@storybook/react-vite';

import { ChoiceCard } from '#components/choice-card';
import { ChoiceTileGrid } from '#components/choice-tile';

const meta = {
  title: 'Composants/ChoiceCard',
  component: ChoiceCard,
  parameters: { layout: 'padded' },
  args: { icon: 'sign', label: 'Signature de Paul' },
} satisfies Meta<typeof ChoiceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selectionnee: Story = { args: { selected: true } };

export const Paire: Story = {
  render: () => (
    <ChoiceTileGrid label="Preuve" className="w-[353px]">
      <ChoiceCard icon="sign" label="Signature de Paul" selected />
      <ChoiceCard icon="camera" label="Photo du badge" />
    </ChoiceTileGrid>
  ),
};

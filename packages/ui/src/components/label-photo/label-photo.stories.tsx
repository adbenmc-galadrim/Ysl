import type { Meta, StoryObj } from '@storybook/react-vite';

import { LabelPhoto } from '#components/label-photo';

const meta = {
  title: 'Composants/LabelPhoto',
  component: LabelPhoto,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof LabelPhoto>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = { name: 'Défaut' };

/** The label stays the same size; only the board follows the width. */
export const Etroit: Story = {
  name: 'Étroit',
  decorators: [(Story) => <div className="w-[300px]"><Story /></div>],
};
